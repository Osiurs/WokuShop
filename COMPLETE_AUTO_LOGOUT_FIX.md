# Hướng Dẫn Hoàn Chỉnh: Fix Auto Logout

## 🎯 Mục Tiêu
Login thiết bị B → Thiết bị A **tự động logout** khi click/action bất kỳ

---

## 📋 Cần Làm 2 Việc

### ✅ Bước 1: Backend - Check Session Database
### ✅ Bước 2: Frontend - Axios Interceptor

---

# BƯỚC 1: Upload Backend File

## 📂 File Cần Upload

### File 1: `auth-updated.php` → Đổi tên thành `auth.php`

**Vị trí local:**
```
C:\Users\ADMIN\OneDrive\Documents\job\WokuShop\wokushop-api\config\auth-updated.php
```

**Vị trí server:**
```
/public_html/api/wokushop-api/config/auth.php
```

---

## 🚀 Cách Upload

### Option A: FTP/FileZilla

1. Mở FileZilla
2. Connect tới `db.handymancode.com`
3. Navigate tới: `/public_html/api/wokushop-api/config/`
4. **Backup file cũ:**
   - Right-click `auth.php`
   - Rename → `auth.php.backup-20250124`
5. **Upload file mới:**
   - Drag & drop `auth-updated.php` vào thư mục
6. **Rename:**
   - Right-click `auth-updated.php`
   - Rename → `auth.php`

### Option B: cPanel File Manager

1. Login cPanel
2. Open File Manager
3. Navigate to: `public_html/api/wokushop-api/config/`
4. **Backup:**
   - Select `auth.php`
   - Click "Copy"
   - Name: `auth.php.backup-20250124`
5. **Upload:**
   - Click "Upload"
   - Select `auth-updated.php`
6. **Rename:**
   - Select `auth-updated.php`
   - Click "Rename" → `auth.php`

---

## 🔍 Verify Backend Uploaded

Test API để kiểm tra:

```bash
# Test 1: Login với token cũ (session đã logout)
curl -X GET "https://db.handymancode.com/api/wokushop-api/accounts/list.php" \
  -H "X-Auth-Token: your-old-token-here"
```

**Kết quả mong đợi:**
```json
{
  "success": false,
  "message": "Session has been terminated. You may have logged in on another device.",
  "reason": "session_terminated"
}
```

**Nếu trả về data accounts** → File chưa upload đúng!

---

# BƯỚC 2: Update Frontend

## 📂 File Cần Sửa

**File:** `wokushop-account-manager/src/assets/js/api.js`

---

## 🔧 Code Cần Thêm

### TÌM (khoảng dòng 11-14):
```javascript
class API {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = this.getStoredToken();
  }
```

### THAY BẰNG:
```javascript
class API {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = this.getStoredToken();
    this.setupInterceptors(); // ⭐ THÊM DÒNG NÀY
  }

  /**
   * Setup Axios interceptors to handle session termination
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
              '⚠️ Phiên đăng nhập đã hết hạn\n\n' +
              (errorData.message || 'Bạn đã đăng nhập trên thiết bị khác.') +
              '\n\nBạn sẽ được chuyển về trang đăng nhập.'
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
  }
```

---

## 📝 Các Bước Thực Hiện

1. **Đóng ứng dụng Woku App**

2. **Mở file:**
   ```
   wokushop-account-manager/src/assets/js/api.js
   ```

3. **Tìm constructor của class API** (dòng 11-14)

4. **Thêm `this.setupInterceptors();`** vào constructor

5. **Thêm method `setupInterceptors()`** (copy code ở trên)

6. **Lưu file**

7. **Khởi động lại app**

---

# TEST HOÀN CHỈNH

## 🧪 Scenario Test

### Setup:
- Thiết bị A: Windows PC
- Thiết bị B: Laptop khác hoặc browser khác

### Test Steps:

1. **Thiết bị A:**
   - Mở Woku App
   - Login với user `minh`
   - Vào Dashboard
   - **Để yên, không click gì**

2. **Thiết bị B:**
   - Mở Woku App
   - Login với user `minh`
   - **Kết quả mong đợi:**
     - ✅ Login thành công
     - ✅ KHÔNG có lỗi "already has session"

3. **Thiết bị A:**
   - Click vào **"Tài Khoản"** hoặc bất kỳ menu nào
   - **Kết quả mong đợi (SAU 1-2 giây):**
     - ✅ Popup hiện: "⚠️ Phiên đăng nhập đã hết hạn..."
     - ✅ Tự động logout
     - ✅ Chuyển về trang login

---

## 🔍 Debug

### Check Console Logs

**Thiết bị A - Khi logout tự động:**
```
⚠️ [Auto Logout] Session terminated - logged in elsewhere
```

### Check Network

**DevTools → Network → Click vào API call bất kỳ:**

Response sẽ là:
```json
{
  "success": false,
  "message": "Session has been terminated. You may have logged in on another device.",
  "reason": "session_terminated"
}
```

Status Code: `401 Unauthorized`

---

## ⚠️ Troubleshooting

### Vấn đề 1: Thiết bị A không logout

**Kiểm tra:**
1. File `auth.php` đã upload chưa?
   ```bash
   # Check trên server
   head -50 /path/to/config/auth.php | grep "isSessionActive"
   ```
   Phải thấy method `isSessionActive()`

2. Frontend đã thêm interceptor chưa?
   - Check trong `api.js` có method `setupInterceptors()` không

3. Clear cache và restart app

### Vấn đề 2: Login thiết bị B vẫn báo lỗi "already has session"

**Kiểm tra:**
1. File `login.php` đã upload chưa?
2. Check logs trên server xem có call `forceLogoutAllUserSessions()` không

### Vấn đề 3: Logout liên tục

**Kiểm tra:**
1. Database có session record không?
   ```sql
   SELECT * FROM sessions WHERE user_id = 1 AND is_active = TRUE;
   ```
2. Check session_config.php strategy = 'strict'

---

## 📊 Flow Hoàn Chỉnh

```
[Thiết bị A] Login minh ✅
  ↓
  Session A created in DB
  Token: abc123

[Thiết bị B] Login minh ✅
  ↓
  Backend: forceLogoutAllUserSessions() → Session A = inactive
  Session B created in DB
  Token: xyz789

[Thiết bị A] Click "Tài Khoản"
  ↓
  API call: GET /accounts/list.php
  Header: X-Auth-Token: abc123
  ↓
  Backend auth.php:
    1. Check JWT abc123 → Valid
    2. Check session in DB → INACTIVE! ❌
    3. Return 401 + reason: session_terminated
  ↓
  Frontend axios interceptor:
    1. Catch 401
    2. Check reason === 'session_terminated'
    3. Show popup
    4. Clear token & user
    5. Redirect to login
  ↓
[Thiết bị A] Logout + Popup ✅
```

---

## ✅ Checklist

### Backend:
- [ ] File `auth.php` đã backup
- [ ] File `auth-updated.php` đã upload
- [ ] Đã rename thành `auth.php`
- [ ] Test curl trả về 401 với session cũ

### Frontend:
- [ ] Đã đóng app
- [ ] File `api.js` đã sửa
- [ ] Thêm `this.setupInterceptors()` vào constructor
- [ ] Thêm method `setupInterceptors()`
- [ ] Đã lưu file
- [ ] Restart app

### Test:
- [ ] Login thiết bị A thành công
- [ ] Login thiết bị B thành công (không lỗi)
- [ ] Thiết bị A click menu → popup logout
- [ ] Thiết bị A redirect về login

---

## 🎯 Kết Quả Cuối Cùng

- ✅ Login thiết bị mới → Luôn thành công
- ✅ Thiết bị cũ logout tự động khi có action (1-2 giây)
- ✅ Popup thông báo rõ ràng
- ✅ Không cần check định kỳ
- ✅ Không tốn tài nguyên

---

Làm theo 2 bước trên xong, test lại và báo kết quả nhé!
