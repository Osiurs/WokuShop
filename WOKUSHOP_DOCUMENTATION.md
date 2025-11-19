# WokuShop Account Manager - Complete Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Security Features](#security-features)
7. [Core Features](#core-features)
8. [Installation & Setup](#installation--setup)
9. [Development Guide](#development-guide)
10. [Deployment](#deployment)

---

## 1. Project Overview

### What is WokuShop Account Manager?

**WokuShop Account Manager** is a comprehensive desktop application built with Electron that manages shared subscription accounts for multiple services (ChatGPT, Gemini, Netflix, YouTube, Spotify, QuillBot, etc.). It provides:

- **Multi-user access control** (Admin & User roles)
- **Session management** with cloud synchronization
- **Security features** (logout blocking, domain restrictions)
- **Ad blocking** for YouTube and other services
- **Cookie persistence** across devices
- **Activity logging** and monitoring

### Key Benefits

✅ **Centralized Management** - Manage multiple subscription accounts from one place
✅ **Secure Sharing** - Share accounts without exposing credentials
✅ **Session Sync** - Seamlessly sync sessions across multiple devices
✅ **Cost Effective** - Share premium subscriptions among team members
✅ **Enhanced Security** - Role-based access control with logout prevention

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │   Main     │  │  Renderer  │  │   Preload Scripts  │   │
│  │  Process   │◄─┤  Process   │◄─┤  (Security Layer)  │   │
│  └────────────┘  └────────────┘  └────────────────────┘   │
│         │              │                                     │
│         └──────────────┴──────────────┐                    │
└────────────────────────────────────────┼────────────────────┘
                                         │
                                         │ HTTPS/REST API
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    PHP Backend API                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │    Auth    │  │  Session   │  │    Account         │   │
│  │  Manager   │  │  Manager   │  │    Manager         │   │
│  └────────────┘  └────────────┘  └────────────────────┘   │
│         │              │                    │                │
│         └──────────────┴────────────────────┘               │
└────────────────────────────────────────────┼────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │  MySQL Database  │
                                    └──────────────────┘
```

### Component Breakdown

#### **Frontend (Electron)**
- **Main Process** (`src/main/main.js`) - Core application logic, window management
- **Renderer Process** (`src/renderer/`) - UI rendering (HTML/CSS/JS)
- **Preload Scripts** (`src/preload/`) - Security layer, API injection
- **IPC Communication** - Inter-process communication between main and renderer

#### **Backend (PHP)**
- **Authentication** (`wokushop-api/auth/`) - Login, JWT tokens, session management
- **Account Management** (`wokushop-api/accounts/`) - CRUD operations for accounts
- **Session Sync** (`wokushop-api/sessions/`) - Cloud session synchronization
- **Cookie Management** (`wokushop-api/cookies/`) - Cookie backup/restore
- **Domain Restrictions** (`wokushop-api/services/`) - Service configuration

#### **Database (MySQL)**
- **Users** - User credentials and roles
- **Accounts** - Subscription account details
- **Sessions** - JWT tokens and session data
- **Cookies** - Encrypted cookie storage
- **Activity Logs** - User activity tracking

---

## 3. Technology Stack

### Desktop Application

| Technology | Version | Purpose |
|------------|---------|---------|
| **Electron** | 30.0.0-castlabs | Desktop app framework (Widevine support) |
| **Node.js** | 18+ | JavaScript runtime |
| **electron-store** | 8.1.0 | Local data persistence |
| **axios** | 1.6.2 | HTTP client |
| **archiver** | 6.0.1 | ZIP compression for sessions |
| **node-machine-id** | 1.1.12 | Device fingerprinting |

### Backend API

| Technology | Version | Purpose |
|------------|---------|---------|
| **PHP** | 7.4+ | Server-side language |
| **MySQL** | 5.7+ | Relational database |
| **JWT** | Custom | Authentication tokens |
| **PDO** | Built-in | Database abstraction |

### Extensions & Plugins

| Extension | Purpose |
|-----------|---------|
| **uBlock Origin Lite** | Ad blocking (YouTube, web ads) |
| **Custom Preload Scripts** | Logout blocking, security injection |

---

## 4. Database Schema

### Core Tables

#### **users**
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Purpose**: Store user credentials and roles
**Key Fields**:
- `role`: 'admin' (full access) or 'user' (restricted)
- `password`: bcrypt hashed

#### **user_accounts**
```sql
CREATE TABLE user_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_account (user_id, account_id)
);
```

**Purpose**: Many-to-many relationship between users and accounts
**Key Fields**:
- `is_active`: Whether user can access this account

#### **sessions**
```sql
CREATE TABLE sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    device_info TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
);
```

**Purpose**: Store JWT authentication tokens
**Key Fields**:
- `token`: JWT token string
- `expires_at`: Token expiration time (default 24 hours)

#### **user_ip_sessions**
```sql
CREATE TABLE user_ip_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    session_token VARCHAR(500) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    logout_time TIMESTAMP NULL,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    forced_logout BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_active (user_id, is_active),
    INDEX idx_ip_active (ip_address, is_active)
);
```

**Purpose**: Track user sessions per IP address (single session per IP enforcement)
**Key Fields**:
- `ip_address`: User's IP address
- `forced_logout`: Whether session was forcefully terminated

#### **user_sessions** (Cloud Sync)
```sql
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    machine_id VARCHAR(255) NOT NULL,
    session_data JSON,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_machine (user_id, machine_id)
);
```

**Purpose**: Centralized session storage for multi-device sync
**Key Fields**:
- `machine_id`: Unique device identifier
- `session_data`: JSON containing session state

#### **cookies**
```sql
CREATE TABLE cookies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    cookie_data LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    INDEX idx_account_id (account_id)
);
```

**Purpose**: Store encrypted cookies for session persistence
**Key Fields**:
- `cookie_data`: JSON array of cookies (encrypted)

#### **domain_restrictions**
```sql
CREATE TABLE domain_restrictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_type VARCHAR(50) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_service_domain (service_type, domain),
    INDEX idx_service_type (service_type)
);
```

**Purpose**: Define allowed domains for each service type
**Key Fields**:
- `service_type`: Service identifier (e.g., 'chatgpt', 'gemini')
- `domain`: Allowed domain (e.g., 'chat.openai.com')

#### **activity_logs**
```sql
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_action (user_id, action),
    INDEX idx_created_at (created_at)
);
```

**Purpose**: Log user activities for auditing
**Key Fields**:
- `action`: Action type (e.g., 'login', 'account_access', 'logout')
- `details`: JSON with additional context

#### **session_backups**
```sql
CREATE TABLE session_backups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    partition_id VARCHAR(255) NOT NULL,
    backup_path VARCHAR(500),
    file_size BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_account_id (account_id)
);
```

**Purpose**: Track session backup files
**Key Fields**:
- `backup_path`: File path or cloud storage URL
- `file_size`: Backup file size in bytes

---

## 5. API Endpoints

### Base URL
```
Production: https://db.handymancode.com/api/wokushop-api
Development: http://localhost/wokushop-api
```

### Authentication Endpoints

#### **POST /auth/login.php**
Login with username and password

**Request:**
```json
{
  "username": "user1",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "user1",
    "role": "user",
    "accounts": [...]
  },
  "session_info": {
    "ip_address": "192.168.x.x",
    "login_time": "2025-01-19 10:30:00",
    "session_id": "abc123"
  }
}
```

#### **POST /auth/login-strict.php**
Strict login mode - Only ONE active session per user

**Request:** Same as login.php

**Response:** Includes strict mode notification

#### **POST /auth/force-login.php**
Force login by terminating existing sessions

**Request:**
```json
{
  "username": "user1",
  "password": "password123",
  "force": true
}
```

#### **POST /auth/logout.php**
Logout and invalidate token

**Headers:**
```
Authorization: Bearer {token}
```

#### **POST /auth/verify.php**
Verify JWT token validity

**Headers:**
```
Authorization: Bearer {token}
```

### Account Management Endpoints

#### **GET /accounts/list.php**
Get all accounts (Admin only)

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "service_name": "ChatGPT Premium",
      "service_type": "chatgpt",
      "partition_id": "chatgpt-001",
      "login_url": "https://chat.openai.com",
      "requires_user_credentials": false
    }
  ]
}
```

#### **POST /accounts/create.php**
Create new account (Admin only)

**Request:**
```json
{
  "service_name": "Netflix Premium",
  "service_type": "netflix",
  "description": "Family plan",
  "partition_id": "netflix-001",
  "login_url": "https://www.netflix.com/login"
}
```

#### **PUT /accounts/update.php**
Update account (Admin only)

#### **DELETE /accounts/delete.php**
Delete account (Admin only)

#### **POST /accounts/assign.php**
Assign account to user (Admin only)

**Request:**
```json
{
  "user_id": 2,
  "account_id": 1
}
```

### Session Management Endpoints

#### **POST /sessions/backup.php**
Upload session backup

**Request:** multipart/form-data
- `account_id`: Account ID
- `partition_id`: Partition ID
- `session_file`: ZIP file

**Response:**
```json
{
  "success": true,
  "message": "Session backup uploaded",
  "backup_id": 123,
  "file_size": 1048576
}
```

#### **GET /sessions/download.php**
Download session backup

**Query Parameters:**
- `account_id`: Account ID
- `partition_id`: Partition ID

**Response:** ZIP file download

#### **POST /sessions/sync-up.php**
Upload session data for cloud sync

**Request:**
```json
{
  "machine_id": "device-123",
  "session_data": {
    "cookies": [...],
    "localStorage": {...}
  }
}
```

#### **POST /sessions/sync-down.php**
Download session data from cloud

**Request:**
```json
{
  "machine_id": "device-123"
}
```

### Cookie Management Endpoints

#### **POST /cookies/save.php**
Save cookies for account

**Request:**
```json
{
  "account_id": 1,
  "cookies": [
    {
      "name": "session_token",
      "value": "abc123",
      "domain": ".openai.com",
      "path": "/",
      "secure": true,
      "httpOnly": true
    }
  ]
}
```

#### **GET /cookies/get.php**
Get cookies for account

**Query Parameters:**
- `account_id`: Account ID

### Service Configuration Endpoints

#### **GET /services/list.php**
Get all available services

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "service_type": "chatgpt",
      "display_name": "ChatGPT",
      "default_url": "https://chat.openai.com",
      "allowed_domains": ["chat.openai.com", "auth0.openai.com"]
    }
  ]
}
```

#### **GET /services/domains.php**
Get allowed domains for service type

**Query Parameters:**
- `service_type`: Service type (e.g., 'chatgpt')

### Activity Logging Endpoints

#### **POST /logs/activity.php**
Log user activity

**Request:**
```json
{
  "action": "account_access",
  "details": {
    "account_id": 1,
    "account_name": "ChatGPT Premium"
  }
}
```

#### **GET /logs/list.php**
Get activity logs (Admin only)

---

## 6. Security Features

### 🔒 Authentication & Authorization

#### **JWT Token-Based Authentication**
- Tokens expire after 24 hours (configurable)
- Stored securely in electron-store
- Validated on every API request

#### **Role-Based Access Control (RBAC)**
- **Admin Role**: Full access to all features
  - Create/edit/delete accounts
  - Assign accounts to users
  - View all activity logs
  - Access all domains
  - Bypass logout blocking

- **User Role**: Restricted access
  - View assigned accounts only
  - Cannot modify accounts
  - Domain restrictions enforced
  - Logout blocking enabled



#### **Single Session Per IP**
- Only one active session per IP address
- Prevents account sharing across multiple locations
- Force login option to terminate existing sessions

#### **Password Security**
- Passwords hashed with bcrypt (cost factor 10)
- Minimum 8 characters required
- No plain text storage

### 🛡️ Logout Prevention System

The application implements **multi-layer logout blocking** to prevent users from accidentally or intentionally logging out of shared accounts:

#### **Layer 1: Network Request Blocking**
```javascript
// Block logout API calls
session.webRequest.onBeforeRequest({
  urls: [
    '*://*/logout*',
    '*://*/signout*',
    '*://*/api/auth/logout*'
  ]
}, (details, callback) => {
  callback({ cancel: true }); // Block the request
});
```

#### **Layer 2: JavaScript Function Override**
```javascript
// Override logout functions
window.logout = function() {
  console.warn('Logout blocked');
  return false;
};

// Block fetch/XHR to logout endpoints
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  if (url.includes('logout')) {
    throw new Error('Logout blocked');
  }
  return originalFetch.apply(this, arguments);
};
```

#### **Layer 3: DOM Element Hiding**
```javascript
// Hide logout buttons
document.querySelectorAll('a, button').forEach(el => {
  if (el.textContent.includes('Log out')) {
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
  }
});
```

#### **Layer 4: History API Protection**
```javascript
// Block navigation to logout pages
window.history.pushState = function(state, title, url) {
  if (url.includes('/logout')) {
    console.warn('Navigation blocked');
    return;
  }
  return originalPushState.apply(this, arguments);
};
```

#### **Layer 5: LocalStorage Protection**
```javascript
// Prevent clearing auth tokens
const originalRemoveItem = localStorage.removeItem;
localStorage.removeItem = function(key) {
  if (key.includes('auth') || key.includes('token')) {
    console.warn('Auth data removal blocked');
    return;
  }
  return originalRemoveItem.apply(this, arguments);
};
```

**Services with Logout Blocking:**
- ✅ ChatGPT (OpenAI)
- ✅ QuillBot
- ✅ Gemini (Google)
- ✅ YouTube
- ✅ Netflix
- ✅ Spotify

### 🌐 Domain Restriction System

Users can only navigate to **pre-approved domains** for each service:

#### **How It Works**
1. Admin defines allowed domains in `domain_restrictions` table
2. On navigation, app checks if target domain is in allowed list
3. If not allowed, navigation is blocked and user is redirected

#### **Example Configuration**
```javascript
// ChatGPT allowed domains
const allowedDomains = [
  'chat.openai.com',
  'auth0.openai.com',
  'cdn.openai.com'
];

// Block unauthorized navigation
sessionWindow.webContents.on('will-navigate', (event, url) => {
  const hostname = new URL(url).hostname;
  if (!allowedDomains.includes(hostname)) {
    event.preventDefault();
    console.log('Blocked navigation to:', hostname);
  }
});
```

#### **Admin Bypass**
- Admins can navigate to ANY domain
- Useful for troubleshooting and configuration

### 🚫 Ad Blocking System

#### **uBlock Origin Lite Integration**
- Lightweight ad blocker extension
- Blocks YouTube ads, banner ads, tracking scripts
- Automatically loaded for all services (except Gemini)

#### **Custom Ad Blocking Rules**
```javascript
// Block ad domains
const adDomains = [
  '*://doubleclick.net/*',
  '*://googlesyndication.com/*',
  '*://googleadservices.com/*',
  '*://youtube.com/api/stats/ads*',
  '*://youtube.com/pagead/*'
];

session.webRequest.onBeforeRequest({ urls: adDomains },
  (details, callback) => {
    callback({ cancel: true });
  }
);
```

#### **YouTube-Specific Ad Blocking**
- Skip button auto-click
- Ad container removal
- Player ad detection and removal
- Overlay ad blocking

### 🔐 Session Encryption

#### **Cookie Encryption**
- Cookies encrypted before storage in database
- AES-256 encryption
- Unique encryption key per installation

#### **Session Data Protection**
- Session partitions isolated per account
- No cross-contamination between accounts
- Automatic cleanup on logout

### 📊 Activity Monitoring

All user actions are logged:
- Login/logout events
- Account access
- Failed authentication attempts
- Session sync operations
- Admin actions

---

## 7. Core Features

### 🎯 Multi-Account Management

#### **Account Types Supported**
1. **ChatGPT** (OpenAI)
   - ChatGPT Plus/Pro accounts
   - Logout blocking enabled
   - Cookie persistence

2. **Gemini** (Google)
   - Gemini Advanced accounts
   - Special CSP handling
   - webSecurity disabled for compatibility

3. **YouTube Premium**
   - Ad-free experience
   - Background play
   - Enhanced ad blocking

4. **Netflix**
   - Profile management
   - Watch history sync

5. **Spotify Premium**
   - Ad-free music
   - Offline downloads

6. **QuillBot Premium**
   - Paraphrasing tools
   - Grammar checker
   - Logout blocking enabled

7. **Custom Services**
   - Any web-based subscription service
   - Configurable domain restrictions


### 💾 Session Backup & Restore

#### **Automatic Backup**
- Sessions automatically backed up when closing account
- Compressed to ZIP format
- Uploaded to cloud storage (API server)
- Local backup as fallback

#### **Manual Backup**
```javascript
// Trigger manual backup
ipcRenderer.invoke('backup-session', accountId, partitionId);
```

#### **Restore Process**
1. Download session ZIP from API
2. Extract to partition directory
3. Restore cookies and localStorage
4. Reopen account with restored session

#### **Backup Contents**
- Cookies
- LocalStorage data
- IndexedDB (if applicable)
- Session storage
- Cache files

### 🔄 Multi-Device Session Sync

#### **Cloud Sync Architecture**
```
Device A                    API Server                Device B
   │                            │                         │
   ├─── Sync Up ──────────────►│                         │
   │    (Upload session)        │                         │
   │                            │◄──── Sync Down ────────┤
   │                            │      (Download session) │
   │                            │                         │
```

#### **Sync Operations**

**1. Sync Up (Upload)**
```javascript
await ipcRenderer.invoke('session-sync-up');
```
- Collects all session data
- Compresses and encrypts
- Uploads to API server
- Updates `user_sessions` table

**2. Sync Down (Download)**
```javascript
await ipcRenderer.invoke('session-sync-down');
```
- Downloads latest session data
- Decrypts and extracts
- Applies to local partitions
- Updates last sync timestamp

**3. Full Sync**
```javascript
await ipcRenderer.invoke('session-full-sync');
```
- Performs sync up first
- Then sync down
- Ensures all devices have latest state

#### **Conflict Resolution**
- Last-write-wins strategy
- Timestamp-based comparison
- Manual merge for critical conflicts

### 📱 Device Management

#### **Machine ID**
- Unique identifier per device
- Generated using hardware info
- Used for session tracking

#### **Device Fingerprinting**
```javascript
const fingerprint = {
  machineId: getMachineId(),
  platform: process.platform,
  arch: process.arch,
  hostname: os.hostname(),
  userAgent: navigator.userAgent
};
```

#### **Session Limits**
- Maximum 5 devices per user (configurable)
- Oldest device automatically logged out when limit reached
- Admin can view all active devices

### 🎨 User Interface

#### **Login Screen**
- Clean, modern design
- Gradient background
- Remember me option
- Force login option (if session exists)

#### **Dashboard**
- Grid layout of available accounts
- Service icons and names
- Quick access buttons
- Session status indicators

#### **Account Window**
- Full-screen browsing experience
- Custom title bar
- Session controls
- Domain restriction enforcement

#### **Admin Panel**
- User management
- Account management
- Activity logs viewer
- System settings

---

## 8. Installation & Setup

### Prerequisites

#### **For Desktop App**
- Windows 10/11, macOS 10.14+, or Linux
- 4GB RAM minimum
- 500MB free disk space
- Internet connection

#### **For Backend API**
- PHP 7.4 or higher
- MySQL 5.7 or higher
- Apache/Nginx web server
- SSL certificate (recommended)

### Backend Setup

#### **Step 1: Database Setup**

1. Create MySQL database:
```sql
CREATE DATABASE wokushop_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Create database user:
```sql
CREATE USER 'wokushop_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON wokushop_db.* TO 'wokushop_user'@'localhost';
FLUSH PRIVILEGES;
```

#### **Step 2: Configure Environment**

1. Copy `.env.example` to `.env`:
```bash
cd wokushop-api
cp .env.example .env
```

2. Edit `.env` file:
```env
# Database Configuration
DB_HOST=localhost
DB_NAME=wokushop_db
DB_USER=wokushop_user
DB_PASS=secure_password

# JWT Authentication
JWT_SECRET=your_very_secure_random_string_here
JWT_EXPIRY=86400

# API Configuration
API_BASE_URL=https://yourdomain.com/wokushop-api
CORS_ORIGIN=*
```

#### **Step 3: Initialize Database**

Run the initialization script:
```bash
php wokushop-api/init.php
```

Or visit in browser:
```
https://yourdomain.com/wokushop-api/init.php
```

This will:
- Create all required tables
- Set up indexes
- Create default admin account (username: `admin`, password: `admin123`)

⚠️ **Important**: Change the default admin password immediately!

#### **Step 4: Configure Web Server**

**Apache (.htaccess)**
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]

# Enable CORS
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type, Authorization, X-Auth-Token"
```

**Nginx**
```nginx
location /wokushop-api {
    try_files $uri $uri/ /index.php?$query_string;

    # Enable CORS
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Auth-Token";
}
```


### Desktop App Setup

#### **Step 1: Install Dependencies**

```bash
cd wokushop-account-manager
npm install
```

#### **Step 2: Configure API URL**

Edit `config/config.js`:
```javascript
module.exports = {
  API_BASE_URL: 'https://yourdomain.com/wokushop-api',
  // ... other settings
};
```

#### **Step 3: Run in Development Mode**

```bash
npm run dev
```

Or with cache clearing:
```bash
npm run fresh-dev
```

#### **Step 4: Build for Production**

**Windows:**
```bash
npm run build:win
```

**macOS:**
```bash
npm run build:mac
```

**Linux:**
```bash
npm run build:linux
```

Built files will be in `dist/` directory.

### First-Time Setup

#### **1. Admin Login**
- Username: `admin`
- Password: `admin123`
- **Change password immediately!**

#### **2. Create Users**
1. Go to Admin Panel → Users
2. Click "Add User"
3. Enter username and password
4. Assign role (admin/user)

#### **3. Add Accounts**
1. Go to Admin Panel → Accounts
2. Click "Add Account"
3. Fill in details:
   - Service Name (e.g., "ChatGPT Premium")
   - Service Type (e.g., "chatgpt")
   - Partition ID (unique, e.g., "chatgpt-001")
   - Login URL (e.g., "https://chat.openai.com")
4. Save account

#### **4. Configure Domain Restrictions**
1. Go to Admin Panel → Services
2. Select service type
3. Add allowed domains
4. Save configuration

#### **5. Assign Accounts to Users**
1. Go to Admin Panel → Users
2. Select user
3. Click "Assign Accounts"
4. Select accounts to assign
5. Save

---

## 9. Development Guide

### Project Structure

```
wokushop-account-manager/
├── config/
│   └── config.js                 # Application configuration
├── src/
│   ├── main/
│   │   ├── main.js              # Main process entry point
│   │   ├── session-manager.js   # Session backup/restore
│   │   ├── session-sync-manager.js  # Cloud sync
│   │   ├── chatgpt-logout-blocker.js  # ChatGPT security
│   │   ├── quillbot-logout-blocker.js # QuillBot security
│   │   ├── youtube-ad-blocker-*.js    # YouTube ad blocking
│   │   └── extension-loader-*.js      # Extension management
│   ├── renderer/
│   │   ├── index.html           # Login page
│   │   └── dashboard.html       # Main dashboard
│   ├── assets/
│   │   ├── css/                 # Stylesheets
│   │   ├── js/
│   │   │   ├── api.js          # API client
│   │   │   ├── dashboard.js    # Dashboard logic
│   │   │   └── login.js        # Login logic
│   │   └── images/             # Icons and images
│   ├── preload/
│   │   └── universal-logout-blocker.js  # Preload security
│   └── utils/                   # Utility functions
├── extensions/
│   └── ublock-origin-lite/      # Ad blocker extension
├── package.json
└── README.md

wokushop-api/
├── config/
│   ├── database.php             # Database connection
│   ├── auth.php                 # JWT authentication
│   ├── session-manager.php      # Session management
│   ├── strict-session-manager.php  # Strict mode
│   └── ip-helper.php            # IP utilities
├── auth/
│   ├── login.php                # Login endpoint
│   ├── login-strict.php         # Strict login
│   ├── force-login.php          # Force login
│   ├── logout.php               # Logout endpoint
│   └── verify.php               # Token verification
├── accounts/
│   ├── list.php                 # List accounts
│   ├── create.php               # Create account
│   ├── update.php               # Update account
│   ├── delete.php               # Delete account
│   └── assign.php               # Assign to user
├── sessions/
│   ├── backup.php               # Upload session
│   ├── download.php             # Download session
│   ├── sync-up.php              # Sync to cloud
│   └── sync-down.php            # Sync from cloud
├── cookies/
│   ├── save.php                 # Save cookies
│   └── get.php                  # Get cookies
├── services/
│   ├── list.php                 # List services
│   └── domains.php              # Domain restrictions
├── logs/
│   ├── activity.php             # Log activity
│   └── list.php                 # View logs
├── users/
│   ├── list.php                 # List users
│   ├── create.php               # Create user
│   ├── update.php               # Update user
│   └── delete.php               # Delete user
├── .env.example                 # Environment template
└── init.php                     # Database initialization
```

### Key Technologies & Patterns

#### **Electron IPC Communication**

**Main Process → Renderer:**
```javascript
// Main process
mainWindow.webContents.send('session-updated', sessionData);

// Renderer process
ipcRenderer.on('session-updated', (event, data) => {
  console.log('Session updated:', data);
});
```

**Renderer → Main Process:**
```javascript
// Renderer (async)
const result = await ipcRenderer.invoke('backup-session', accountId);

// Main process
ipcMain.handle('backup-session', async (event, accountId) => {
  return await sessionManager.backup(accountId);
});
```

#### **Session Partitions**

Each account uses isolated session partition:
```javascript
const sessionWindow = new BrowserWindow({
  webPreferences: {
    partition: `persist:${partitionId}`,  // Persistent partition
    contextIsolation: true,
    nodeIntegration: false
  }
});
```

Benefits:
- Isolated cookies per account
- No cross-contamination
- Persistent across restarts

#### **Security Injection**

Preload scripts inject security code:
```javascript
// In main process
sessionWindow.webContents.on('did-finish-load', () => {
  sessionWindow.webContents.executeJavaScript(logoutBlockerCode);
});
```

#### **API Authentication**

All API requests include JWT token:
```javascript
const response = await axios.get(`${API_BASE_URL}/accounts/list.php`, {
  headers: {
    'Authorization': `Bearer ${authToken}`
  }
});
```

### Adding New Service Type

#### **1. Add Service Configuration**

In database:
```sql
INSERT INTO services (service_type, display_name, default_url)
VALUES ('newservice', 'New Service', 'https://newservice.com');
```

#### **2. Add Domain Restrictions**

```sql
INSERT INTO domain_restrictions (service_type, domain)
VALUES
  ('newservice', 'newservice.com'),
  ('newservice', 'auth.newservice.com');
```

#### **3. Create Logout Blocker (if needed)**

Create `src/main/newservice-logout-blocker.js`:
```javascript
(function() {
  'use strict';

  // Block logout requests
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (url.includes('logout')) {
      console.warn('Logout blocked');
      return Promise.reject(new Error('Blocked'));
    }
    return originalFetch.apply(this, arguments);
  };

  // Hide logout buttons
  function hideLogoutButtons() {
    document.querySelectorAll('[data-logout]').forEach(el => {
      el.style.display = 'none';
    });
  }

  setInterval(hideLogoutButtons, 1000);
})();
```

#### **4. Update Main Process**

In `src/main/main.js`:
```javascript
if (serviceType === 'newservice') {
  const logoutBlocker = fs.readFileSync(
    path.join(__dirname, 'newservice-logout-blocker.js'),
    'utf8'
  );

  sessionWindow.webContents.on('did-finish-load', () => {
    sessionWindow.webContents.executeJavaScript(logoutBlocker);
  });
}
```


### Debugging Tips

#### **Enable Developer Tools**

Development mode:
```bash
npm run dev  # DevTools automatically open
```

Production mode:
```javascript
// In main.js, temporarily enable:
mainWindow.webContents.openDevTools();
```

#### **View Logs**

**Main Process Logs:**
- Windows: `%APPDATA%\wokushop-account-manager\logs\`
- macOS: `~/Library/Logs/wokushop-account-manager/`
- Linux: `~/.config/wokushop-account-manager/logs/`

**Console Logs:**
```javascript
// Add debug logging
console.log('🔍 [Debug]', variable);
```

#### **Common Issues**

**Session not persisting:**
- Check partition ID is unique
- Verify session backup completed
- Check API server connectivity

**Logout blocker not working:**
- Verify script injection in DevTools console
- Check for JavaScript errors
- Ensure preload script loaded

**API connection failed:**
- Verify API_BASE_URL in config
- Check CORS headers on server
- Verify SSL certificate (if HTTPS)

---

## 10. Deployment

### Production Deployment Checklist

#### **Backend (API Server)**

- [ ] Set up production database
- [ ] Configure `.env` with secure credentials
- [ ] Change default admin password
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set up database backups
- [ ] Configure PHP error logging
- [ ] Optimize MySQL queries (indexes)
- [ ] Set up monitoring (uptime, errors)
- [ ] Configure firewall rules

#### **Desktop Application**

- [ ] Update API_BASE_URL to production
- [ ] Remove debug code
- [ ] Disable DevTools in production
- [ ] Test on all target platforms
- [ ] Code signing (Windows/macOS)
- [ ] Create installer packages
- [ ] Test auto-update mechanism
- [ ] Prepare release notes
- [ ] Upload to distribution server

### Building Production Releases

#### **Windows (NSIS Installer)**

```bash
npm run build:win
```

Output: `dist/Wokushop Account Manager Setup 1.0.0.exe`

**Code Signing (Optional):**
```javascript
// In package.json build config
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "password",
  "signingHashAlgorithms": ["sha256"]
}
```

#### **macOS (DMG)**

```bash
npm run build:mac
```

Output: `dist/Wokushop Account Manager-1.0.0.dmg`

**Code Signing:**
```javascript
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist"
}
```

**Notarization:**
```bash
xcrun altool --notarize-app \
  --primary-bundle-id "com.wokushop.accountmanager" \
  --username "apple@email.com" \
  --password "@keychain:AC_PASSWORD" \
  --file "dist/Wokushop Account Manager-1.0.0.dmg"
```

#### **Linux (AppImage)**

```bash
npm run build:linux
```

Output: `dist/Wokushop Account Manager-1.0.0.AppImage`

### Server Configuration

#### **Cloudflare Setup (Recommended)**

1. **DNS Configuration:**
   - A record: `db.handymancode.com` → Server IP
   - Proxy status: DNS only (disable orange cloud for API)

2. **SSL/TLS:**
   - Mode: Full (strict)
   - Always Use HTTPS: On
   - Minimum TLS Version: 1.2

3. **Firewall Rules:**
   - Allow API endpoints
   - Block admin endpoints from public
   - Rate limiting on login endpoints

#### **WordOps/EasyEngine Setup**

```bash
# Install WordOps
wget -qO wo wops.cc && sudo bash wo

# Create site
sudo wo site create db.handymancode.com --php74 --mysql

# Upload API files
sudo rsync -avz wokushop-api/ /var/www/db.handymancode.com/htdocs/wokushop-api/

# Set permissions
sudo chown -R www-data:www-data /var/www/db.handymancode.com/
sudo chmod -R 755 /var/www/db.handymancode.com/

# Enable SSL
sudo wo site update db.handymancode.com --letsencrypt
```

#### **Database Optimization**

```sql
-- Add indexes for performance
CREATE INDEX idx_user_accounts_active ON user_accounts(user_id, is_active);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_activity_logs_user_date ON activity_logs(user_id, created_at);

-- Optimize tables
OPTIMIZE TABLE users, accounts, sessions, cookies, activity_logs;

-- Set up automatic cleanup
CREATE EVENT cleanup_expired_sessions
ON SCHEDULE EVERY 1 DAY
DO DELETE FROM sessions WHERE expires_at < NOW();

CREATE EVENT cleanup_old_logs
ON SCHEDULE EVERY 1 WEEK
DO DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### Security Hardening

#### **API Server**

1. **Disable directory listing:**
```apache
Options -Indexes
```

2. **Hide PHP version:**
```ini
expose_php = Off
```

3. **Restrict file uploads:**
```php
// In php.ini
upload_max_filesize = 50M
post_max_size = 50M
max_file_uploads = 10
```

4. **SQL injection prevention:**
```php
// Always use prepared statements
$stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$userId]);
```

5. **XSS prevention:**
```php
echo htmlspecialchars($userInput, ENT_QUOTES, 'UTF-8');
```

#### **Desktop App**

1. **Content Security Policy:**
```javascript
session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'"]
    }
  });
});
```

2. **Disable remote module:**
```javascript
webPreferences: {
  enableRemoteModule: false,
  nodeIntegration: false,
  contextIsolation: true
}
```

### Monitoring & Maintenance

#### **Health Checks**

Create `wokushop-api/health.php`:
```php
<?php
header('Content-Type: application/json');

$health = [
    'status' => 'ok',
    'timestamp' => time(),
    'database' => 'unknown',
    'api_version' => '1.0.0'
];

try {
    require_once 'config/database.php';
    $db = new Database();
    $conn = $db->getConnection();
    $health['database'] = 'connected';
} catch (Exception $e) {
    $health['status'] = 'error';
    $health['database'] = 'disconnected';
}

echo json_encode($health);
```

#### **Backup Strategy**

**Database Backups:**
```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/wokushop"
DB_NAME="wokushop_db"

mkdir -p $BACKUP_DIR

mysqldump -u root -p$DB_PASSWORD $DB_NAME | gzip > $BACKUP_DIR/wokushop_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "wokushop_*.sql.gz" -mtime +30 -delete
```

**Session Backups:**
- Stored in database (automatic)
- Optional: Sync to S3/cloud storage
- Retention: 90 days

#### **Update Mechanism**

**Auto-update configuration:**
```javascript
// In package.json
"build": {
  "publish": [{
    "provider": "generic",
    "url": "https://yourdomain.com/updates/"
  }]
}
```

**Update server structure:**
```
updates/
├── latest.yml
├── Wokushop-Account-Manager-Setup-1.0.0.exe
├── Wokushop-Account-Manager-1.0.0.dmg
└── Wokushop-Account-Manager-1.0.0.AppImage
```

---

## 11. Troubleshooting

### Common Issues & Solutions

#### **Issue: "Cannot connect to API"**

**Symptoms:**
- Login fails with network error
- Dashboard doesn't load accounts

**Solutions:**
1. Check API_BASE_URL in `config/config.js`
2. Verify API server is running
3. Check CORS headers on server
4. Test API directly: `curl https://yourdomain.com/wokushop-api/health.php`
5. Check firewall/antivirus blocking connection

#### **Issue: "Session not persisting after restart"**

**Symptoms:**
- Need to login again to services
- Cookies not saved

**Solutions:**
1. Verify partition ID is unique and consistent
2. Check session backup completed (look for success message in logs)
3. Ensure API server has write permissions for uploads
4. Try manual backup: Right-click account → Backup Session
5. Check `session_backups` table in database


#### **Issue: "Logout blocker not working"**

**Symptoms:**
- User can still logout from service
- Logout button visible

**Solutions:**
1. Open DevTools and check console for blocker messages
2. Verify script injection: Look for "Logout Blocker initialized" message
3. Check if service has new logout mechanism
4. Update logout blocker script for that service
5. For admin users: Logout blocking is intentionally disabled

#### **Issue: "Domain restriction not working"**

**Symptoms:**
- User can navigate to unauthorized domains
- No redirect happening

**Solutions:**
1. Check `domain_restrictions` table has entries for service type
2. Verify user role (admins bypass restrictions)
3. Check console for "Blocked navigation" messages
4. Ensure `will-navigate` event handler is registered
5. Restart application after changing restrictions

#### **Issue: "YouTube ads still showing"**

**Symptoms:**
- Ads play before videos
- Banner ads visible

**Solutions:**
1. Verify uBlock extension loaded: Check console for "uBlock loaded" message
2. Clear browser cache: Close account, delete partition, reopen
3. Check ad blocking rules in main.js
4. Update uBlock filter lists
5. Try different YouTube account (some ads are server-side)

#### **Issue: "Gemini not loading properly"**

**Symptoms:**
- Blank page or CSP errors
- "Refused to load" errors in console

**Solutions:**
1. Verify `webSecurity: false` for Gemini in main.js
2. Check Content-Security-Policy headers
3. Clear Gemini partition and restart
4. Update Electron to latest version
5. Check Google account permissions

#### **Issue: "Multi-device sync not working"**

**Symptoms:**
- Sessions not syncing between devices
- Login required on new device

**Solutions:**
1. Check `user_sessions` table has entries
2. Verify machine_id is unique per device
3. Test sync endpoints manually:
   ```bash
   curl -X POST https://api.com/sessions/sync-up.php \
     -H "Authorization: Bearer TOKEN" \
     -d '{"machine_id":"device-123"}'
   ```
4. Check API server logs for sync errors
5. Ensure both devices have same user account

#### **Issue: "High memory usage"**

**Symptoms:**
- Application uses >1GB RAM
- System slowdown

**Solutions:**
1. Close unused account windows
2. Clear cache: `npm run clear-cache`
3. Reduce number of open accounts
4. Check for memory leaks in DevTools
5. Restart application periodically

#### **Issue: "Database connection failed"**

**Symptoms:**
- API returns 500 errors
- "Connection refused" in logs

**Solutions:**
1. Check MySQL service is running
2. Verify database credentials in `.env`
3. Test connection: `mysql -u user -p database`
4. Check MySQL max_connections setting
5. Restart MySQL service

### Performance Optimization

#### **Desktop App**

1. **Reduce startup time:**
```javascript
// Lazy load heavy modules
const heavyModule = require('heavy-module'); // Only when needed
```

2. **Optimize session windows:**
```javascript
// Limit concurrent windows
const MAX_WINDOWS = 5;
if (sessionWindows.size >= MAX_WINDOWS) {
  // Close oldest window
}
```

3. **Cache API responses:**
```javascript
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function fetchWithCache(url) {
  if (cache.has(url)) {
    const { data, timestamp } = cache.get(url);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }

  const data = await fetch(url);
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}
```

#### **Backend API**

1. **Enable query caching:**
```sql
-- In my.cnf
query_cache_type = 1
query_cache_size = 64M
query_cache_limit = 2M
```

2. **Optimize slow queries:**
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- Analyze slow queries
SELECT * FROM mysql.slow_log;
```

3. **Use connection pooling:**
```php
class Database {
    private static $instance = null;

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
}
```

4. **Implement response caching:**
```php
// Cache API responses
$cacheKey = 'accounts_list_' . $userId;
$cached = apcu_fetch($cacheKey);

if ($cached !== false) {
    echo $cached;
    exit;
}

// Generate response
$response = json_encode($data);
apcu_store($cacheKey, $response, 300); // 5 minutes
echo $response;
```

---

## 12. FAQ

### General Questions

**Q: Can I use this for personal use?**
A: Yes, the application is designed for both personal and team use.

**Q: How many accounts can I manage?**
A: Unlimited accounts. Performance depends on your hardware.

**Q: Does it work offline?**
A: Partially. You can access accounts offline, but login/sync requires internet.

**Q: Is my data secure?**
A: Yes. Passwords are bcrypt hashed, cookies are encrypted, and all communication uses HTTPS.

### Technical Questions

**Q: Can I self-host the API?**
A: Yes, full source code is provided. See Installation & Setup section.

**Q: What databases are supported?**
A: Currently MySQL 5.7+. MariaDB should work but is untested.

**Q: Can I customize the UI?**
A: Yes, edit files in `src/assets/css/` and `src/renderer/`.

**Q: How do I add a new service?**
A: See "Adding New Service Type" in Development Guide section.

**Q: Can I disable logout blocking for specific users?**
A: Yes, logout blocking is automatically disabled for admin users.

### Troubleshooting Questions

**Q: Why can't I login to the app?**
A: Check API connection, verify credentials, check browser console for errors.

**Q: Why are sessions not syncing?**
A: Verify API connectivity, check machine_id, ensure sync endpoints are working.

**Q: Why is YouTube still showing ads?**
A: Some ads are server-side and cannot be blocked. Try clearing cache.

**Q: Can I use this on multiple computers?**
A: Yes, sessions sync across devices automatically.

---

## 13. Changelog

### Version 1.0.0 (Current)

**Features:**
- ✅ Multi-account management
- ✅ Role-based access control (Admin/User)
- ✅ Session backup & restore
- ✅ Multi-device session sync
- ✅ Logout prevention system (5 layers)
- ✅ Domain restriction enforcement
- ✅ Ad blocking (uBlock Origin Lite)
- ✅ YouTube ad blocking (enhanced)
- ✅ Cookie persistence
- ✅ Activity logging
- ✅ JWT authentication
- ✅ Single session per IP
- ✅ Force login option

**Supported Services:**
- ChatGPT (OpenAI)
- Gemini (Google)
- YouTube Premium
- Netflix
- Spotify Premium
- QuillBot Premium
- Custom services

**Platforms:**
- Windows 10/11
- macOS 10.14+
- Linux (Ubuntu, Debian, Fedora)

---

## 14. Credits & License

### Development Team

- **Project Lead**: WokuShop Team
- **Backend API**: PHP/MySQL
- **Desktop App**: Electron + Node.js
- **Documentation**: Comprehensive technical docs

### Third-Party Libraries

- **Electron** - Desktop app framework (MIT License)
- **uBlock Origin Lite** - Ad blocking (GPLv3)
- **Axios** - HTTP client (MIT License)
- **electron-store** - Data persistence (MIT License)
- **archiver** - ZIP compression (MIT License)
- **node-machine-id** - Device fingerprinting (MIT License)

### License

This project is licensed under the **ISC License**.

```
Copyright (c) 2024 WokuShop

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

---

## 15. Support & Contact

### Getting Help

1. **Documentation**: Read this comprehensive guide
2. **GitHub Issues**: Report bugs and feature requests
3. **Email Support**: contact@wokushop.com
4. **Community Forum**: [forum.wokushop.com](https://forum.wokushop.com)

### Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Reporting Bugs

When reporting bugs, please include:
- Operating system and version
- Application version
- Steps to reproduce
- Expected vs actual behavior
- Console logs and screenshots

### Feature Requests

Have an idea? We'd love to hear it!
- Open a GitHub issue with "Feature Request" label
- Describe the feature and use case
- Explain why it would be valuable

---

## 16. Appendix

### Glossary

- **Partition**: Isolated session storage in Electron
- **JWT**: JSON Web Token for authentication
- **IPC**: Inter-Process Communication in Electron
- **CORS**: Cross-Origin Resource Sharing
- **CSP**: Content Security Policy
- **Preload Script**: Script that runs before page loads
- **Session Sync**: Synchronizing session data across devices
- **Logout Blocker**: Security feature preventing logout

### Useful Commands

```bash
# Development
npm run dev                 # Run in development mode
npm run fresh-dev          # Clear cache and run dev
npm run clear-cache        # Clear application cache

# Building
npm run build              # Build for current platform
npm run build:win          # Build for Windows
npm run build:mac          # Build for macOS
npm run build:linux        # Build for Linux

# Database
php init.php               # Initialize database
mysql -u root -p < backup.sql  # Restore database

# Server
sudo wo site create domain.com --php74  # Create site with WordOps
sudo systemctl restart mysql            # Restart MySQL
sudo systemctl restart nginx            # Restart Nginx
```

### API Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate) |
| 500 | Internal Server Error | Server error |

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_NAME=wokushop_db
DB_USER=wokushop_user
DB_PASS=secure_password

# JWT
JWT_SECRET=random_secret_key
JWT_EXPIRY=86400

# API
API_BASE_URL=https://api.domain.com
CORS_ORIGIN=*

# Security
PASSWORD_MIN_LENGTH=8
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900

# Application
APP_ENV=production
DEBUG_MODE=false
LOG_LEVEL=info
```

---

**End of Documentation**

*Last Updated: November 19, 2025*
*Version: 1.0.0*
*Author: WokuShop Development Team*

