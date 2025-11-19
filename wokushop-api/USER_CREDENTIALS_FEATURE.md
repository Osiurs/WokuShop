# Tính năng User Credentials cho Dịch vụ

## Tổng quan

Hệ thống đã được nâng cấp để hỗ trợ 2 loại dịch vụ:

1. **Dịch vụ cần User Credentials** (YouTube, Spotify):
   - Admin **GÁN DỊCH VỤ** cho user (không cần tạo account)
   - User tự tạo account và đăng nhập vào dịch vụ đó
   - Mỗi user có partition riêng, session riêng

2. **Dịch vụ dùng Account chung** (Netflix, Gemini, ChatGPT):
   - Admin tạo account và gán cho user
   - Nhiều user có thể dùng chung 1 account

## Thay đổi Database

### 1. Bảng `services` - Thêm cột mới:
- `requires_user_credentials` (BOOLEAN): Đánh dấu dịch vụ nào cần user tự tạo account

### 2. Bảng `accounts` - Thêm cột mới:
- `created_by` (INT): Foreign key tới `users.id`, đánh dấu account được tạo bởi user nào

### 3. Bảng `user_services` - Bảng mới (junction table):
```sql
CREATE TABLE user_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_type) REFERENCES services(service_type) ON DELETE CASCADE,
    UNIQUE KEY unique_user_service (user_id, service_type)
)
```
**Mục đích:** Lưu dịch vụ nào được gán cho user nào

## Cách hoạt động

### Flow cho dịch vụ có `requires_user_credentials = TRUE` (YouTube, Spotify):

**Bước 1: Admin gán DỊCH VỤ cho user**
```
POST /users/assign-services.php
{
  "user_id": 5,
  "service_types": ["youtube", "spotify", "netflix"]
}
```
→ Lưu vào bảng `user_services`: User 5 được quyền sử dụng 3 dịch vụ này

**Bước 2: User tự tạo account cho YouTube/Spotify**
```
POST /accounts/create-my-account.php
{
  "service_type": "youtube"
}
```
→ Tạo account với `partition_id = youtube_user_5_1234567890`

**Bước 3: User đăng nhập vào YouTube trong Electron app**
- Electron load với partition riêng của user
- User đăng nhập tài khoản YouTube của họ
- Session lưu trong partition riêng

### Flow cho dịch vụ có `requires_user_credentials = FALSE` (Netflix, Gemini, ChatGPT):

**Bước 1: Admin gán dịch vụ cho user** (giống trên)

**Bước 2: Admin tạo account Netflix**
```
POST /accounts/create.php
{
  "service_name": "Netflix Premium",
  "service_type": "netflix",
  "partition_id": "netflix_001"
}
```

**Bước 3: Admin gán account cho user**
```
POST /users/assign-accounts.php
{
  "user_id": 5,
  "account_ids": [10]
}
```

**Bước 4: User sử dụng Netflix**
- Electron load account Netflix đã gán
- User dùng tài khoản Netflix chung

## API Endpoints mới

### 1. Gán dịch vụ cho user (Admin only)
**POST** `/users/assign-services.php`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "user_id": 5,
  "service_types": ["youtube", "spotify", "netflix"]
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Services assigned successfully."
}
```

**Lưu ý:**
- Thay thế toàn bộ danh sách services cũ của user
- Admin gán **dịch vụ** chứ không phải account
- Với YouTube/Spotify: User sẽ tự tạo account sau
- Với Netflix/Gemini/ChatGPT: Admin cần tạo và gán account riêng

### 2. Lấy danh sách dịch vụ của user
**GET** `/users/services.php?user_id={userId}`

**Authentication:** Required

**Access Control:**
- Admin: Xem được của bất kỳ user nào
- User thường: Chỉ xem của chính mình

**Response:**
```json
{
  "success": true,
  "services": [
    {
      "id": 1,
      "service_type": "youtube",
      "display_name": "YouTube",
      "login_url": "https://www.youtube.com",
      "icon_emoji": "📺",
      "requires_user_credentials": true,
      "assigned_at": "2024-01-01 00:00:00",
      "allowed_domains": ["youtube.com", "www.youtube.com"],
      "has_account": true,
      "user_account": {
        "id": 10,
        "service_name": "My YouTube",
        "partition_id": "youtube_user_5_1234567890",
        ...
      }
    },
    {
      "id": 3,
      "service_type": "netflix",
      "display_name": "Netflix",
      "requires_user_credentials": false,
      "assigned_at": "2024-01-01 00:00:00",
      "assigned_accounts": [
        {
          "id": 20,
          "service_name": "Netflix Premium",
          "partition_id": "netflix_001",
          ...
        }
      ]
    }
  ]
}
```

### 3. Tạo account riêng cho user
**POST** `/accounts/create-my-account.php`

**Authentication:** Required (cả admin và user)

**Điều kiện:**
- Dịch vụ phải có `requires_user_credentials = TRUE`
- User phải được gán dịch vụ đó (có trong `user_services`)
- User chưa tạo account cho dịch vụ này

**Request Body:**
```json
{
  "service_type": "youtube",
  "service_name": "My YouTube Account",  // Optional, auto-generated if not provided
  "description": "My personal YouTube"   // Optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Account created successfully.",
  "account": {
    "id": 1,
    "service_name": "My YouTube Account",
    "service_type": "youtube",
    "partition_id": "youtube_user_1_1234567890"
  }
}
```

**Response (Error - Service không cho phép):**
```json
{
  "success": false,
  "message": "This service does not allow users to create their own accounts."
}
```

**Response (Error - User đã có account):**
```json
{
  "success": false,
  "message": "You already have an account for this service."
}
```

### 2. Lấy danh sách account của user
**GET** `/accounts/my-accounts.php`

**Authentication:** Required

**Query Parameters:**
- `service_type` (optional): Lọc theo loại dịch vụ

**Response:**
```json
{
  "success": true,
  "accounts": [
    {
      "id": 1,
      "service_name": "My YouTube Account",
      "service_type": "youtube",
      "description": "",
      "partition_id": "youtube_user_1_1234567890",
      "created_by": 1,
      "created_at": "2024-01-01 00:00:00",
      "updated_at": "2024-01-01 00:00:00",
      "service_display_name": "YouTube",
      "icon_emoji": "📺",
      "requires_user_credentials": true
    }
  ]
}
```

**GET** `/accounts/my-accounts.php?service_type=youtube`

**Response (có account):**
```json
{
  "success": true,
  "account": {
    "id": 1,
    "service_name": "My YouTube Account",
    "service_type": "youtube",
    "partition_id": "youtube_user_1_1234567890",
    "created_by": 1,
    ...
  }
}
```

**Response (chưa có account):**
```json
{
  "success": false,
  "message": "No account found for this service."
}
```

## API Endpoints đã cập nhật

### 1. `/accounts/list.php`
Bây giờ trả về thêm thông tin:
- `created_by_username`: Username của người tạo account
- `requires_user_credentials`: Có phải dịch vụ cần credentials không

### 2. `/accounts/create.php` (Admin only)
Bây giờ hỗ trợ set `created_by`:
```json
{
  "service_name": "Test Account",
  "service_type": "netflix",
  "partition_id": "netflix_123",
  "created_by": 2  // Optional: Gán account này cho user ID 2
}
```

### 3. `/services/list.php`
Tự động bao gồm field `requires_user_credentials` trong response

## Flow hoạt động

### User tạo account YouTube:

1. **Client kiểm tra user đã có account YouTube chưa:**
   ```
   GET /accounts/my-accounts.php?service_type=youtube
   Authorization: Bearer {token}
   ```

2. **Nếu chưa có, tạo mới:**
   ```
   POST /accounts/create-my-account.php
   Authorization: Bearer {token}

   {
     "service_type": "youtube"
   }
   ```

3. **Hệ thống tự động:**
   - Kiểm tra YouTube có `requires_user_credentials = true`
   - Tạo partition_id unique: `youtube_user_5_1705123456`
   - Tạo account với `created_by = 5`
   - Tự động gán account cho user trong bảng `user_accounts`

4. **Electron app sử dụng partition_id:**
   - Mỗi user có partition riêng
   - Session/cookies được lưu riêng biệt
   - User A đăng nhập YouTube vào partition của A
   - User B đăng nhập YouTube vào partition của B
   - Không conflict với nhau

## Cài đặt

### 1. Chạy database initialization:
Truy cập: `http://localhost/wokushop-api/init.php`

Script sẽ tự động:
- Thêm cột `requires_user_credentials` vào bảng `services`
- Thêm cột `created_by` vào bảng `accounts`
- Set YouTube và Spotify có `requires_user_credentials = TRUE`

### 2. Hoặc chạy SQL thủ công:
```sql
-- Thêm cột vào services
ALTER TABLE services ADD COLUMN requires_user_credentials BOOLEAN DEFAULT FALSE;

-- Thêm cột vào accounts
ALTER TABLE accounts ADD COLUMN created_by INT NULL;
ALTER TABLE accounts ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Set YouTube và Spotify
UPDATE services SET requires_user_credentials = TRUE WHERE service_type IN ('youtube', 'spotify');
```

## Testing

### Test Case 1: User tạo YouTube account
```bash
# Login as user
curl -X POST http://localhost/wokushop-api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# Tạo YouTube account
curl -X POST http://localhost/wokushop-api/accounts/create-my-account.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"service_type":"youtube"}'
```

### Test Case 2: User tạo account lần 2 (sẽ fail)
```bash
curl -X POST http://localhost/wokushop-api/accounts/create-my-account.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"service_type":"youtube"}'

# Expected: "You already have an account for this service."
```

### Test Case 3: User thử tạo Netflix account (sẽ fail)
```bash
curl -X POST http://localhost/wokushop-api/accounts/create-my-account.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"service_type":"netflix"}'

# Expected: "This service does not allow users to create their own accounts."
```

### Test Case 4: Lấy danh sách account của user
```bash
curl -X GET http://localhost/wokushop-api/accounts/my-accounts.php \
  -H "Authorization: Bearer {token}"
```

## Lưu ý quan trọng

1. **Không thay đổi chức năng hiện tại**:
   - Admin vẫn tạo account bình thường
   - User vẫn được gán account như cũ
   - Chỉ THÊM khả năng user tự tạo cho YouTube/Spotify

2. **Mỗi user 1 account cho mỗi dịch vụ requires_user_credentials**:
   - User A có YouTube account riêng
   - User B có YouTube account riêng
   - Không share account giữa các user

3. **Partition ID unique**:
   - Format: `{service_type}_user_{user_id}_{timestamp}`
   - Đảm bảo không trùng lặp
   - Mỗi user có session riêng trong Electron

4. **Admin vẫn có quyền cao nhất**:
   - Có thể xem tất cả accounts (kể cả user tự tạo)
   - Có thể xóa bất kỳ account nào
   - Field `created_by_username` giúp biết account do ai tạo

## Tích hợp với Electron App

Trong Electron app, khi load service cho user:

```javascript
// 1. Kiểm tra service có requires_user_credentials không
if (service.requires_user_credentials) {
  // 2. Lấy account của user cho service này
  const response = await fetch(
    `${API_URL}/accounts/my-accounts.php?service_type=${service.service_type}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  const data = await response.json();

  if (!data.success) {
    // User chưa có account, yêu cầu tạo
    showCreateAccountDialog(service);
  } else {
    // Load với partition_id của user
    loadServiceWithPartition(data.account.partition_id);
  }
} else {
  // Service bình thường, load account đã gán
  loadAssignedAccount();
}
```
