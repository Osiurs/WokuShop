// Optimized login script for faster performance
// DOM Elements - cached for better performance
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const alertBox = document.getElementById('alertBox');

// Performance optimizations
let alertTimeout;
let isLoggingIn = false;

// Optimized alert function with debouncing
function showAlert(message, type = 'danger') {
  // Clear existing timeout to prevent multiple alerts
  if (alertTimeout) {
    clearTimeout(alertTimeout);
  }

  alertBox.textContent = message;
  alertBox.className = `alert alert-${type} show`;
  
  alertTimeout = setTimeout(() => {
    alertBox.classList.remove('show');
  }, type === 'success' ? 2000 : 5000); // Shorter success messages
}

// Fast form validation
function validateForm(username, password) {
  if (!username || username.length < 2) {
    showAlert('Username must be at least 2 characters');
    return false;
  }
  if (!password || password.length < 3) {
    showAlert('Password must be at least 3 characters');
    return false;
  }
  return true;
}

// Optimized login handler with debouncing
async function handleLogin(e) {
  e.preventDefault();

  // Prevent multiple concurrent login attempts
  if (isLoggingIn) {
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  // Fast client-side validation
  if (!validateForm(username, password)) {
    return;
  }

  // Set loading state
  isLoggingIn = true;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  loginBtn.classList.add('loading');

  try {
    // Use optimized API for faster login
    const result = await optimizedApi.login(username, password);

    if (result.success) {
      showAlert('Login successful! Redirecting...', 'success');

      // Log activity asynchronously (non-blocking)
      optimizedApi.logActivity('login', {
        username: username,
        timestamp: new Date().toISOString()
      }).catch(() => {}); // Silent fail

      // Immediate navigation (don't wait)
      window.ipcRenderer.send('navigate-to-dashboard');
    } else {
      throw new Error(result.message || 'Login failed');
    }
  } catch (error) {
    let errorMessage = 'Login failed. Please try again.';
    
    if (error.message.includes('Connection')) {
      errorMessage = 'Cannot connect to server. Please check your internet connection.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Login timeout. Please try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    showAlert(errorMessage);
    
    // Reset form state
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
    loginBtn.classList.remove('loading');
    isLoggingIn = false;
  }
}

// Optimized event listeners
loginForm.addEventListener('submit', handleLogin);

// Fast enter key handling
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !isLoggingIn) {
    handleLogin(e);
  }
});

// Auto-focus with slight delay for better UX
setTimeout(() => {
  usernameInput.focus();
}, 100);

// Form auto-completion optimization
usernameInput.addEventListener('input', () => {
  // Clear previous errors when user starts typing
  if (alertBox.classList.contains('show')) {
    alertBox.classList.remove('show');
  }
});

passwordInput.addEventListener('input', () => {
  // Clear previous errors when user starts typing
  if (alertBox.classList.contains('show')) {
    alertBox.classList.remove('show');
  }
});

// Prevent form submission spam
loginForm.addEventListener('submit', (e) => {
  if (isLoggingIn) {
    e.preventDefault();
    e.stopPropagation();
  }
});

// Keyboard shortcuts for better UX
document.addEventListener('keydown', (e) => {
  // Ctrl+Enter for quick login
  if (e.ctrlKey && e.key === 'Enter' && !isLoggingIn) {
    handleLogin(e);
  }
  
  // Escape to clear form
  if (e.key === 'Escape') {
    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.focus();
  }
});

// Preload dashboard resources for faster navigation
window.addEventListener('load', () => {
  // Preload dashboard CSS and JS
  const dashboardCSS = document.createElement('link');
  dashboardCSS.rel = 'preload';
  dashboardCSS.as = 'style';
  dashboardCSS.href = '../assets/css/dashboard.css';
  document.head.appendChild(dashboardCSS);

  const dashboardJS = document.createElement('link');
  dashboardJS.rel = 'preload';
  dashboardJS.as = 'script';
  dashboardJS.href = '../assets/js/dashboard.js';
  document.head.appendChild(dashboardJS);
});

// Connection test on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Quick connection test (non-blocking)
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000); // 3 second timeout

    await fetch(`${optimizedApi.baseURL}/test.php`, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    console.log('✅ Server connection OK');
  } catch (error) {
    console.warn('⚠️ Server connection test failed:', error.message);
    showAlert('Warning: Server connection may be slow', 'warning');
  }
});
