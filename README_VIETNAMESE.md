# Woku App - Tài Liệu Tiếng Việt

## 📖 Giới Thiệu

**Woku App** là ứng dụng desktop quản lý tài khoản subscription được chia sẻ cho nhiều dịch vụ (ChatGPT, Gemini, Netflix, YouTube, Spotify, QuillBot, v.v.). Ứng dụng cung cấp:

- ✅ **Quản lý đa tài khoản** - Quản lý nhiều tài khoản từ một nơi
- ✅ **Phân quyền người dùng** - Admin và User với quyền hạn khác nhau
- ✅ **Đồng bộ session** - Đồng bộ phiên làm việc giữa nhiều thiết bị
- ✅ **Bảo mật cao** - Chặn logout, hạn chế domain, mã hóa dữ liệu
- ✅ **Chặn quảng cáo** - Tích hợp uBlock Origin Lite, chặn quảng cáo YouTube
- ✅ **Lưu trữ cookie** - Cookie được lưu trữ và khôi phục tự động

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────┐
│   Electron Desktop App (Client)    │
│   - Main Process (Node.js)         │
│   - Renderer Process (HTML/CSS/JS) │
│   - Session Management              │
└──────────────┬──────────────────────┘
               │ REST API (HTTPS)
               ▼
┌─────────────────────────────────────┐
│   PHP Backend API (Server)         │
│   - Authentication (JWT)            │
│   - Account Management              │
│   - Session Sync                    │
│   - Cookie Storage                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   MySQL Database                    │
│   - Users, Accounts, Sessions       │
│   - Cookies, Activity Logs          │
└─────────────────────────────────────┘
```

## 🚀 Cài Đặt Nhanh

### Backend (API Server)

1. **Tạo database:**
```sql
CREATE DATABASE wokushop_db CHARACTER SET utf8mb4;
```

2. **Cấu hình `.env`:**
```bash
cd wokushop-api
cp .env.example .env
# Chỉnh sửa .env với thông tin database
```

3. **Khởi tạo database:**
```bash
php init.php
```

4. **Đăng nhập admin mặc định:**
- Username: `admin`
- Password: `admin123`
- ⚠️ **Đổi mật khẩu ngay sau khi đăng nhập!**

### Desktop App

1. **Cài đặt dependencies:**
```bash
cd woku-app
npm install
```

2. **Cấu hình API URL:**
Sửa file `config/config.js`:
```javascript
API_BASE_URL: 'https://yourdomain.com/wokushop-api'
```

3. **Chạy ứng dụng:**
```bash
npm run dev        # Development mode
npm run build:win  # Build cho Windows
```

## 📚 Tài Liệu Chi Tiết

Xem file **`WOKU_APP_DOCUMENTATION.md`** để có tài liệu đầy đủ bao gồm:

1. **System Architecture** - Kiến trúc hệ thống chi tiết
2. **Database Schema** - Cấu trúc database đầy đủ
3. **API Endpoints** - Tất cả API endpoints với ví dụ
4. **Security Features** - Các tính năng bảo mật (5 lớp chặn logout)
5. **Core Features** - Tính năng chính của ứng dụng
6. **Installation Guide** - Hướng dẫn cài đặt chi tiết
7. **Development Guide** - Hướng dẫn phát triển
8. **Deployment** - Triển khai production
9. **Troubleshooting** - Xử lý sự cố thường gặp
10. **FAQ** - Câu hỏi thường gặp

## 🔐 Tính Năng Bảo Mật

### Hệ Thống Chặn Logout (5 Lớp)

1. **Layer 1**: Chặn network request đến endpoint logout
2. **Layer 2**: Override JavaScript functions (logout, signOut)
3. **Layer 3**: Ẩn các nút logout trong DOM
4. **Layer 4**: Chặn History API navigation đến trang logout
5. **Layer 5**: Bảo vệ localStorage khỏi bị xóa auth data

### Hạn Chế Domain

- User chỉ có thể truy cập các domain được phép
- Admin có thể truy cập mọi domain
- Tự động redirect nếu truy cập domain không hợp lệ

### Mã Hóa Dữ Liệu

- Password: bcrypt hashing
- Cookie: AES-256 encryption
- JWT token: Signed và có thời hạn

## 🎯 Các Dịch Vụ Được Hỗ Trợ

- ✅ **ChatGPT** (OpenAI) - Chặn logout, lưu session
- ✅ **Gemini** (Google) - Xử lý CSP đặc biệt
- ✅ **YouTube Premium** - Chặn quảng cáo nâng cao
- ✅ **Netflix** - Quản lý profile
- ✅ **Spotify Premium** - Không quảng cáo
- ✅ **QuillBot Premium** - Chặn logout
- ✅ **Custom Services** - Thêm dịch vụ tùy chỉnh

## 📊 Database Schema Chính

### users
```sql
- id, username, password (bcrypt), role (admin/user)
```

### accounts
```sql
- id, service_name, service_type, partition_id, login_url
```

### user_accounts
```sql
- Liên kết users ↔ accounts (many-to-many)
```

### sessions
```sql
- JWT tokens, device info, expiration
```

### cookies
```sql
- Encrypted cookie storage per account
```

### activity_logs
```sql
- User activity tracking
```

## 🛠️ API Endpoints Chính

### Authentication
- `POST /auth/login.php` - Đăng nhập
- `POST /auth/logout.php` - Đăng xuất
- `POST /auth/verify.php` - Xác thực token

### Accounts
- `GET /accounts/list.php` - Danh sách tài khoản
- `POST /accounts/create.php` - Tạo tài khoản (Admin)
- `POST /accounts/assign.php` - Gán tài khoản cho user (Admin)

### Sessions
- `POST /sessions/backup.php` - Upload session backup
- `GET /sessions/download.php` - Download session backup
- `POST /sessions/sync-up.php` - Đồng bộ lên cloud
- `POST /sessions/sync-down.php` - Đồng bộ từ cloud

## 🔧 Development

### Cấu Trúc Thư Mục

```
woku-app/
├── src/
│   ├── main/              # Main process
│   ├── renderer/          # UI (HTML/CSS/JS)
│   ├── assets/            # Static files
│   └── preload/           # Security scripts
├── config/                # Configuration
└── extensions/            # Browser extensions

wokushop-api/
├── auth/                  # Authentication
├── accounts/              # Account management
├── sessions/              # Session management
├── cookies/               # Cookie storage
└── config/                # Database & auth config
```

### Thêm Dịch Vụ Mới

1. Thêm vào database `services` table
2. Thêm domain restrictions
3. Tạo logout blocker script (nếu cần)
4. Cập nhật main.js để load script

## 📝 License

ISC License - Copyright (c) 2024 WokuShop

## 📞 Liên Hệ & Hỗ Trợ

- **Email**: contact@wokushop.com
- **Documentation**: Xem file `WOKUSHOP_DOCUMENTATION.md`
- **GitHub Issues**: Báo lỗi và yêu cầu tính năng

---

**Phiên bản**: 1.0.0  
**Cập nhật**: 19/11/2025  
**Tác giả**: WokuShop Development Team

