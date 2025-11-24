/**
 * Script to add axios interceptor to api.js
 * Run: node fix-api-interceptor.js
 */

const fs = require('fs');
const path = require('path');

const apiFilePath = path.join(__dirname, 'wokushop-account-manager/src/assets/js/api.js');

console.log('Reading api.js...');
let content = fs.readFileSync(apiFilePath, 'utf8');

// Check if already has setupInterceptors
if (content.includes('setupInterceptors')) {
  console.log('✅ api.js already has setupInterceptors method');
  process.exit(0);
}

console.log('❌ setupInterceptors not found, adding it...');

// Find the constructor
const constructorPattern = /constructor\(\) \{[\s\S]*?this\.token = this\.getStoredToken\(\);[\s\S]*?\}/;

const newConstructor = `constructor() {
    this.baseURL = API_BASE_URL;
    this.token = this.getStoredToken();
    this.setupInterceptors(); // Setup axios interceptor for auto logout
  }

  /**
   * Setup Axios interceptors to handle session termination
   * When session is terminated (logged in elsewhere), auto logout
   */
  setupInterceptors() {
    // Response interceptor to catch 401 (session invalid)
    axios.interceptors.response.use(
      (response) => {
        // Pass through successful responses
        return response;
      },
      (error) => {
        // Check if error is 401 and session was terminated
        if (error.response && error.response.status === 401) {
          const errorData = error.response.data;

          // Check if it's a session termination (not just wrong password)
          if (errorData && errorData.reason === 'session_terminated') {
            console.warn('⚠️ [Auto Logout] Session terminated - logged in elsewhere');

            // Show alert to user
            alert(
              '⚠️ Phiên đăng nhập đã hết hạn\\n\\n' +
              (errorData.message || 'Bạn đã đăng nhập trên thiết bị khác.') +
              '\\n\\nBạn sẽ được chuyển về trang đăng nhập.'
            );

            // Clear local data
            this.clearStoredToken();
            this.clearCurrentUser();

            // Redirect to login
            if (window.ipcRenderer) {
              window.ipcRenderer.send('navigate-to-login');
            }
          }
        }

        // Reject the promise for other errors
        return Promise.reject(error);
      }
    );
  }`;

// Replace constructor
content = content.replace(constructorPattern, newConstructor);

// Backup original file
const backupPath = apiFilePath + '.backup-' + Date.now();
fs.writeFileSync(backupPath, fs.readFileSync(apiFilePath));
console.log('✅ Backup created:', backupPath);

// Write new content
fs.writeFileSync(apiFilePath, content);
console.log('✅ api.js updated successfully!');
console.log('');
console.log('Next steps:');
console.log('1. Restart the app (npm start)');
console.log('2. Test with 2 devices');
console.log('3. Device A should auto logout when device B logs in');
