// Use ipcRenderer from window (set by api.js)
let allAccounts = [];
let allUsers = [];

// Get current user
const currentUser = api.getCurrentUser();

if (!currentUser) {
  // Not logged in, redirect to login
  window.ipcRenderer.send('navigate-to-login');
}

// Update user info in sidebar
document.getElementById('userName').textContent = currentUser.username;
document.getElementById('userRole').textContent = currentUser.role;
document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();

// Hide admin-only elements if user is not admin
if (currentUser.role !== 'admin') {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.add('hidden');
  });
}

// Page navigation
const navItems = document.querySelectorAll('.nav-item');
const pageTitle = document.getElementById('pageTitle');
const contentArea = document.getElementById('contentArea');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const page = item.getAttribute('data-page');
    navigateToPage(page);

    // Update active state
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
  });
});

function navigateToPage(page) {
  switch (page) {
    case 'dashboard':
      pageTitle.textContent = 'Dashboard';
      loadDashboard();
      break;
    case 'accounts':
      pageTitle.textContent = 'Accounts';
      loadAccounts();
      break;
    case 'services':
      pageTitle.textContent = 'Service Management';
      loadServices();
      break;
    case 'users':
      pageTitle.textContent = 'Users';
      loadUsers();
      break;
    case 'history':
      pageTitle.textContent = 'Activity History';
      loadHistory();
      break;
    case 'chat-lock':
      pageTitle.textContent = 'Chat Lock Management';
      loadChatLock();
      break;

  }
}

// Load Dashboard
async function loadDashboard() {
  contentArea.innerHTML = '<div class="loading">Loading dashboard...</div>';

  try {
    const stats = await api.getStats();
    const logs = await api.getUsageLogs(10);

    contentArea.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Accounts</h3>
          <div class="stat-value">${stats.totalAccounts || 0}</div>
        </div>
        <div class="stat-card">
          <h3>Total Users</h3>
          <div class="stat-value">${stats.totalUsers || 0}</div>
        </div>
        <div class="stat-card">
          <h3>Active Sessions</h3>
          <div class="stat-value">${stats.activeSessions || 0}</div>
        </div>
        <div class="stat-card">
          <h3>Today's Activity</h3>
          <div class="stat-value">${stats.todayActivity || 0}</div>
        </div>
      </div>

      <div class="activity-feed">
        <h2>Recent Activity</h2>
        <div id="activityList"></div>
      </div>
    `;

    const activityList = document.getElementById('activityList');
    if (logs.data && logs.data.length > 0) {
      activityList.innerHTML = logs.data.map(log => `
        <div class="activity-item">
          <div class="activity-info">
            <p><strong>${log.username}</strong> ${log.action} ${log.details ? '- ' + log.details : ''}</p>
            <small>${formatDate(log.created_at)}</small>
          </div>
        </div>
      `).join('');
    } else {
      activityList.innerHTML = '<div class="empty-state"><i>📭</i><p>No recent activity</p></div>';
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    contentArea.innerHTML = `<div class="empty-state"><p>Error loading dashboard: ${error.message}</p></div>`;
  }
}

// Load Accounts
async function loadAccounts() {
  contentArea.innerHTML = '<div class="loading">Loading accounts...</div>';
  const isAdmin = currentUser.role === 'admin';

  contentArea.innerHTML = `
    ${isAdmin ? `
      <div class="accounts-header">
        <h2>Manage Accounts</h2>
        <button class="btn btn-primary" id="addAccountBtn">+ Add Account</button>
      </div>
    ` : ''}
    <div class="page-controls">
      <input type="text" id="accountSearchInput" class="search-input" placeholder="🔎 Search accounts by name...">
    </div>
    <div class="accounts-grid" id="accountsGrid"></div>
  `;

  try {
    const [accountsResponse, userCountsResponse] = await Promise.all([
      api.getAccounts(),
      isAdmin ? api.getAccountUserCounts() : Promise.resolve({ data: {} })
    ]);

    allAccounts = accountsResponse.data || [];
    const userCounts = userCountsResponse.data || {};

    renderAccounts(allAccounts, userCounts);

    document.getElementById('accountSearchInput').addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filteredAccounts = allAccounts.filter(acc => acc.service_name.toLowerCase().includes(searchTerm));
      renderAccounts(filteredAccounts, userCounts);
    });

    if (isAdmin) {
      document.getElementById('addAccountBtn').addEventListener('click', openAddAccountModal);
    }
  } catch (error) {
    console.error('Error loading accounts:', error);
    document.getElementById('accountsGrid').innerHTML = `<div class="empty-state"><p>Error loading accounts: ${error.message}</p></div>`;
  }
}

function renderAccounts(accounts, userCounts = {}) {
  const accountsGrid = document.getElementById('accountsGrid');
  const isAdmin = currentUser.role === 'admin';

  if (accounts.length === 0) {
    const currentUser = window.ipcRenderer.sendSync('get-store-value', 'currentUser');
    let message = '<div class="empty-state"><i>📦</i>';
    if (document.getElementById('accountSearchInput').value) {
      message += '<p>No accounts match your search</p>';
    } else if (currentUser && currentUser.role === 'admin') {
      message += '<p>No accounts created yet</p><p>Click "Add Account" to create one</p>';
    } else if (currentUser) {
      message += `<p>No accounts assigned to you</p><p>Contact administrator for access</p><p><small>Logged in as: ${currentUser.username} (ID: ${currentUser.id})</small></p>`;
    } else {
      message += '<p>Authentication error</p><p>Please login again</p>';
    }
    message += '<p><small>Server: https://db.handymancode.com/api/wokushop-api</small></p></div>';
    accountsGrid.innerHTML = message;
    return;
  }

  accountsGrid.innerHTML = accounts.map(account => `
    <div class="account-card">
      <div class="account-card-header">
        <span class="account-type">${account.service_type}</span>
        ${isAdmin ? `
        <div class="account-user-count" title="Users assigned to this account">
          👥 <span>${userCounts[account.id] || 0}</span>
        </div>
        ` : ''}
      </div>
      <h3>${account.service_name}</h3>
      <p style="color: var(--text-secondary); margin-bottom: 15px;">${account.description || 'No description'}</p>
      <div class="account-actions">
        <button class="btn btn-success btn-small launch-account" data-account='${JSON.stringify(account)}'>
          Launch Session
        </button>
        ${isAdmin ? `
          <button class="btn btn-secondary btn-small edit-account" data-id="${account.id}">Edit</button>
          <button class="btn btn-danger btn-small delete-account" data-id="${account.id}">Delete</button>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Add event listeners
  document.querySelectorAll('.launch-account').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const account = JSON.parse(e.currentTarget.getAttribute('data-account'));
      await launchAccountSession(account);
    });
  });

  if (isAdmin) {
    document.querySelectorAll('.backup-session').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const { id, partition } = e.currentTarget.dataset;
        backupSession(parseInt(id), partition);
      });
    });
    document.querySelectorAll('.restore-session').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const { id, partition, serviceType } = e.currentTarget.dataset;
        restoreSession(parseInt(id), partition, serviceType);
      });
    });
    document.querySelectorAll('.delete-account').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('Are you sure you want to delete this account?')) {
          deleteAccount(e.currentTarget.dataset.id);
        }
      });
    });
  }
}

// Launch account session
async function launchAccountSession(account) {
  const launchButton = event?.target;
  const originalText = launchButton?.innerHTML || '';

  try {
    console.log('=== Launching session for:', account.service_name, '(Type:', account.service_type, ')');

    // Show loading state
    if (launchButton) {
      launchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking session...';
      launchButton.disabled = true;
    }

    // Check if partition has session data
    console.log('🔍 Checking if partition has session data...');
    const hasSession = await window.ipcRenderer.invoke('check-partition-data', account.partition_id);

    if (!hasSession) {
      console.log('❌ No session data found in partition, checking for backup...');

      // Update loading message
      if (launchButton) {
        launchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking backup...';
      }

      // Check if backup is available
      const hasBackup = await window.ipcRenderer.invoke('check-backup-available', account.id);

      if (hasBackup) {
        console.log('✅ Backup found! Auto-restoring session...');

        // Update loading message
        if (launchButton) {
          launchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restoring session...';
        }

        // Auto-restore session
        try {
          await window.ipcRenderer.invoke('auto-restore-session', account.id, account.partition_id);
          console.log('✅ Session auto-restored successfully!');

          // Show success notification
          showNotification('Session restored automatically!', 'success');
        } catch (restoreError) {
          console.warn('⚠️ Auto-restore failed, will launch with login page:', restoreError.message);
          showNotification('Auto-restore failed, please login manually', 'warning');
        }
      } else {
        console.log('ℹ️ No backup available, will launch with login page');
        showNotification('No saved session found, please login', 'info');
      }
    } else {
      console.log('✅ Session data found in partition, launching directly');
    }

    // Update loading message
    if (launchButton) {
      launchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading service...';
    }

    // Get service info (which now includes allowed_domains)
    let servicesResult;
    try {
      servicesResult = await api.getServices();
    } catch (serviceError) {
      console.error('Error loading services:', serviceError);
      servicesResult = { data: [] };
    }

    const services = servicesResult.data || [];
    console.log('All services loaded:', services);
    console.log('Looking for service type:', account.service_type);

    const service = services.find(s => s.service_type === account.service_type);

    if (!service) {
      console.error('Available services:', services.map(s => s.service_type));
      throw new Error(`Service type "${account.service_type}" not found`);
    }

    const loginUrl = service.login_url || 'https://www.google.com';
    const allowedDomains = service.allowed_domains || [];

    console.log('=== Service Details ===');
    console.log('Full service object:', JSON.stringify(service, null, 2));
    console.log('Service type:', service.service_type);
    console.log('Login URL:', loginUrl);
    console.log('Allowed domains raw:', service.allowed_domains);
    console.log('Allowed domains (processed):', allowedDomains);
    console.log('Allowed domains length:', allowedDomains.length);
    console.log('======================');

    // All services use account-specific partition (shared session)
    // Admin logs in once, all users share the same session
    const partitionId = account.partition_id;
    console.log('📍 Account partition ID:', partitionId);

    // Create session window data
    const sessionData = {
      accountId: account.id,
      serviceName: account.service_name,
      serviceType: account.service_type,
      partitionId: partitionId,
      allowedDomains: allowedDomains,
      loginUrl: loginUrl,
      userRole: currentUser.role,
      userId: currentUser.id
    };

    console.log('=== Session data being sent to main process:', sessionData);

    // Send IPC to main process to create session window
    window.ipcRenderer.send('create-session-window', sessionData);

    // Add a short delay to prevent race condition with session backup
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Log the activity
    await api.logActivity('account_access', {
      account_id: account.id,
      account_name: account.service_name,
      service_type: account.service_type
    });

    // Reset button state
    if (launchButton) {
      launchButton.innerHTML = originalText;
      launchButton.disabled = false;
    }

  } catch (error) {
    console.error('Error launching session:', error);

    // Show error notification
    showNotification('Failed to launch session: ' + error.message, 'error');

    // Reset button state
    if (launchButton) {
      launchButton.innerHTML = originalText;
      launchButton.disabled = false;
    }
  }
}

// Backup session to server
async function backupSession(accountId, partitionId) {
  const btn = event ? event.target : null;
  const originalText = btn ? btn.innerHTML : '';

  try {
    // Validate inputs
    if (!accountId || !partitionId) {
      throw new Error('Invalid account data. Account ID or Partition ID is missing.');
    }

    if (!confirm('Backup current session state to server?\n\n⚠️ IMPORTANT: Please CLOSE the session window for this account BEFORE proceeding.\n\nThis will save the latest cookies and data. The backup will fail if the session window is open.')) {
      return;
    }

    // Show loading indicator
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Backing up...';
    }

    console.log('Starting session backup for account:', accountId, 'partition:', partitionId);

    // Call IPC handler
    const result = await window.ipcRenderer.invoke('backup-session', accountId, partitionId);

    console.log('Backup IPC result:', result);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }

    if (result.success) {
      alert('✅ Session backed up successfully!\n\nYou can now restore this session on another machine.');
      console.log('Backup result:', result.data);
    } else {
      throw new Error(result.message || 'Unknown error occurred during backup');
    }
  } catch (error) {
    console.error('Error backing up session:', error);
    console.error('Error stack:', error.stack);

    let errorMessage = '❌ Failed to backup session:\n\n';

    if (error.message) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Unknown error. Check console log for details.';
    }

    // Add helpful hints
    if (error.message && error.message.includes('not found')) {
      errorMessage += '\n\n💡 Tip: Open this account at least once before backing up.';
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
      errorMessage += '\n\n💡 Tip: Make sure the API server is running (http://localhost/wokushop-api).';
    }

    alert(errorMessage);

    // Reset button
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Restore session from server
async function restoreSession(accountId, partitionId, serviceType) {
  const btn = event ? event.target : null;
  const originalText = btn ? btn.innerHTML : '';

  try {
    // Validate inputs
    if (!accountId || !partitionId) {
      throw new Error('Invalid account data. Account ID or Partition ID is missing.');
    }

    if (!confirm('Restore session from server?\n\nThis will download and restore the latest backup for this account.\n\n⚠️ WARNING: Current local session will be overwritten!')) {
      return;
    }

    // Show loading indicator
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Restoring...';
    }

    console.log('Starting session restore for account:', accountId, 'partition:', partitionId, 'service:', serviceType);

    // For Gemini accounts, use enhanced restore
    let result;
    if (serviceType === 'gemini') {
      console.log('🔧 Using enhanced Gemini restore...');
      result = await window.ipcRenderer.invoke('enhanced-gemini-restore', accountId, partitionId);
    } else {
      console.log('🔧 Using standard restore...');
      result = await window.ipcRenderer.invoke('restore-session', accountId, partitionId);
    }

    console.log('Restore IPC result:', result);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }

    if (result.success) {
      const message = serviceType === 'gemini'
        ? '✅ Enhanced Gemini restore completed successfully!\n\n🔄 Gemini window will reload automatically in 3 seconds.'
        : '✅ Session restored successfully!\n\n⚠️ IMPORTANT: Please close and reopen this account to use the restored session.';

      alert(message);
      console.log('Restore result:', result.data || result.message);
    } else {
      throw new Error(result.message || 'Unknown error occurred during restore');
    }
  } catch (error) {
    console.error('Error restoring session:', error);
    console.error('Error stack:', error.stack);

    let errorMessage = '❌ Failed to restore session:\n\n';

    if (error.message) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Unknown error. Check console log for details.';
    }

    // Add helpful hints
    if (error.message && error.message.includes('No backup found')) {
      errorMessage += '\n\n💡 Tip: Create a backup first using the Backup button.';
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
      errorMessage += '\n\n💡 Tip: Make sure the API server is running (http://localhost/wokushop-api).';
    }

    alert(errorMessage);

    // Reset button
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Delete account
async function deleteAccount(accountId) {
  try {
    await api.deleteAccount(accountId);
    loadAccounts(); // Reload the accounts list
  } catch (error) {
    console.error('Error deleting account:', error);
    alert('Failed to delete account: ' + error.message);
  }
}

// Load Users (Admin only)
async function loadUsers() {
  contentArea.innerHTML = '<div class="loading">Loading users...</div>';

  contentArea.innerHTML = `
    <div class="accounts-header">
      <h2>Manage Users</h2>
      <button class="btn btn-primary" id="addUserBtn">+ Add User</button>
    </div>
    <div class="page-controls">
      <input type="text" id="userSearchInput" class="search-input" placeholder="🔎 Search users by username...">
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="usersTableBody"></tbody>
      </table>
    </div>
  `;

  try {
    const response = await api.getUsers();
    allUsers = response.data || [];
    renderUsers(allUsers);

    document.getElementById('userSearchInput').addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filteredUsers = allUsers.filter(user => user.username.toLowerCase().includes(searchTerm));
      renderUsers(filteredUsers);
    });

    document.getElementById('addUserBtn').addEventListener('click', openAddUserModal);
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('usersTableBody').innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>Error loading users: ${error.message}</p></div></td></tr>`;
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');

  if (users.length === 0) {
    const searchTerm = document.getElementById('userSearchInput').value;
    const message = searchTerm ? 'No users match your search' : 'No users found';
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">${message}</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.id}</td>
      <td>${user.username}</td>
      <td><span class="badge badge-${user.role}">${user.role}</span></td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        ${user.role !== 'admin' ? `
          <button class="btn btn-success btn-small login-as-user" data-id="${user.id}" data-username="${user.username}">Login as User</button>
        ` : ''}
        <button class="btn btn-secondary btn-small assign-accounts" data-id="${user.id}">Assign Accounts</button>
        ${user.id !== currentUser.id ? `
          <button class="btn btn-danger btn-small delete-user" data-id="${user.id}">Delete</button>
        ` : ''}
      </td>
    </tr>
  `).join('');

  // Add event listeners
  document.querySelectorAll('.login-as-user').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const { id, username } = e.currentTarget.dataset;
      if (confirm(`Are you sure you want to login as "${username}"?\n\nYou will be logged out from your admin account and logged in as this user.`)) {
        loginAsUser(id);
      }
    });
  });

  document.querySelectorAll('.delete-user').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (confirm('Are you sure you want to delete this user?')) {
        deleteUser(e.currentTarget.dataset.id);
      }
    });
  });

  document.querySelectorAll('.assign-accounts').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openAssignAccountsModal(e.currentTarget.dataset.id);
    });
  });
}

// Delete user
async function deleteUser(userId) {
  try {
    await api.deleteUser(userId);
    loadUsers(); // Reload the users list
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Failed to delete user: ' + error.message);
  }
}

// Login as user (Admin only)
async function loginAsUser(userId) {
  try {
    const response = await api.loginAsUser(userId);

    // Log the activity before switching
    await api.logActivity('admin_login_as_user', {
      target_user_id: userId,
      target_username: response.user.username
    });

    // Show success message
    alert(`Successfully logged in as "${response.user.username}".\n\nYou are now viewing the system as this user.`);

    // Reload the dashboard to reflect new user context
    window.location.reload();
  } catch (error) {
    console.error('Error logging in as user:', error);
    alert('Failed to login as user: ' + error.message);
  }
}

// Load History (Admin only)
async function loadHistory() {
  contentArea.innerHTML = '<div class="loading">Loading history...</div>';

  try {
    const response = await api.getUsageLogs(100);
    const logs = response.data || [];

    contentArea.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody id="historyTableBody"></tbody>
        </table>
      </div>
    `;

    const tbody = document.getElementById('historyTableBody');

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No activity logs</td></tr>';
    } else {
      tbody.innerHTML = logs.map(log => `
        <tr>
          <td>${log.username}</td>
          <td>${log.action}</td>
          <td>${log.details || '-'}</td>
          <td>${formatDate(log.created_at)}</td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading history:', error);
    contentArea.innerHTML = `<div class="empty-state"><p>Error loading history: ${error.message}</p></div>`;
  }
}

// Load Chat Lock (Admin only)
async function loadChatLock() {
  contentArea.innerHTML = '<div class="loading">Loading chat locks...</div>';

  try {
    const response = await api.getChatLocks();
    const locks = response.data || [];

    contentArea.innerHTML = `
      <div class="accounts-header">
        <h2>Chat Lock Management</h2>
        <p style="color: var(--text-secondary);">Lock specific AI chat conversations to individual users</p>
        <button class="btn btn-primary" id="addChatLockBtn">+ Add Chat Lock</button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Chat ID</th>
              <th>Locked To</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="chatLockTableBody"></tbody>
        </table>
      </div>
    `;

    const tbody = document.getElementById('chatLockTableBody');

    if (locks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No chat locks configured</td></tr>';
    } else {
      tbody.innerHTML = locks.map(lock => `
        <tr>
          <td>${lock.account_name}</td>
          <td>${lock.chat_id}</td>
          <td>${lock.username}</td>
          <td>${formatDate(lock.created_at)}</td>
          <td>
            <button class="btn btn-danger btn-small delete-lock" data-id="${lock.id}">Remove Lock</button>
          </td>
        </tr>
      `).join('');

      // Add event listeners
      document.querySelectorAll('.delete-lock').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const lockId = e.target.getAttribute('data-id');
          if (confirm('Are you sure you want to remove this chat lock?')) {
            await deleteChatLock(lockId);
          }
        });
      });
    }

    // Add event listener for add chat lock button
    document.getElementById('addChatLockBtn').addEventListener('click', openAddChatLockModal);
  } catch (error) {
    console.error('Error loading chat locks:', error);
    contentArea.innerHTML = `<div class="empty-state"><p>Error loading chat locks: ${error.message}</p></div>`;
  }
}

// Delete chat lock
async function deleteChatLock(lockId) {
  try {
    await api.deleteChatLock(lockId);
    loadChatLock(); // Reload the chat locks list
  } catch (error) {
    console.error('Error deleting chat lock:', error);
    alert('Failed to delete chat lock: ' + error.message);
  }
}

// Open Add Chat Lock Modal
async function openAddChatLockModal() {
  const modal = document.getElementById('addChatLockModal');

  try {
    // Load accounts and users
    const [accountsResult, usersResult] = await Promise.all([
      api.getAccounts(),
      api.getUsers()
    ]);

    const accounts = accountsResult.data || [];
    const users = usersResult.data || [];

    // Populate account dropdown
    const accountSelect = document.getElementById('lockAccountId');
    accountSelect.innerHTML = '<option value="">Select an account...</option>' +
      accounts.map(acc => `<option value="${acc.id}">${acc.service_name} (${acc.service_type})</option>`).join('');

    // Populate user dropdown (exclude admins)
    const userSelect = document.getElementById('lockUserId');
    userSelect.innerHTML = '<option value="">Select a user...</option>' +
      users.filter(u => u.role !== 'admin').map(user => `<option value="${user.id}">${user.username}</option>`).join('');

    modal.classList.add('show');
  } catch (error) {
    alert('Failed to load data: ' + error.message);
  }
}

// Helper function to extract chat ID from URL
function extractChatIdFromInput(input, serviceType) {
  // If input looks like a URL, try to extract chat ID
  if (input.includes('://') || input.includes('/')) {
    try {
      const url = new URL(input.startsWith('http') ? input : 'https://' + input);

      // ChatGPT: /c/abc123
      if (url.hostname.includes('openai.com') || url.hostname.includes('chatgpt.com')) {
        const match = url.pathname.match(/\/c\/([^\/\?]+)/);
        return match ? match[1] : input;
      }

      // Gemini: /app/abc123
      if (url.hostname.includes('gemini.google.com')) {
        const match = url.pathname.match(/\/app\/([^\/\?]+)/);
        return match ? match[1] : input;
      }

      // YouTube: ?v=abc123
      if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
        return url.searchParams.get('v') || input;
      }

      // Generic: try to get last path segment
      const pathParts = url.pathname.split('/').filter(p => p);
      return pathParts[pathParts.length - 1] || input;
    } catch (e) {
      console.error('Error parsing URL:', e);
    }
  }

  // If not a URL, assume it's already a chat ID
  return input.trim();
}

// Modal management
async function openAddAccountModal() {
  const modal = document.getElementById('addAccountModal');

  try {
    // Load active services dynamically
    const servicesResult = await api.getServices(true); // Get only active services
    const services = servicesResult.data || [];

    // Update the service type dropdown
    const serviceTypeSelect = document.getElementById('serviceType');
    serviceTypeSelect.innerHTML = services.map(service =>
      `<option value="${service.service_type}">${service.icon_emoji} ${service.display_name}</option>`
    ).join('');

    if (services.length === 0) {
      alert('No active services available. Please add a service first.');
      return;
    }

    modal.classList.add('show');
  } catch (error) {
    alert('Failed to load services: ' + error.message);
  }
}

function openAddUserModal() {
  const modal = document.getElementById('addUserModal');
  modal.classList.add('show');
}

async function openAssignAccountsModal(userId) {
  const modal = document.getElementById('assignAccountsModal');
  const listContainer = document.getElementById('assignAccountsList');

  try {
    // Get all accounts and user's current accounts
    const [allAccountsResponse, userAccountsResponse] = await Promise.all([
      api.getAccounts(),
      api.getUserAccounts(userId)
    ]);

    const allAccounts = allAccountsResponse.data || [];
    const userAccountIds = (userAccountsResponse.data || []).map(a => a.id);

    listContainer.innerHTML = allAccounts.map(account => `
      <div style="padding: 12px; background: var(--surface-light); border-radius: 8px; margin-bottom: 8px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" value="${account.id}" ${userAccountIds.includes(account.id) ? 'checked' : ''}
                 style="margin-right: 10px; width: 18px; height: 18px;">
          <span>${account.service_name} (${account.service_type})</span>
        </label>
      </div>
    `).join('');

    // Store userId for later use
    modal.dataset.userId = userId;
    modal.classList.add('show');
  } catch (error) {
    console.error('Error loading assign accounts modal:', error);
    alert('Failed to load accounts: ' + error.message);
  }
}

// Close modals
document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.target.closest('.modal').classList.remove('show');
  });
});

// Add account form
document.getElementById('addAccountForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = {
    service_name: document.getElementById('accountName').value,
    service_type: document.getElementById('serviceType').value,
    description: document.getElementById('accountDescription').value,
    partition_id: `partition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  try {
    await api.createAccount(formData);
    document.getElementById('addAccountModal').classList.remove('show');
    e.target.reset();
    loadAccounts(); // Reload accounts
  } catch (error) {
    console.error('Error adding account:', error);
    alert('Failed to add account: ' + error.message);
  }
});

// Add user form
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = {
    username: document.getElementById('newUsername').value,
    password: document.getElementById('newPassword').value,
    role: document.getElementById('userRoleSelect').value
  };

  try {
    await api.createUser(formData);
    document.getElementById('addUserModal').classList.remove('show');
    e.target.reset();
    loadUsers(); // Reload users
  } catch (error) {
    console.error('Error adding user:', error);
    alert('Failed to add user: ' + error.message);
  }
});

// Save account assignments
document.getElementById('saveAssignments').addEventListener('click', async () => {
  const modal = document.getElementById('assignAccountsModal');
  const userId = modal.dataset.userId;
  const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
  const accountIds = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => parseInt(cb.value));

  try {
    await api.assignAccounts(userId, accountIds);
    modal.classList.remove('show');
    alert('Accounts assigned successfully!');
  } catch (error) {
    console.error('Error assigning accounts:', error);
    alert('Failed to assign accounts: ' + error.message);
  }
});

// Load Services
async function loadServices() {
  contentArea.innerHTML = '<div class="loading">Loading services...</div>';

  try {
    const result = await api.getServices();
    const services = result.data || [];

    contentArea.innerHTML = `
      <div class="page-header">
        <button class="btn btn-primary" id="addServiceBtn">Add Service</button>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Service Type</th>
              <th>Display Name</th>
              <th>Login URL</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="servicesTableBody">
          </tbody>
        </table>
      </div>
    `;

    const tbody = document.getElementById('servicesTableBody');
    if (services.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No services found</td></tr>';
    } else {
      tbody.innerHTML = services.map(service => `
        <tr>
          <td style="font-size: 24px;">${service.icon_emoji || '🌐'}</td>
          <td><code>${service.service_type}</code></td>
          <td>${service.display_name}</td>
          <td><a href="${service.login_url}" target="_blank">${service.login_url}</a></td>
          <td>${service.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}</td>
          <td>
            <button class="btn btn-small btn-primary edit-service-btn" data-id="${service.id}">Edit</button>
            <button class="btn btn-small manage-domains-btn" data-service-type="${service.service_type}">Domains</button>
            <button class="btn btn-small btn-danger delete-service-btn" data-id="${service.id}">Delete</button>
          </td>
        </tr>
      `).join('');

      // Add event listeners
      document.querySelectorAll('.edit-service-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditServiceModal(services.find(s => s.id == btn.dataset.id)));
      });

      document.querySelectorAll('.manage-domains-btn').forEach(btn => {
        btn.addEventListener('click', () => openManageDomainsModal(btn.dataset.serviceType));
      });

      document.querySelectorAll('.delete-service-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteService(btn.dataset.id));
      });
    }

    document.getElementById('addServiceBtn').addEventListener('click', () => {
      document.getElementById('addServiceModal').classList.add('show');
    });
  } catch (error) {
    console.error('Error loading services:', error);
    contentArea.innerHTML = `<div class="empty-state"><p>Error loading services: ${error.message}</p></div>`;
  }
}

// Add Service Modal Handler
document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const serviceData = {
    service_type: document.getElementById('newServiceType').value.trim().toLowerCase(),
    display_name: document.getElementById('serviceDisplayName').value,
    login_url: document.getElementById('serviceLoginUrl').value,
    description: document.getElementById('serviceDescription').value || null,
    icon_emoji: document.getElementById('serviceIcon').value || '🌐'
  };

  try {
    await api.createService(serviceData);
    document.getElementById('addServiceModal').classList.remove('show');
    document.getElementById('addServiceForm').reset();
    loadServices();
  } catch (error) {
    alert('Failed to create service: ' + error.message);
  }
});

// Edit Service Modal
function openEditServiceModal(service) {
  document.getElementById('editServiceId').value = service.id;
  document.getElementById('editServiceDisplayName').value = service.display_name;
  document.getElementById('editServiceLoginUrl').value = service.login_url;
  document.getElementById('editServiceDescription').value = service.description || '';
  document.getElementById('editServiceIcon').value = service.icon_emoji || '';
  document.getElementById('editServiceActive').checked = service.is_active;
  document.getElementById('editServiceModal').classList.add('show');
}

document.getElementById('editServiceForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const serviceId = document.getElementById('editServiceId').value;
  const serviceData = {
    display_name: document.getElementById('editServiceDisplayName').value,
    login_url: document.getElementById('editServiceLoginUrl').value,
    description: document.getElementById('editServiceDescription').value || null,
    icon_emoji: document.getElementById('editServiceIcon').value || '🌐',
    is_active: document.getElementById('editServiceActive').checked
  };

  try {
    await api.updateService(serviceId, serviceData);
    document.getElementById('editServiceModal').classList.remove('show');
    loadServices();
  } catch (error) {
    alert('Failed to update service: ' + error.message);
  }
});

// Delete Service
async function deleteService(serviceId) {
  if (!confirm('Are you sure you want to delete this service? All associated accounts will also be deleted.')) {
    return;
  }

  try {
    await api.deleteService(serviceId);
    loadServices();
  } catch (error) {
    alert('Failed to delete service: ' + error.message);
  }
}

// Manage Domains Modal
let currentServiceType = null;

async function openManageDomainsModal(serviceType) {
  currentServiceType = serviceType;
  document.getElementById('manageDomainsModal').classList.add('show');

  try {
    const result = await api.getServiceDomains(serviceType);
    const domains = result.data || [];

    const domainsList = document.getElementById('domainsList');
    if (domains.length === 0) {
      domainsList.innerHTML = '<p class="empty-state">No domains configured for this service</p>';
    } else {
      domainsList.innerHTML = `
        <h3>Allowed Domains for ${serviceType}</h3>
        <ul class="domains-list">
          ${domains.map(d => `
            <li>
              <span>${d.domain}</span>
              <button class="btn btn-small btn-danger delete-domain-btn" data-id="${d.id}">Remove</button>
            </li>
          `).join('')}
        </ul>
      `;

      document.querySelectorAll('.delete-domain-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api.deleteServiceDomain(btn.dataset.id);
            openManageDomainsModal(serviceType); // Refresh
          } catch (error) {
            alert('Failed to delete domain: ' + error.message);
          }
        });
      });
    }
  } catch (error) {
    document.getElementById('domainsList').innerHTML = `<p class="error">Error loading domains: ${error.message}</p>`;
  }
}

document.getElementById('addDomainForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const domain = document.getElementById('newDomain').value.trim();

  try {
    await api.addServiceDomain(currentServiceType, domain);
    document.getElementById('newDomain').value = '';
    openManageDomainsModal(currentServiceType); // Refresh
  } catch (error) {
    alert('Failed to add domain: ' + error.message);
  }
});

// Add Chat Lock Form
document.getElementById('addChatLockForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const accountId = document.getElementById('lockAccountId').value;
  const chatIdInput = document.getElementById('lockChatId').value;
  const userId = document.getElementById('lockUserId').value;

  // Get account to determine service type
  const accountsResult = await api.getAccounts();
  const account = (accountsResult.data || []).find(a => a.id == accountId);

  if (!account) {
    alert('Selected account not found');
    return;
  }

  // Extract chat ID from input (handles both URLs and direct IDs)
  const chatId = extractChatIdFromInput(chatIdInput, account.service_type);

  console.log('Creating chat lock:', { accountId, chatId, userId, serviceType: account.service_type });

  try {
    await api.createChatLock({
      account_id: accountId,
      chat_id: chatId,
      user_id: userId
    });

    document.getElementById('addChatLockModal').classList.remove('show');
    document.getElementById('addChatLockForm').reset();
    alert(`✅ Chat locked successfully!\n\nChat ID: ${chatId}\nOnly the selected user and admins can access this chat.`);
    loadChatLock(); // Reload
  } catch (error) {
    alert('Failed to create chat lock: ' + error.message);
  }
});

// Session Sync Functions
async function performSessionSync() {
  try {
    console.log('🔄 [Dashboard] Starting session sync...');

    // Show loading state
    const syncBtn = document.getElementById('sessionSyncBtn');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '⏳ Syncing...';
    }

    const result = await api.sessionFullSync();
    console.log('✅ [Dashboard] Session sync successful:', result);

    alert('✅ Session sync completed successfully!\n\nYour session has been synchronized across all devices.');

    // Reload accounts to show updated data
    const currentPage = document.querySelector('.nav-item.active')?.getAttribute('data-page');
    if (currentPage === 'accounts') {
      loadAccounts();
    }

  } catch (error) {
    console.error('❌ [Dashboard] Session sync failed:', error);
    alert('❌ Session sync failed:\n\n' + error.message);
  } finally {
    // Reset button state
    const syncBtn = document.getElementById('sessionSyncBtn');
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '🔄 Sync Session';
    }
  }
}

async function validateSession() {
  try {
    console.log('🔍 [Dashboard] Validating session...');

    const result = await api.sessionValidate();
    console.log('✅ [Dashboard] Session validation result:', result);

    let message = '🔍 Session Validation Results:\n\n';
    message += `• Session Valid: ${result.is_valid ? '✅ Yes' : '❌ No'}\n`;
    message += `• Needs Sync: ${result.needs_sync ? '⚠️ Yes' : '✅ No'}\n`;
    message += `• Session Exists: ${result.session_exists ? '✅ Yes' : '❌ No'}\n`;
    message += `• Assigned Accounts: ${result.assigned_accounts?.length || 0}\n`;

    if (result.session_machine_id) {
      message += `• Session Machine: ${result.session_machine_id}\n`;
      message += `• Current Machine: ${result.current_machine_id}\n`;
    }

    if (result.needs_sync) {
      message += '\n⚠️ Session needs synchronization. Click "Sync Session" to update.';
    }

    alert(message);

  } catch (error) {
    console.error('❌ [Dashboard] Session validation failed:', error);
    alert('❌ Session validation failed:\n\n' + error.message);
  }
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (confirm('Are you sure you want to logout?')) {
    await api.logout();
    window.ipcRenderer.send('logout');
  }
});

// Show notification to user
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 10000;
    font-size: 14px;
    max-width: 300px;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;

  // Add icon based on type
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  notification.innerHTML = `${icons[type]} ${message}`;

  // Add to document
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 100);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);

  console.log(`[Notification ${type.toUpperCase()}] ${message}`);
}

// Utility function to format dates
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// ========================================
// DEPLOYMENT MANAGEMENT
// ========================================

let deploymentConfig = {};
let deploymentInProgress = false;
let deploymentLog = [];

// Load Deployment Page
async function loadDeployment() {
  contentArea.innerHTML = '<div class="loading">Loading deployment...</div>';

  try {
    // Get saved config
    const configResult = await window.ipcRenderer.invoke('deployment-get-config');
    if (configResult.success) {
      deploymentConfig = configResult.config;
    }

    contentArea.innerHTML = `
      <div class="deployment-container">
        <div class="deployment-header">
          <div class="deployment-status">
            <h2>🚀 Single Session Per IP Deployment</h2>
            <div id="deploymentStatusBadge" class="status-badge ready">Ready</div>
          </div>
          <button id="deployBtn" class="btn btn-primary" onclick="startDeployment()">
            <i>🚀</i> Deploy to Server
          </button>
        </div>

        <div class="deployment-tabs">
          <button class="tab-btn active" onclick="showTab('config')">Configuration</button>
          <button class="tab-btn" onclick="showTab('progress')">Progress</button>
          <button class="tab-btn" onclick="showTab('logs')">Logs</button>
        </div>

        <div id="configTab" class="tab-content active">
          <div class="config-form">
            <h3>Server Configuration</h3>
            <div class="form-grid">
              <div class="form-group">
                <label for="sshHost">Server Host/IP</label>
                <input type="text" id="sshHost" value="${deploymentConfig.host || ''}" placeholder="example.com or 192.168.1.100">
              </div>
              <div class="form-group">
                <label for="sshUsername">SSH Username</label>
                <input type="text" id="sshUsername" value="${deploymentConfig.username || ''}" placeholder="root or username">
              </div>
              <div class="form-group">
                <label for="sshPort">SSH Port</label>
                <input type="number" id="sshPort" value="${deploymentConfig.port || 22}" placeholder="22">
              </div>
              <div class="form-group">
                <label for="sshPassword">SSH Password</label>
                <input type="password" id="sshPassword" placeholder="Enter password">
              </div>
              <div class="form-group">
                <label for="remotePath">Remote Path</label>
                <input type="text" id="remotePath" value="${deploymentConfig.remotePath || '/var/www/html/wokushop-api'}" placeholder="/var/www/html/wokushop-api">
              </div>
              <div class="form-group">
                <label for="dbName">Database Name</label>
                <input type="text" id="dbName" value="${deploymentConfig.dbName || ''}" placeholder="wokushop_db">
              </div>
              <div class="form-group">
                <label for="dbUser">Database User</label>
                <input type="text" id="dbUser" value="${deploymentConfig.dbUser || ''}" placeholder="db_username">
              </div>
              <div class="form-group">
                <label for="dbPassword">Database Password</label>
                <input type="password" id="dbPassword" placeholder="Enter DB password">
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" onclick="testConnection()">
                <i>🔍</i> Test Connection
              </button>
              <button class="btn btn-success" onclick="saveConfig()">
                <i>💾</i> Save Config
              </button>
            </div>
          </div>

          <div class="deployment-info">
            <h3>📋 What will be deployed:</h3>
            <ul>
              <li>✅ Database migrations (3 files)</li>
              <li>✅ Backend core classes (IP Helper, Session Manager)</li>
              <li>✅ Authentication files (Updated login, Force login)</li>
              <li>✅ File permissions setup</li>
              <li>✅ Database schema updates</li>
            </ul>
            <p><strong>⏱️ Estimated time:</strong> 5-10 minutes</p>
            <p><strong>🔒 IP Detection:</strong> Tự động lấy IP từ client và server</p>
          </div>
        </div>

        <div id="progressTab" class="tab-content">
          <div class="progress-container">
            <div class="progress-header">
              <h3>Deployment Progress</h3>
              <div id="progressPercent">0%</div>
            </div>
            <div class="progress-bar">
              <div id="progressFill" class="progress-fill" style="width: 0%"></div>
            </div>
            <div id="progressStatus" class="progress-status">Ready to deploy</div>

            <div class="progress-steps">
              <div class="step" id="step1"><i>🔌</i> Connect SSH</div>
              <div class="step" id="step2"><i>💾</i> Create Backups</div>
              <div class="step" id="step3"><i>🗄️</i> Upload Migrations</div>
              <div class="step" id="step4"><i>⚙️</i> Upload Backend</div>
              <div class="step" id="step5"><i>🔐</i> Upload Auth Files</div>
              <div class="step" id="step6"><i>🔧</i> Set Permissions</div>
              <div class="step" id="step7"><i>🗄️</i> Run Migrations</div>
              <div class="step" id="step8"><i>✅</i> Verify</div>
            </div>
          </div>
        </div>

        <div id="logsTab" class="tab-content">
          <div class="logs-container">
            <div class="logs-header">
              <h3>Deployment Logs</h3>
              <button class="btn btn-secondary btn-small" onclick="clearLogs()">
                <i>🗑️</i> Clear
              </button>
            </div>
            <div id="deploymentLogs" class="logs-output">
              <div class="log-entry info">
                <span class="log-time">${new Date().toLocaleTimeString()}</span>
                <span class="log-type">INFO</span>
                <span class="log-message">Deployment system ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Check deployment status
    checkDeploymentStatus();

  } catch (error) {
    console.error('Error loading deployment:', error);
    contentArea.innerHTML = `<div class="empty-state"><p>Error loading deployment: ${error.message}</p></div>`;
  }
}

// Show specific tab
function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(tabName + 'Tab').classList.add('active');
  event.target.classList.add('active');
}

// Test SSH connection
async function testConnection() {
  const config = gatherConfig();

  if (!validateConfig(config)) {
    return;
  }

  try {
    showNotification('Testing SSH connection...', 'info');

    const result = await window.ipcRenderer.invoke('deployment-test-connection', config);

    if (result.success) {
      showNotification('✅ SSH connection successful!', 'success');
    } else {
      showNotification(`❌ Connection failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showNotification(`❌ Connection test error: ${error.message}`, 'error');
  }
}

// Save configuration
function saveConfig() {
  const config = gatherConfig();

  if (!validateConfig(config, false)) {
    return;
  }

  deploymentConfig = config;
  showNotification('✅ Configuration saved!', 'success');
}

// Gather config from form
function gatherConfig() {
  return {
    host: document.getElementById('sshHost').value.trim(),
    username: document.getElementById('sshUsername').value.trim(),
    port: parseInt(document.getElementById('sshPort').value) || 22,
    password: document.getElementById('sshPassword').value,
    remotePath: document.getElementById('remotePath').value.trim(),
    dbName: document.getElementById('dbName').value.trim(),
    dbUser: document.getElementById('dbUser').value.trim(),
    dbPassword: document.getElementById('dbPassword').value
  };
}

// Validate configuration
function validateConfig(config, requirePasswords = true) {
  if (!config.host) {
    showNotification('❌ Server host is required', 'error');
    return false;
  }

  if (!config.username) {
    showNotification('❌ SSH username is required', 'error');
    return false;
  }

  if (requirePasswords && !config.password) {
    showNotification('❌ SSH password is required', 'error');
    return false;
  }

  if (!config.remotePath) {
    showNotification('❌ Remote path is required', 'error');
    return false;
  }

  if (requirePasswords && (!config.dbName || !config.dbUser)) {
    showNotification('❌ Database credentials are required', 'error');
    return false;
  }

  return true;
}

// Start deployment
async function startDeployment() {
  if (deploymentInProgress) {
    showNotification('⚠️ Deployment already in progress!', 'warning');
    return;
  }

  const config = gatherConfig();

  if (!validateConfig(config)) {
    return;
  }

  try {
    deploymentInProgress = true;
    updateDeploymentStatus('deploying', 'Deployment in progress...');

    // Switch to progress tab
    showTab('progress');

    // Clear logs
    deploymentLog = [];

    // Setup event listeners for progress and logs
    window.ipcRenderer.on('deployment-progress', (event, data) => {
      updateProgress(data.progress, data.status);
    });

    window.ipcRenderer.on('deployment-log', (event, logEntry) => {
      addLogEntry(logEntry);
    });

    showNotification('🚀 Starting deployment...', 'info');

    const result = await window.ipcRenderer.invoke('deployment-start', config);

    // Remove event listeners
    window.ipcRenderer.removeAllListeners('deployment-progress');
    window.ipcRenderer.removeAllListeners('deployment-log');

    if (result.success) {
      updateDeploymentStatus('success', 'Deployment completed successfully!');
      showNotification('🎉 Deployment completed successfully!', 'success');
      updateProgress(100, 'Deployment completed successfully!');
    } else {
      updateDeploymentStatus('error', 'Deployment failed');
      showNotification(`❌ Deployment failed: ${result.error}`, 'error');
    }

  } catch (error) {
    updateDeploymentStatus('error', 'Deployment error');
    showNotification(`❌ Deployment error: ${error.message}`, 'error');
  } finally {
    deploymentInProgress = false;
  }
}

// Update deployment status
function updateDeploymentStatus(status, message) {
  const statusBadge = document.getElementById('deploymentStatusBadge');
  const deployBtn = document.getElementById('deployBtn');

  if (statusBadge) {
    statusBadge.className = `status-badge ${status}`;
    statusBadge.textContent = message;
  }

  if (deployBtn) {
    deployBtn.disabled = deploymentInProgress;
    deployBtn.innerHTML = deploymentInProgress ?
      '<i>⏳</i> Deploying...' :
      '<i>🚀</i> Deploy to Server';
  }
}

// Update progress
function updateProgress(percent, status) {
  const progressFill = document.getElementById('progressFill');
  const progressPercent = document.getElementById('progressPercent');
  const progressStatus = document.getElementById('progressStatus');

  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (progressStatus) progressStatus.textContent = status;

  // Update step indicators
  const stepThresholds = [10, 20, 30, 50, 70, 80, 90, 95];
  stepThresholds.forEach((threshold, index) => {
    const step = document.getElementById(`step${index + 1}`);
    if (step && percent >= threshold) {
      step.classList.add('completed');
    }
  });
}

// Add log entry
function addLogEntry(logEntry) {
  deploymentLog.push(logEntry);

  const logsOutput = document.getElementById('deploymentLogs');
  if (logsOutput) {
    const logElement = document.createElement('div');
    logElement.className = `log-entry ${logEntry.type}`;
    logElement.innerHTML = `
      <span class="log-time">${logEntry.timestamp}</span>
      <span class="log-type">${logEntry.type.toUpperCase()}</span>
      <span class="log-message">${logEntry.message}</span>
    `;

    logsOutput.appendChild(logElement);
    logsOutput.scrollTop = logsOutput.scrollHeight;
  }
}

// Clear logs
function clearLogs() {
  deploymentLog = [];
  const logsOutput = document.getElementById('deploymentLogs');
  if (logsOutput) {
    logsOutput.innerHTML = `
      <div class="log-entry info">
        <span class="log-time">${new Date().toLocaleTimeString()}</span>
        <span class="log-type">INFO</span>
        <span class="log-message">Logs cleared</span>
      </div>
    `;
  }
}

// Check deployment status on load
async function checkDeploymentStatus() {
  try {
    const status = await window.ipcRenderer.invoke('deployment-status');

    if (status.inProgress) {
      deploymentInProgress = true;
      updateDeploymentStatus('deploying', 'Deployment in progress...');
    } else {
      deploymentInProgress = false;
      updateDeploymentStatus('ready', 'Ready');
    }

    // Load existing logs
    if (status.log && status.log.length > 0) {
      status.log.forEach(logEntry => {
        addLogEntry(logEntry);
      });
    }

  } catch (error) {
    console.error('Error checking deployment status:', error);
  }
}

// Load initial page
loadDashboard();
