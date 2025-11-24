# Fix Auto Logout - Upload File Mới

## 🔍 Vấn Đề

Hiện tại khi login thiết bị B, thiết bị A vẫn hiện lỗi:
```
"User already has an active session. Please logout first."
```

**Nguyên nhân:** File `login.php` trên server là phiên bản cũ, vẫn còn logic BLOCK login mới thay vì FORCE LOGOUT session cũ.

---

## ✅ Giải Pháp

Tôi đã tạo file **login-FINAL.php** với logic đúng:
1. ⭐ Force logout TẤT CẢ sessions cũ TRƯỚC
2. Tạo session mới
3. KHÔNG block, KHÔNG báo lỗi

---

## 📂 File Cần Upload

**File:** `wokushop-api/auth/login-FINAL.php` (vừa tạo)

**Vị trí trên server:** `https://db.handymancode.com/api/wokushop-api/auth/login.php`

---

## 🚀 Các Bước Thực Hiện

### Bước 1: Backup File Cũ Trên Server

Trước khi thay thế, backup file cũ:

```bash
# Truy cập server (SSH hoặc File Manager)
cd /path/to/wokushop-api/auth/

# Backup file cũ
cp login.php login.php.backup-$(date +%Y%m%d-%H%M%S)

# Kiểm tra backup đã tạo
ls -la login.php*
```

### Bước 2: Upload File Mới

**Option A - Dùng FTP/FileZilla:**
1. Mở FileZilla hoặc FTP client
2. Connect tới server: `db.handymancode.com`
3. Navigate tới: `/public_html/api/wokushop-api/auth/`
4. Upload `login-FINAL.php`
5. Đổi tên `login-FINAL.php` → `login.php` (ghi đè)

**Option B - Dùng cPanel File Manager:**
1. Login cPanel
2. Mở File Manager
3. Navigate tới: `public_html/api/wokushop-api/auth/`
4. Upload `login-FINAL.php`
5. Rename `login-FINAL.php` → `login.php`

**Option C - Dùng Command Line (SSH):**
```bash
# Upload từ local → server (từ máy local)
scp C:/Users/ADMIN/OneDrive/Documents/job/WokuShop/wokushop-api/auth/login-FINAL.php \
    user@db.handymancode.com:/path/to/wokushop-api/auth/login.php
```

### Bước 3: Kiểm Tra Permissions

```bash
# Trên server
chmod 644 /path/to/wokushop-api/auth/login.php
```

### Bước 4: Test

1. **Thiết bị A:** Login với user `minh`
2. **Thiết bị B:** Login với user `minh`
3. **Kết quả mong đợi:**
   - Thiết bị B login thành công ✅
   - KHÔNG có lỗi "User already has an active session" ✅
   - Thiết bị A logout tự động khi click/action ✅

---

## 🔍 Debug & Verify

### Kiểm Tra File Đã Upload Đúng

Test API trực tiếp:

```bash
curl -X POST https://db.handymancode.com/api/wokushop-api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"wrong"}'
```

**Kết quả mong đợi:**
```json
{
  "success": false,
  "message": "Invalid username or password."
}
```

**KHÔNG được trả về:**
```json
{
  "success": false,
  "message": "User already has an active session..."
}
```

### Xem Error Logs

Nếu vẫn có vấn đề, check error logs trên server:

```bash
# Trên server
tail -f /path/to/error_log

# Hoặc PHP error log
tail -f /var/log/php-errors.log
```

File login-FINAL.php có nhiều `error_log()` để debug:
- `[LOGIN] Force logging out all sessions for user ID: X`
- `[LOGIN] All old sessions terminated successfully`
- `[LOGIN] Creating new session for user ID: X`
- `[LOGIN] New session created successfully`
- `[LOGIN] Login successful for user: username`

---

## 📊 So Sánh Logic

### ❌ File Cũ (Sai)
```php
// Check if can login (BLOCKS if session exists)
$loginCheck = $sessionManager->canUserLogin($userId, $currentIP);

if (!$loginCheck['allowed']) {
    // ❌ RETURN ERROR - BLOCK LOGIN
    echo json_encode([
        "success" => false,
        "message" => "User already has an active session..."
    ]);
    exit();
}

// Create session
$sessionManager->createSession($userId, $token, $currentIP);
```

### ✅ File Mới (Đúng)
```php
// ⭐ Force logout ALL sessions FIRST - NO CHECK, NO BLOCK
$sessionManager->forceLogoutAllUserSessions($userId);

// Create NEW session (old ones already terminated)
$sessionManager->createSession($userId, $token, $currentIP);

// ✅ SUCCESS - NO ERROR
```

---

## 🎯 Kết Quả Sau Khi Upload

- ✅ Login thiết bị mới → Luôn thành công
- ✅ Sessions cũ tự động logout
- ✅ KHÔNG có lỗi "already has session"
- ✅ Message rõ ràng: "Previous sessions have been terminated"

---

## ⚠️ Lưu Ý

1. **Backup trước khi thay thế** - Luôn backup file cũ
2. **Test ngay sau khi upload** - Đảm bảo logic hoạt động
3. **Check error logs** - Nếu có vấn đề, xem logs để debug
4. **Clear cache** - Clear browser cache trước khi test

---

## 🆘 Nếu Vẫn Lỗi

Nếu sau khi upload vẫn lỗi, check:

1. **File đúng chưa:**
   ```bash
   head -20 /path/to/login.php
   # Phải thấy comment: "Login API - FINAL VERSION"
   ```

2. **Có cache không:**
   - Clear browser cache
   - Restart app
   - Thử browser khác

3. **Permissions đúng chưa:**
   ```bash
   ls -la /path/to/login.php
   # Should be: -rw-r--r-- (644)
   ```

4. **PHP errors:**
   ```bash
   php -l /path/to/login.php
   # No syntax errors
   ```

---

## 📞 Cần Hỗ Trợ

Nếu vẫn lỗi sau khi upload, cung cấp:
1. Screenshot lỗi
2. Error logs từ server
3. Kết quả test curl

---

Sau khi upload xong, báo lại để tôi verify!
