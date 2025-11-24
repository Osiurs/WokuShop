# Triển Khai Tính Năng Single Session Per User

## 📋 Tổng Quan

Triển khai tính năng **Single Session Per User** - khi user đăng nhập trên thiết bị mới, thiết bị cũ sẽ tự động logout.

## ✅ Đã Hoàn Thành

### 1. Backend API - Check Session
**File đã tạo:** `wokushop-api/auth/check-session.php`

API endpoint này:
- Kiểm tra session token có còn valid không
- Trả về thông tin session nếu còn active
- Trả về `valid: false` nếu session đã bị logout (login trên thiết bị khác)

## 🔧 Cần Triển Khai

### Bước 1: Thêm Method vào `api.js`

**File:** `wokushop-account-manager/src/assets/js/api.js`

**THÊM method này vào cuối class API (trước dòng `}` cuối cùng của class, khoảng dòng 554):**

```javascript
  /**
   * Check if current session is still valid
   * Returns true if valid, false if session has been terminated (logged in elsewhere)
   */
  async checkSession() {
    try {
      if (!this.token) {
        return { valid: false, reason: 'no_token' };
      }

      const response = await axios.get(`${this.baseURL}/auth/check-session.php`, {
        headers: this.getAuthHeaders()
      });

      return {
        valid: response.data.valid,
        session_info: response.data.session_info
      };
    } catch (error) {
      // If 401, session is invalid (logged out on another device)
      if (error.response && error.response.status === 401) {
        return {
          valid: false,
          reason: error.response.data.reason || 'session_invalid',
          message: error.response.data.message
        };
      }

      // Other errors (network issues, etc.)
      console.error('Session check error:', error.message);
      return {
        valid: true, // Assume valid on network errors to avoid false logouts
        error: error.message
      };
    }
  }
```

---

### Bước 2: Thêm Session Check Interval vào `dashboard.js`

**File:** `wokushop-account-manager/src/assets/js/dashboard.js`

**THÊM code sau vào CUỐI FILE (sau dòng `loadDashboard();` hoặc phần load initial page):**

```javascript
// ========================================
// AUTO SESSION CHECK - SINGLE SESSION PER USER
// ========================================

let sessionCheckInterval = null;

/**
 * Start checking session validity periodically
 * If session becomes invalid (logged in elsewhere), auto logout
 */
function startSessionCheck() {
  // Check every 30 seconds
  const CHECK_INTERVAL = 30000; // 30 seconds

  // Clear any existing interval
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }

  // Initial check after 5 seconds
  setTimeout(checkSessionValidity, 5000);

  // Then check periodically
  sessionCheckInterval = setInterval(checkSessionValidity, CHECK_INTERVAL);

  console.log('✅ [Session Check] Started - checking every 30 seconds');
}

/**
 * Check if current session is still valid
 */
async function checkSessionValidity() {
  try {
    const result = await api.checkSession();

    if (!result.valid) {
      console.warn('⚠️ [Session Check] Session is no longer valid:', result.reason);
      console.warn('Message:', result.message);

      // Stop checking
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
      }

      // Show alert to user
      alert(
        '⚠️ Phiên đăng nhập đã hết hạn\n\n' +
        (result.message || 'Bạn có thể đã đăng nhập trên thiết bị khác.') +
        '\n\nBạn sẽ được chuyển về trang đăng nhập.'
      );

      // Logout and redirect
      await api.logout();
      window.ipcRenderer.send('logout');
    } else {
      console.log('✅ [Session Check] Session is valid');
    }
  } catch (error) {
    console.error('❌ [Session Check] Error:', error.message);
    // Don't logout on check errors to avoid false logouts
  }
}

/**
 * Stop session checking (called on logout)
 */
function stopSessionCheck() {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
    console.log('🛑 [Session Check] Stopped');
  }
}

// Start session checking when dashboard loads
startSessionCheck();

// Make sure to stop checking when user logs out
const originalLogoutBtn = document.getElementById('logoutBtn');
if (originalLogoutBtn) {
  originalLogoutBtn.addEventListener('click', stopSessionCheck);
}
```

---

## 📝 Các Bước Triển Khai

### 1. **Đóng ứng dụng Woku App**

### 2. **Sửa file `api.js`**
- Mở file: `wokushop-account-manager/src/assets/js/api.js`
- Tìm dòng 554 (hoặc tìm dòng `}` cuối cùng của class API)
- Thêm method `checkSession()` như trên (trước dòng `}` cuối)

### 3. **Sửa file `dashboard.js`**
- Mở file: `wokushop-account-manager/src/assets/js/dashboard.js`
- Kéo xuống cuối file
- Thêm toàn bộ code "Auto Session Check" như trên

### 4. **Upload file PHP lên server**
- File: `wokushop-api/auth/check-session.php` (đã tạo sẵn)
- Upload lên server tại: `https://db.handymancode.com/api/wokushop-api/auth/check-session.php`

### 5. **Khởi động lại ứng dụng và test**

---

## 🧪 Cách Test

### Test Case 1: Logout Tự Động Khi Login Trên Thiết Bị Khác

1. **Thiết bị A:**
   - Mở Woku App
   - Đăng nhập với user `test1`
   - Vào trang Dashboard/Accounts

2. **Thiết bị B:**
   - Mở Woku App (hoặc browser khác)
   - Đăng nhập với cùng user `test1`

3. **Kết quả mong đợi:**
   - Thiết bị B login thành công
   - Sau **30 giây**, thiết bị A sẽ hiện popup:
     ```
     ⚠️ Phiên đăng nhập đã hết hạn

     Bạn có thể đã đăng nhập trên thiết bị khác.

     Bạn sẽ được chuyển về trang đăng nhập.
     ```
   - Thiết bị A tự động logout và về trang login

### Test Case 2: Không Logout Khi Session Còn Valid

1. Đăng nhập trên 1 thiết bị duy nhất
2. Sử dụng bình thường
3. Không thấy popup logout
4. Console log sẽ hiện: `✅ [Session Check] Session is valid` mỗi 30 giây

---

## ⚙️ Cấu Hình

### Thay Đổi Tần Suất Check

Trong file `dashboard.js`, tìm dòng:
```javascript
const CHECK_INTERVAL = 30000; // 30 seconds
```

Thay đổi giá trị (đơn vị: milliseconds):
- `15000` = 15 giây (check nhanh hơn, tốn tài nguyên hơn)
- `30000` = 30 giây (khuyến nghị)
- `60000` = 60 giây (check chậm hơn, tiết kiệm tài nguyên)

---

## 🔍 Debug & Troubleshooting

### Kiểm tra Session Check đang chạy

Mở DevTools Console (F12), bạn sẽ thấy log:
```
✅ [Session Check] Started - checking every 30 seconds
✅ [Session Check] Session is valid
✅ [Session Check] Session is valid
...
```

### Kiểm tra API hoạt động

Test trực tiếp API trong browser console:
```javascript
api.checkSession().then(r => console.log(r));
```

Kết quả mong đợi:
```javascript
{
  valid: true,
  session_info: {
    user_id: 1,
    username: "test1",
    role: "admin",
    ...
  }
}
```

### Lỗi thường gặp

**1. Session check không chạy:**
- Kiểm tra console có lỗi JavaScript không
- Đảm bảo đã thêm đúng code vào cuối file dashboard.js

**2. Logout liên tục:**
- Kiểm tra API endpoint `check-session.php` đã upload chưa
- Test API trực tiếp: `https://db.handymancode.com/api/wokushop-api/auth/check-session.php`

**3. Không logout khi login thiết bị khác:**
- Kiểm tra session strategy = `STRATEGY_STRICT` trong `session-config.php`
- Kiểm tra `forceLogoutAllUserSessions()` được gọi trong `login.php`

---

## ✅ Checklist Triển Khai

- [ ] File `check-session.php` đã được upload lên server
- [ ] Method `checkSession()` đã thêm vào `api.js`
- [ ] Code session check interval đã thêm vào `dashboard.js`
- [ ] Đã test với 2 thiết bị
- [ ] Console log hiện "Session Check Started"
- [ ] Thiết bị cũ tự động logout khi login thiết bị mới

---

## 📊 Cách Hoạt Động

```
┌─────────────┐                    ┌─────────────┐
│  Thiết bị A │                    │  Thiết bị B │
│  (test1)    │                    │             │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ 1. Login test1                   │
       │────────────────────►             │
       │    [Session ID: ABC]             │
       │                                  │
       │                                  │ 2. Login test1
       │                                  │────────────────────►
       │                                  │    [Session ID: XYZ]
       │                                  │    Force logout ABC
       │                                  │
       │ 3. Check session (after 30s)    │
       │────────────────────►             │
       │    ← Invalid (ABC logged out)   │
       │                                  │
       │ 4. Auto logout                   │
       │    Show popup                    │
       │    Redirect to login             │
       └─────────────────────────────────┘
```

---

## 🎯 Kết Luận

Sau khi triển khai xong:
- ✅ Mỗi user chỉ login được 1 thiết bị tại 1 thời điểm
- ✅ Login thiết bị mới → logout tự động thiết bị cũ (sau 30s)
- ✅ User được thông báo rõ ràng tại sao bị logout
- ✅ Không ảnh hưởng đến trải nghiệm nếu chỉ dùng 1 thiết bị

Bất kỳ câu hỏi nào, hãy hỏi!
