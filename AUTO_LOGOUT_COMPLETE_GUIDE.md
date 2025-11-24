# Hướng Dẫn Hoàn Chỉnh: Auto Logout Khi Login Thiết Bị Khác

## 🎯 Mục Tiêu
Login thiết bị B → Logout tự động thiết bị A **ngay khi thiết bị A có action** (click, load data, etc.)

**KHÔNG dùng:** Check định kỳ, interval, polling

**Cách hoạt động:** Axios Interceptor tự động bắt 401 response

---

## 📋 Cần Sửa 2 File

### 1. Backend: `auth.php`
### 2. Frontend: `api.js`

---

## 🔧 Phần 1: Backend

### File: `wokushop-api/config/auth.php`

**Vấn đề hiện tại:**
- `requireAuth()` chỉ check JWT token valid
- Không check session trong database
- Dù session đã logout, JWT vẫn valid → Không trả 401

**Giải pháp:**
Thêm check session database vào `requireAuth()`

#### Option A: Thay File Hoàn Chỉnh

Tôi đã tạo file mới: `auth-updated.php`

**Các bước:**
1. Backup file cũ: `auth.php` → `auth-backup.php`
2. Đổi tên: `auth-updated.php` → `auth.php`
3. Xong!

#### Option B: Sửa Thủ Công

**TÌM method này trong `auth.php` (khoảng dòng 148):**

```php
// Require authentication
public function requireAuth() {
    $user = $this->verifyToken();
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Unauthorized. Please login."
        ]);
        die();
    }
    return $user;
}
```

**THAY BẰNG:**

```php
// Require authentication
public function requireAuth() {
    $user = $this->verifyToken();
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Unauthorized. Please login."
        ]);
        die();
    }

    // ⭐ NEW: Check if session is still active in database
    $token = $this->getTokenFromHeaders();
    if ($token && !$this->isSessionActive($token)) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Session has been terminated. You may have logged in on another device.",
            "reason" => "session_terminated"
        ]);
        die();
    }

    return $user;
}

// ⭐ NEW: Check if session is still active in database
private function isSessionActive($token) {
    // Check in sessions table (strict strategy)
    $query = "SELECT id FROM sessions WHERE token = :token AND is_active = TRUE LIMIT 1";
    $stmt = $this->db->prepare($query);
    $stmt->execute(['token' => $token]);
    if ($stmt->rowCount() > 0) {
        return true;
    }

    // Check in user_ip_sessions table (ip-based strategy)
    $query = "SELECT id FROM user_ip_sessions WHERE session_token = :token AND is_active = TRUE LIMIT 1";
    $stmt = $this->db->prepare($query);
    $stmt->execute(['token' => $token]);
    return $stmt->rowCount() > 0;
}
```

---

## 🔧 Phần 2: Frontend

### File: `wokushop-account-manager/src/assets/js/api.js`

**TÌM constructor (khoảng dòng 11-14):**

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
    this.setupInterceptors(); // ⭐ NEW
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

## 📊 Cách Hoạt Động

### Flow Chi Tiết:

```
┌─────────────────────────────────────────────────────┐
│  Thiết bị A - Login test1                           │
│  ✅ Session ID: ABC, JWT Token: xyz123             │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ User đang dùng bình thường
                  │
┌─────────────────▼───────────────────────────────────┐
│  Thiết bị B - Login test1                           │
│  ✅ Session ID: XYZ, JWT Token: abc789             │
│  🔴 Backend: forceLogoutAllUserSessions()           │
│     → Session ABC marked as inactive                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Thiết bị A - User click "Tài Khoản"               │
│  API call: GET /accounts/list.php                   │
│    Header: X-Auth-Token: xyz123                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  Backend: auth.php → requireAuth()                  │
│  1. ✅ Check JWT token xyz123 → Valid               │
│  2. ⭐ Check session ABC in DB → INACTIVE!          │
│  3. 🔴 Return 401 with reason: session_terminated   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  Frontend: axios.interceptors.response              │
│  1. ✅ Catch 401 response                           │
│  2. ✅ Check reason === 'session_terminated'        │
│  3. ✅ Show popup alert                             │
│  4. ✅ Clear token & user data                      │
│  5. ✅ Redirect to login                            │
└─────────────────────────────────────────────────────┘
```

---

## 🧪 Test

### Scenario 1: Login Thiết Bị Khác

1. **Thiết bị A:**
   - Login với `test1`
   - Vào Dashboard
   - Để yên, không làm gì

2. **Thiết bị B:**
   - Login với `test1`
   - Login thành công

3. **Thiết bị A:**
   - Click vào "Tài Khoản" hoặc bất kỳ menu nào
   - **Kết quả mong đợi:**
     ```
     ⚠️ Phiên đăng nhập đã hết hạn

     Bạn đã đăng nhập trên thiết bị khác.

     Bạn sẽ được chuyển về trang đăng nhập.
     ```
   - Tự động logout và về trang login

### Scenario 2: Login Chỉ 1 Thiết Bị

1. Login trên 1 thiết bị duy nhất
2. Sử dụng bình thường
3. **Kết quả:** Không có popup, hoạt động bình thường

---

## 🔍 Debug

### Console Logs

**Khi session hết hạn, console sẽ hiện:**
```
⚠️ [Auto Logout] Session terminated - logged in elsewhere
```

**Test axios interceptor:**
```javascript
// Trong DevTools Console
api.getAccounts().then(r => console.log(r)).catch(e => console.error(e));
```

### Kiểm tra Backend

Test API trực tiếp:
```bash
curl -H "X-Auth-Token: your-token-here" \
     https://db.handymancode.com/api/wokushop-api/accounts/list.php
```

Nếu session invalid, sẽ trả về:
```json
{
  "success": false,
  "message": "Session has been terminated. You may have logged in on another device.",
  "reason": "session_terminated"
}
```

---

## 📝 Checklist Triển Khai

### Backend:
- [ ] Backup file `auth.php` cũ
- [ ] Cập nhật method `requireAuth()` với session check
- [ ] Thêm method `isSessionActive()`
- [ ] Upload lên server
- [ ] Test bằng curl hoặc Postman

### Frontend:
- [ ] Đóng ứng dụng Woku App
- [ ] Sửa file `api.js`
- [ ] Thêm method `setupInterceptors()`
- [ ] Gọi `this.setupInterceptors()` trong constructor
- [ ] Khởi động lại app
- [ ] Test với 2 thiết bị

---

## ⚡ Ưu Điểm Của Cách Này

1. ✅ **Đơn giản** - Chỉ sửa 2 file, thêm 2 methods
2. ✅ **Không tốn tài nguyên** - Không có polling/interval
3. ✅ **Logout ngay lập tức** - Khi user có action bất kỳ
4. ✅ **Tự động** - Không cần quản lý interval
5. ✅ **Catch all API calls** - Mọi API đều được xử lý
6. ✅ **User experience tốt** - Thông báo rõ ràng lý do logout

---

## ❓ FAQ

**Q: Tại sao không logout ngay lập tức khi login thiết bị khác?**

A: Vì không có cơ chế push notification từ server. Phải đợi thiết bị A gọi API thì mới phát hiện. Nhưng trong thực tế, user sẽ click/interact trong vài giây, nên logout rất nhanh.

**Q: Nếu muốn logout ngay lập tức cả khi idle thì sao?**

A: Cần dùng WebSocket hoặc Server-Sent Events để server push notification. Phức tạp hơn nhiều.

**Q: Có ảnh hưởng đến performance không?**

A: Không. Chỉ thêm 1 query check session mỗi lần gọi API (mà API đã phải check auth rồi). Query rất nhanh (có index trên token).

**Q: Có cần xóa file `check-session.php` không?**

A: Không cần xóa, nhưng không cần dùng nữa. Có thể để đó hoặc xóa đi.

---

## 🎯 Kết Luận

**Cách này đơn giản nhất và hiệu quả nhất cho yêu cầu của bạn:**

- ❌ Không check định kỳ
- ❌ Không polling
- ❌ Không WebSocket
- ✅ Chỉ check khi có API call (tự nhiên)
- ✅ Logout ngay khi user có action
- ✅ Cực kỳ đơn giản

Bất kỳ câu hỏi nào, hãy hỏi!
