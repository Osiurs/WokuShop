# Extensions Guide - uBlock Origin Lite Integration

## Tổng quan

Hệ thống đã được tích hợp tính năng quản lý extensions cho các dịch vụ. **YouTube và Spotify** mặc định sẽ có **uBlock Origin Lite** để chặn quảng cáo.

## Thay đổi Database

### 1. Bảng `extensions` - Bảng mới:
```sql
CREATE TABLE extensions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    extension_name VARCHAR(100) NOT NULL,
    extension_id VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    download_url VARCHAR(500),
    version VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
```

### 2. Bảng `service_extensions` - Junction table:
```sql
CREATE TABLE service_extensions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_type VARCHAR(50) NOT NULL,
    extension_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_type) REFERENCES services(service_type) ON DELETE CASCADE,
    FOREIGN KEY (extension_id) REFERENCES extensions(extension_id) ON DELETE CASCADE,
    UNIQUE KEY unique_service_extension (service_type, extension_id)
)
```

## Extension mặc định

### uBlock Origin Lite
- **Extension ID:** `ublock-origin-lite`
- **Chrome Web Store ID:** `ddkjiahejlhfcafbddmgiahcphecmpfh`
- **Version:** 2025.1012.1712
- **Manifest V3:** ✅ Tương thích
- **Download:** https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh
- **Được gán cho:** YouTube, Spotify

## API Endpoints

### 1. Lấy danh sách extensions
**GET** `/extensions/list.php`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "extension_name": "uBlock Origin Lite",
      "extension_id": "ublock-origin-lite",
      "description": "Ad blocker for Chromium browsers (Manifest V3)",
      "download_url": "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh",
      "version": "2025.1012.1712",
      "is_active": true,
      "services": [
        {
          "service_type": "youtube",
          "display_name": "YouTube",
          "icon_emoji": "📺"
        },
        {
          "service_type": "spotify",
          "display_name": "Spotify",
          "icon_emoji": "🎵"
        }
      ]
    }
  ]
}
```

### 2. Gán extensions cho service (Admin only)
**POST** `/extensions/assign-to-service.php`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "service_type": "youtube",
  "extension_ids": ["ublock-origin-lite", "other-extension-id"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Extensions assigned successfully."
}
```

### 3. Services với extensions (Updated)
**GET** `/services/list.php`

Bây giờ response bao gồm field `extensions`:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "service_type": "youtube",
      "display_name": "YouTube",
      "login_url": "https://www.youtube.com",
      "icon_emoji": "📺",
      "requires_user_credentials": true,
      "allowed_domains": ["youtube.com", "www.youtube.com"],
      "extensions": [
        {
          "id": 1,
          "extension_name": "uBlock Origin Lite",
          "extension_id": "ublock-origin-lite",
          "description": "Ad blocker for Chromium browsers (Manifest V3)",
          "download_url": "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh",
          "version": "2025.1012.1712",
          "is_active": true
        }
      ]
    }
  ]
}
```

### 4. User services với extensions (Updated)
**GET** `/users/services.php?user_id={userId}`

Cũng bao gồm field `extensions` cho mỗi service.

## Tích hợp với Electron App

### Bước 1: Download extension

Có 2 cách:

#### Cách 1: Tải từ Chrome Web Store (Khuyến nghị)
```javascript
// Sử dụng Chrome Web Store ID
const extensionId = 'ddkjiahejlhfcafbddmgiahcphecmpfh';
const extensionUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=98.0.4758.102&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;

// Download .crx file
const response = await fetch(extensionUrl);
const crxBuffer = await response.arrayBuffer();
await fs.promises.writeFile('./extensions/ublock-origin-lite.crx', Buffer.from(crxBuffer));
```

#### Cách 2: Giải nén từ .crx thành thư mục
```bash
# Cách thủ công:
1. Tải extension từ Chrome Web Store
2. Giải nén file .crx (là file ZIP)
3. Lưu vào thư mục: ./extensions/ublock-origin-lite/
```

### Bước 2: Load extension trong Electron

```javascript
const { app, session, BrowserWindow } = require('electron');
const path = require('path');

// Đường dẫn tới extension đã giải nén
const extensionPath = path.join(__dirname, 'extensions', 'ublock-origin-lite');

app.whenReady().then(async () => {
  // Load extension vào session mặc định
  try {
    await session.defaultSession.loadExtension(extensionPath, {
      allowFileAccess: true
    });
    console.log('uBlock Origin Lite loaded successfully');
  } catch (err) {
    console.error('Failed to load extension:', err);
  }
});
```

### Bước 3: Load extension cho partition riêng (User credentials)

```javascript
async function loadServiceForUser(serviceType, userId) {
  // Lấy service info từ API
  const response = await fetch(`${API_URL}/users/services.php?user_id=${userId}`);
  const { services } = await response.json();

  const service = services.find(s => s.service_type === serviceType);

  if (!service) {
    throw new Error('Service not found or not assigned to user');
  }

  // Tạo hoặc lấy partition cho user
  const partitionName = service.user_account?.partition_id || 'default';
  const ses = session.fromPartition(partitionName);

  // Load extensions cho partition này
  for (const ext of service.extensions) {
    const extPath = path.join(__dirname, 'extensions', ext.extension_id);

    try {
      await ses.loadExtension(extPath, { allowFileAccess: true });
      console.log(`Extension ${ext.extension_name} loaded for partition ${partitionName}`);
    } catch (err) {
      console.error(`Failed to load extension ${ext.extension_name}:`, err);
    }
  }

  // Tạo BrowserWindow với partition
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      partition: partitionName,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL(service.login_url);
}

// Ví dụ sử dụng
loadServiceForUser('youtube', 5); // Load YouTube cho user ID 5
```

### Bước 4: Auto-download extensions khi cần

```javascript
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const extract = require('extract-zip');

async function downloadAndInstallExtension(extensionInfo) {
  const { extension_id, download_url } = extensionInfo;
  const extensionsDir = path.join(__dirname, 'extensions');
  const extensionDir = path.join(extensionsDir, extension_id);

  // Kiểm tra extension đã có chưa
  if (fs.existsSync(extensionDir)) {
    console.log(`Extension ${extension_id} already exists`);
    return extensionDir;
  }

  // Tạo thư mục extensions nếu chưa có
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }

  try {
    // Download .crx từ Chrome Web Store
    const chromeStoreId = download_url.match(/\/detail\/[^\/]+\/([a-z]+)/)?.[1];
    if (!chromeStoreId) {
      throw new Error('Invalid Chrome Web Store URL');
    }

    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=98.0.4758.102&acceptformat=crx2,crx3&x=id%3D${chromeStoreId}%26uc`;
    const crxPath = path.join(extensionsDir, `${extension_id}.crx`);

    // Download
    const response = await axios.get(crxUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(crxPath, response.data);

    // Giải nén (CRX file là ZIP với header đặc biệt)
    // Bỏ qua header CRX (thường là 16 bytes đầu)
    const crxBuffer = fs.readFileSync(crxPath);
    const zipBuffer = crxBuffer.slice(16); // Skip CRX header
    const zipPath = path.join(extensionsDir, `${extension_id}.zip`);
    fs.writeFileSync(zipPath, zipBuffer);

    // Extract
    await extract(zipPath, { dir: extensionDir });

    // Cleanup
    fs.unlinkSync(crxPath);
    fs.unlinkSync(zipPath);

    console.log(`Extension ${extension_id} downloaded and installed successfully`);
    return extensionDir;
  } catch (err) {
    console.error(`Failed to download extension ${extension_id}:`, err);
    throw err;
  }
}

// Sử dụng
async function setupExtensionsForService(service) {
  for (const ext of service.extensions) {
    await downloadAndInstallExtension(ext);
  }
}
```

## Cấu trúc thư mục đề xuất

```
your-electron-app/
├── extensions/
│   ├── ublock-origin-lite/        # Extension đã giải nén
│   │   ├── manifest.json
│   │   ├── background.js
│   │   └── ...
│   └── another-extension/
│       └── ...
├── main.js
├── package.json
└── ...
```

## Lưu ý quan trọng

### 1. Manifest V3 Compatibility
- ✅ uBlock Origin Lite được thiết kế cho MV3
- ✅ Hoạt động với Chromium/Electron mới nhất
- ✅ Không cần background script persistent

### 2. Extension Loading
- Extensions phải được load **TRƯỚC KHI** tạo BrowserWindow
- Mỗi partition cần load extension riêng
- Extension path phải là absolute path

### 3. Permissions
- Extension cần quyền truy cập file: `allowFileAccess: true`
- Một số extension cần thêm permissions trong Electron

### 4. Updates
- Electron không tự động update extensions
- Cần implement logic để check và update extensions
- Có thể lưu version trong database để so sánh

## Example: Complete Implementation

```javascript
// main.js
const { app, session, BrowserWindow } = require('electron');
const path = require('path');
const axios = require('axios');

const API_URL = 'http://localhost/wokushop-api';
let authToken = null;

// Login và lấy token
async function login(username, password) {
  const response = await axios.post(`${API_URL}/auth/login.php`, {
    username,
    password
  });
  authToken = response.data.token;
  return response.data;
}

// Lấy services của user
async function getUserServices(userId) {
  const response = await axios.get(`${API_URL}/users/services.php?user_id=${userId}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return response.data.services;
}

// Load extension cho partition
async function loadExtensionsForPartition(partitionName, extensions) {
  const ses = session.fromPartition(partitionName);

  for (const ext of extensions) {
    const extPath = path.join(__dirname, 'extensions', ext.extension_id);

    try {
      await ses.loadExtension(extPath, { allowFileAccess: true });
      console.log(`✅ ${ext.extension_name} loaded for ${partitionName}`);
    } catch (err) {
      console.error(`❌ Failed to load ${ext.extension_name}:`, err);
    }
  }
}

// Mở service window
async function openServiceWindow(service) {
  const partitionName = service.user_account?.partition_id || 'default';

  // Load extensions
  if (service.extensions && service.extensions.length > 0) {
    await loadExtensionsForPartition(partitionName, service.extensions);
  }

  // Create window
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      partition: partitionName,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  win.loadURL(service.login_url);

  win.webContents.on('did-finish-load', () => {
    console.log(`${service.display_name} loaded successfully`);
  });
}

// Main flow
app.whenReady().then(async () => {
  try {
    // Login
    const loginData = await login('testuser', 'password123');
    console.log('Logged in as:', loginData.user.username);

    // Get services
    const services = await getUserServices(loginData.user.id);
    console.log('User has access to:', services.map(s => s.display_name));

    // Tìm YouTube service
    const youtube = services.find(s => s.service_type === 'youtube');
    if (youtube) {
      console.log('Opening YouTube with extensions:', youtube.extensions.map(e => e.extension_name));
      await openServiceWindow(youtube);
    }

  } catch (err) {
    console.error('Error:', err);
  }
});
```

## Testing

### Test 1: Kiểm tra extensions đã được gán
```bash
GET http://localhost/wokushop-api/services/list.php

# Kiểm tra YouTube có ublock-origin-lite
```

### Test 2: Load extension trong Electron
```javascript
// Kiểm tra extension đã load
session.defaultSession.getAllExtensions().forEach(ext => {
  console.log('Extension loaded:', ext.name, ext.id);
});
```

### Test 3: Verify ad blocking
1. Mở YouTube trong Electron app
2. Play video có quảng cáo
3. Xác nhận quảng cáo bị chặn

## Troubleshooting

### Extension không load
- Kiểm tra path tới extension folder
- Kiểm tra manifest.json có hợp lệ không
- Kiểm tra Electron version có hỗ trợ MV3 không (cần Electron 20+)

### Extension load nhưng không hoạt động
- Kiểm tra permissions trong manifest.json
- Kiểm tra extension có tương thích MV3 không
- Xem console log để debug

### Extension biến mất sau khi restart
- Extensions cần được load lại mỗi lần app start
- Implement caching để load nhanh hơn
