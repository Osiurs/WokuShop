// Use ipcRenderer from window (set by api.js)

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');
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
    showAlert('Vui lòng nhập tên đăng nhập và mật khẩu');
    return;
  }

  // Disable button and show loading
  loginBtn.disabled = true;
  loginBtn.textContent = 'Đang đăng nhập...';

  try {
    const result = await api.login(username, password);

    if (result.success) {
      showAlert('Đăng nhập thành công! Đang chuyển hướng...', 'success');

      // Log the login activity
      try {
        await api.logActivity('login', {
          username: username,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        // Silently fail activity logging
      }

      // Handle "Remember me"
      if (rememberMeCheckbox.checked) {
        window.ipcRenderer.sendSync('set-store-value', 'rememberedUsername', username);
        window.ipcRenderer.sendSync('set-store-value', 'rememberedPassword', password);
      } else {
        window.ipcRenderer.sendSync('delete-store-value', 'rememberedUsername');
        window.ipcRenderer.sendSync('delete-store-value', 'rememberedPassword');
      }

      // Navigate to dashboard
      setTimeout(() => {
        window.ipcRenderer.send('navigate-to-dashboard');
      }, 1000);
    } else {
      showAlert(result.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Đăng Nhập';
    }
  } catch (error) {
    showAlert('Lỗi kết nối: ' + (error.message || 'Không thể kết nối máy chủ.'));
    loginBtn.disabled = false;
    loginBtn.textContent = 'Đăng Nhập';
  }
});

// Auto-focus username field
usernameInput.focus();


// On page load, check for a remembered username
document.addEventListener('DOMContentLoaded', () => {
  const rememberedUsername = window.ipcRenderer.sendSync('get-store-value', 'rememberedUsername');
  const rememberedPassword = window.ipcRenderer.sendSync('get-store-value', 'rememberedPassword');

  if (rememberedUsername && rememberedPassword) {
    usernameInput.value = rememberedUsername;
    passwordInput.value = rememberedPassword;
    rememberMeCheckbox.checked = true;
    // If both are filled, focus on the login button for one-click login
    loginBtn.focus();
  } else {
    // Otherwise, focus on username
    usernameInput.focus();
  }
});
