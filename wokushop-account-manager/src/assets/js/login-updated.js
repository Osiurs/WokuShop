/**
 * Updated Login Script with IP Session Tracking
 * Single Session Per IP Implementation
 *
 * @author Claude Code
 * @date 2025-01-04
 * @version 2.0
 */

// Use ipcRenderer from window (set by api.js)

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const alertBox = document.getElementById('alertBox');

// Show alert message
function showAlert(message, type = 'danger') {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type} show`;
  setTimeout(() => {
    alertBox.classList.remove('show');
  }, 5000);
}

// Handle concurrent session blocking with user-friendly UI
function handleConcurrentSessionError(errorData) {
  console.log('🚫 [Login] Concurrent session detected:', errorData);

  const modal = document.createElement('div');
  modal.className = 'session-conflict-modal';
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>🔒 Session Conflict Detected</h3>
          <p>Your account is already logged in from another device.</p>
        </div>

        <div class="session-details">
          <div class="detail-item">
            <span class="detail-label">🌐 Current IP:</span>
            <span class="detail-value">${errorData.details.existing_ip}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">🕒 Login Since:</span>
            <span class="detail-value">${new Date(errorData.details.existing_since).toLocaleString()}</span>
          </div>
          ${errorData.details.last_activity ? `
          <div class="detail-item">
            <span class="detail-label">⏱️ Last Activity:</span>
            <span class="detail-value">${new Date(errorData.details.last_activity).toLocaleString()}</span>
          </div>
          ` : ''}
        </div>

        <div class="session-explanation">
          <p><strong>What does this mean?</strong></p>
          <p>For security reasons, you can only be logged in from one device at a time. You can either:</p>
        </div>

        <div class="modal-actions">
          <button id="forceLogin" class="btn btn-danger">
            🔥 Force Login
            <small>Logout the other session and login here</small>
          </button>
          <button id="cancelLogin" class="btn btn-secondary">
            ❌ Cancel
            <small>Stay logged out on this device</small>
          </button>
        </div>

        <div class="modal-footer">
          <small>🔐 This security feature prevents unauthorized access to your account.</small>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle force login
  document.getElementById('forceLogin').addEventListener('click', async () => {
    try {
      const forceBtn = document.getElementById('forceLogin');
      forceBtn.disabled = true;
      forceBtn.innerHTML = '🔄 Forcing login...';

      // Call force login API
      const result = await api.forceLogin(usernameInput.value, passwordInput.value);

      if (result.success) {
        document.body.removeChild(modal);
        showAlert('Login successful! Previous session was terminated.', 'success');

        // Show session info if available
        if (result.session_info) {
          console.log('✅ [Session] Force logged in from IP:', result.session_info.ip_address);
          console.log('✅ [Session] Previous session terminated');
        }

        // Log activity
        try {
          await api.logActivity('force_login', {
            username: usernameInput.value,
            ip_address: result.session_info?.ip_address,
            terminated_session: result.session_info?.terminated_session,
            timestamp: new Date().toISOString()
          });
        } catch (logError) {
          console.warn('⚠️ [Login] Activity logging failed (non-blocking)');
        }

        setTimeout(() => {
          window.ipcRenderer.send('navigate-to-dashboard');
        }, 1000);
      }
    } catch (error) {
      console.error('❌ [Login] Force login error:', error);
      showAlert('Force login failed: ' + (error.response?.data?.message || error.message));
      document.getElementById('forceLogin').disabled = false;
      document.getElementById('forceLogin').innerHTML = '🔥 Force Login<small>Try again</small>';
    }
  });

  // Handle cancel
  document.getElementById('cancelLogin').addEventListener('click', () => {
    document.body.removeChild(modal);
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  });

  // Close modal on overlay click
  modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target === modal.querySelector('.modal-overlay')) {
      document.body.removeChild(modal);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });
}

// Handle main login form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showAlert('Please enter both username and password');
    return;
  }

  // Show loading state
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const result = await api.login(username, password);

    if (result.success) {
      showAlert('Login successful! Redirecting...', 'success');

      // Show session info if available
      if (result.session_info) {
        console.log('✅ [Session] Logged in from IP:', result.session_info.ip_address);
        console.log('✅ [Session] Login time:', result.session_info.login_time);
        console.log('✅ [Session] Session ID:', result.session_info.session_id);

        if (result.session_info.reason) {
          console.log('ℹ️ [Session] Reason:', result.session_info.reason);
        }
      }

      // Log activity with session info
      try {
        await api.logActivity('login', {
          username: username,
          ip_address: result.session_info?.ip_address,
          session_id: result.session_info?.session_id,
          user_agent: result.session_info?.user_agent,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.warn('⚠️ [Login] Activity logging failed (non-blocking)');
      }

      // Navigate to dashboard
      setTimeout(() => {
        window.ipcRenderer.send('navigate-to-dashboard');
      }, 1000);

    } else {
      showAlert(result.message || 'Login failed. Please try again.');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }

  } catch (error) {
    console.error('❌ [Login] Login error:', error);

    // Handle specific error cases
    if (error.response?.data?.error_code === 'CONCURRENT_SESSION_BLOCKED') {
      handleConcurrentSessionError(error.response.data);
    } else {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Cannot reach server. Make sure the API is running.';
      showAlert('Connection error: ' + errorMessage);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  }
});

// Auto-focus username field
usernameInput.focus();

// Add CSS for session conflict modal
const modalCSS = `
<style>
.session-conflict-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.modal-overlay {
    background: rgba(0, 0, 0, 0.8);
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(3px);
}

.modal-content {
    background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
    padding: 30px;
    border-radius: 15px;
    max-width: 550px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    border: 1px solid #e9ecef;
    animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-30px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.modal-header h3 {
    color: #dc3545;
    margin: 0 0 10px 0;
    font-size: 1.4em;
    font-weight: 600;
}

.modal-header p {
    color: #6c757d;
    margin: 0 0 20px 0;
    font-size: 1.1em;
}

.session-details {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    margin: 20px 0;
    border-left: 4px solid #ffc107;
}

.detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 8px 0;
    padding: 5px 0;
}

.detail-label {
    font-weight: 600;
    color: #495057;
}

.detail-value {
    color: #dc3545;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    background: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #dee2e6;
}

.session-explanation {
    text-align: left;
    margin: 20px 0;
    padding: 15px;
    background: #e7f3ff;
    border-radius: 8px;
    border-left: 4px solid #0056b3;
}

.session-explanation p {
    margin: 8px 0;
    color: #495057;
}

.session-explanation strong {
    color: #0056b3;
}

.modal-actions {
    display: flex;
    gap: 15px;
    justify-content: center;
    margin: 25px 0 15px 0;
}

.btn {
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1em;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 140px;
}

.btn small {
    font-size: 0.8em;
    font-weight: normal;
    margin-top: 4px;
    opacity: 0.8;
}

.btn-danger {
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(220, 53, 69, 0.3);
}

.btn-danger:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(220, 53, 69, 0.4);
}

.btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

.btn-secondary {
    background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(108, 117, 125, 0.3);
}

.btn-secondary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(108, 117, 125, 0.4);
}

.modal-footer {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #dee2e6;
}

.modal-footer small {
    color: #6c757d;
    font-style: italic;
}
</style>
`;

// Inject CSS into page
document.head.insertAdjacentHTML('beforeend', modalCSS);