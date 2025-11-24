# Triển Khai Auto Logout Đơn Giản (Axios Interceptor)

## 🎯 Cách Hoạt Động

Khi login thiết bị B → Backend force logout session thiết bị A
→ Thiết bị A gọi bất kỳ API nào (load accounts, click button, etc.)
→ Server trả về 401 (Unauthorized)
→ Axios interceptor bắt 401 → Auto logout + thông báo

## 📝 Code Cần Thêm

### File: `wokushop-account-manager/src/assets/js/api.js`

**TÌM dòng này (khoảng dòng 11-14):**
```javascript
class API {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = this.getStoredToken();
  }
```

**THAY BẰNG:**
```javascript
class API {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = this.getStoredToken();
    this.setupInterceptors();
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

## ✅ Xong! Chỉ Cần Sửa 1 Chỗ

Sau khi thêm code trên, tính năng sẽ hoạt động như sau:

### 📊 Flow Hoạt Động

```
[Thiết bị A] - Login test1 ✅
    ↓
[Thiết bị B] - Login test1 ✅ → Backend force logout session A
    ↓
[Thiết bị A] - User click "Tài Khoản" hoặc bất kỳ action nào
    ↓
    API call → Server trả về 401 (session_terminated)
    ↓
    Axios interceptor bắt 401
    ↓
    ✅ Hiện popup thông báo
    ✅ Clear token & user data
    ✅ Redirect về login
```

---

## 🧪 Test

### Scenario Test:

1. **Thiết bị A**: Login với `test1`
2. **Thiết bị B**: Login với `test1`
3. **Thiết bị A**: Click vào "Tài Khoản" hoặc bất kỳ menu nào
4. **Kết quả**:
   - Popup hiện: "⚠️ Phiên đăng nhập đã hết hạn..."
   - Tự động logout
   - Chuyển về trang login

---

## 🔍 Backend Cần Có

Backend cần đảm bảo khi session invalid, trả về 401 với `reason: 'session_terminated'`.

### Kiểm tra file `auth.php` hoặc middleware

Đảm bảo khi check session invalid, response như này:

```php
// Example response when session is invalid
http_response_code(401);
echo json_encode([
    "success" => false,
    "message" => "Session has been terminated. You may have logged in on another device.",
    "reason" => "session_terminated"
]);
```

---

## 💡 Ưu điểm của cách này

1. ✅ **Không cần check định kỳ** - Tiết kiệm tài nguyên
2. ✅ **Logout gần như ngay lập tức** - Khi user có action bất kỳ
3. ✅ **Cực kỳ đơn giản** - Chỉ 1 đoạn code nhỏ
4. ✅ **Tự động** - Không cần quản lý interval, cleanup, etc.
5. ✅ **Catch all API calls** - Bất kỳ API nào trả 401 đều được xử lý

---

## 📌 Lưu Ý

- Nếu user ở thiết bị A **hoàn toàn idle** (không click gì), sẽ không logout ngay lập tức
- Nhưng **ngay khi user click bất cứ gì** → API call → phát hiện → logout
- Đối với hầu hết trường hợp, user sẽ click/interact trong vài giây, nên logout sẽ xảy ra rất nhanh

---

## 🎯 Kết Luận

**Chỉ cần sửa 1 file, thêm 1 method!**

Sau đó:
- Login thiết bị B → Backend logout session A
- Thiết bị A click bất kỳ đâu → Phát hiện 401 → Auto logout

**Không cần:**
- ❌ Check định kỳ mỗi 30s
- ❌ Interval/setTimeout
- ❌ WebSocket
- ❌ Thêm API endpoint mới

**Backend hiện tại đã đủ!** Chỉ cần frontend handle 401 response.
