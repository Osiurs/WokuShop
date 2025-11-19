# Quick Start - Service Assignment

## TÓM TẮT

### Admin cần làm gì?

#### Với YouTube/Spotify (requires_user_credentials = TRUE):
1. **Gán DỊCH VỤ cho user** (không cần tạo account):
```bash
POST /users/assign-services.php
{
  "user_id": 5,
  "service_types": ["youtube", "spotify"]
}
```

2. **XONG!** User sẽ tự tạo account và đăng nhập.

#### Với Netflix/Gemini/ChatGPT (requires_user_credentials = FALSE):
1. **Gán dịch vụ cho user:**
```bash
POST /users/assign-services.php
{
  "user_id": 5,
  "service_types": ["netflix", "gemini"]
}
```

2. **Tạo account:**
```bash
POST /accounts/create.php
{
  "service_name": "Netflix Premium",
  "service_type": "netflix",
  "partition_id": "netflix_001"
}
```

3. **Gán account cho user:**
```bash
POST /users/assign-accounts.php
{
  "user_id": 5,
  "account_ids": [10]
}
```

---

### User cần làm gì?

#### Với YouTube/Spotify:
1. **Kiểm tra dịch vụ được gán:**
```bash
GET /users/services.php
```

2. **Tạo account nếu chưa có:**
```bash
POST /accounts/create-my-account.php
{
  "service_type": "youtube"
}
```

3. **Đăng nhập trong Electron app** với partition riêng.

#### Với Netflix/Gemini/ChatGPT:
1. **Xem account đã được gán:**
```bash
GET /users/services.php
```

2. **Sử dụng luôn** - không cần tạo gì thêm.

---

## CÀI ĐẶT

### 1. Chạy database init:
```
http://localhost/wokushop-api/init.php
```

### 2. Hoặc chạy SQL thủ công:
```sql
-- Thêm cột
ALTER TABLE services ADD COLUMN requires_user_credentials BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN created_by INT NULL;
ALTER TABLE accounts ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Tạo bảng user_services
CREATE TABLE user_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_type) REFERENCES services(service_type) ON DELETE CASCADE,
    UNIQUE KEY unique_user_service (user_id, service_type)
);

-- Set flags
UPDATE services SET requires_user_credentials = TRUE WHERE service_type IN ('youtube', 'spotify');
```

---

## API ENDPOINTS MỚI

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/users/assign-services.php` | Admin gán dịch vụ cho user |
| GET | `/users/services.php?user_id={id}` | Lấy danh sách dịch vụ của user |
| POST | `/accounts/create-my-account.php` | User tự tạo account cho YouTube/Spotify |
| GET | `/accounts/my-accounts.php` | Lấy account user tự tạo |

---

## ELECTRON APP INTEGRATION

```javascript
// Khi user chọn service
async function loadService(serviceType) {
  // 1. Lấy thông tin service
  const servicesResponse = await fetch(`${API}/users/services.php`);
  const { services } = await servicesResponse.json();

  const service = services.find(s => s.service_type === serviceType);

  if (service.requires_user_credentials) {
    // YouTube/Spotify
    if (service.has_account) {
      // User đã tạo account, load với partition riêng
      loadWithPartition(service.user_account.partition_id);
    } else {
      // Yêu cầu user tạo account
      await createMyAccount(serviceType);
      // Sau khi tạo xong, reload service info
      loadService(serviceType);
    }
  } else {
    // Netflix/Gemini - dùng account đã gán
    if (service.assigned_accounts.length > 0) {
      loadWithPartition(service.assigned_accounts[0].partition_id);
    } else {
      showError("No account assigned. Contact admin.");
    }
  }
}

async function createMyAccount(serviceType) {
  const response = await fetch(`${API}/accounts/create-my-account.php`, {
    method: 'POST',
    body: JSON.stringify({ service_type: serviceType })
  });

  const result = await response.json();
  if (result.success) {
    showSuccess("Account created! You can now login.");
  }
}
```

---

## LƯU Ý

✅ **KHÔNG thay đổi** chức năng cũ
✅ Mỗi user có partition riêng cho YouTube/Spotify
✅ Admin vẫn kiểm soát user dùng dịch vụ gì
✅ User tự quản lý tài khoản YouTube/Spotify của họ

❌ **KHÔNG** tạo account YouTube/Spotify để gán cho user
❌ User không thể tự gán dịch vụ cho mình (cần admin)
