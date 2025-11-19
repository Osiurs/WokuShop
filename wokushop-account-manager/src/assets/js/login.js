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

// Handle login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showAlert('Please enter both username and password');
    return;
  }

  // Disable button and show loading
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const result = await api.login(username, password);

    if (result.success) {
      showAlert('Login successful! Redirecting...', 'success');

      // Log the login activity
      try {
        await api.logActivity('login', {
          username: username,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        // Silently fail activity logging
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
    showAlert('Connection error: ' + (error.message || 'Cannot reach server. Make sure XAMPP is running.'));
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

// Auto-focus username field
usernameInput.focus();
