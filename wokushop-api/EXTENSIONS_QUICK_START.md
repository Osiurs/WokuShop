# Extensions Quick Start - uBlock Origin Lite

## ⚠️ LƯU Ý QUAN TRỌNG

**Nếu extension không hoạt động**, sử dụng **giải pháp thay thế** (khuyến nghị):
- 📖 **Xem file:** `ADBLOCK_NO_EXTENSION.md` - Chặn ads KHÔNG cần extension
- ✅ **Đơn giản hơn**, reliable hơn, hoạt động ngay
- 🚀 Chỉ cần copy file `adblock.js` và dùng trong Electron

## 🎯 TÓM TẮT

YouTube và Spotify đã được tích hợp **uBlock Origin Lite** để chặn quảng cáo tự động!

**2 cách thực hiện:**
1. **Extension-based** (phức tạp hơn, có thể không hoạt động)
2. **Code-based** (đơn giản, reliable) ← **Khuyến nghị**

## 📦 Đã setup sẵn

✅ Database tables: `extensions`, `service_extensions`
✅ uBlock Origin Lite đã được gán cho YouTube và Spotify
✅ API trả về thông tin extensions khi lấy services

## 🔧 Cài đặt

### 1. Chạy database init:
```
http://localhost/wokushop-api/init.php
```

## 📡 API Response mới

**GET** `/services/list.php` hoặc `/users/services.php`

```json
{
  "service_type": "youtube",
  "display_name": "YouTube",
  "extensions": [
    {
      "extension_id": "ublock-origin-lite",
      "extension_name": "uBlock Origin Lite",
      "download_url": "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh",
      "version": "2025.1012.1712"
    }
  ]
}
```

## 🚀 Tích hợp vào Electron

### Bước 1: Download extension
```bash
# Chrome Web Store ID của uBlock Origin Lite
EXTENSION_ID=ddkjiahejlhfcafbddmgiahcphecmpfh

# Download URL
https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh
```

**Cách tải:**
1. Mở Chrome
2. Truy cập link trên
3. Cài extension
4. Tìm thư mục extension trong Chrome profile:
   - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\ddkjiahejlhfcafbddmgiahcphecmpfh`
   - Mac: `~/Library/Application Support/Google/Chrome/Default/Extensions/ddkjiahejlhfcafbddmgiahcphecmpfh`
   - Linux: `~/.config/google-chrome/Default/Extensions/ddkjiahejlhfcafbddmgiahcphecmpfh`
5. Copy thư mục version (ví dụ: `2025.1012.1712_0`) vào project của bạn

### Bước 2: Cấu trúc thư mục
```
your-electron-app/
├── extensions/
│   └── ublock-origin-lite/
│       ├── manifest.json
│       ├── _metadata/
│       └── ...
├── main.js
└── package.json
```

### Bước 3: Load extension trong Electron

```javascript
const { app, session, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  // Đường dẫn tới extension
  const extensionPath = path.join(__dirname, 'extensions', 'ublock-origin-lite');

  // Load extension cho default session
  try {
    await session.defaultSession.loadExtension(extensionPath, {
      allowFileAccess: true
    });
    console.log('✅ uBlock Origin Lite loaded!');
  } catch (err) {
    console.error('❌ Failed to load extension:', err);
  }

  // Tạo window
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL('https://www.youtube.com');
});
```

### Bước 4: Load cho partition riêng (User credentials)

```javascript
async function openYouTubeForUser(userId, partitionId) {
  const extensionPath = path.join(__dirname, 'extensions', 'ublock-origin-lite');

  // Lấy session của partition
  const userSession = session.fromPartition(partitionId);

  // Load extension
  await userSession.loadExtension(extensionPath, {
    allowFileAccess: true
  });

  // Tạo window với partition
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      partition: partitionId,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL('https://www.youtube.com');
}

// Sử dụng
openYouTubeForUser(5, 'youtube_user_5_1234567890');
```

### Bước 5: Auto-load từ API

```javascript
const axios = require('axios');

async function loadServiceWithExtensions(serviceType, userId, authToken) {
  // Lấy service info
  const response = await axios.get(
    `http://localhost/wokushop-api/users/services.php?user_id=${userId}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );

  const service = response.data.services.find(s => s.service_type === serviceType);

  if (!service) {
    throw new Error('Service not found');
  }

  const partitionId = service.user_account?.partition_id || 'default';
  const userSession = session.fromPartition(partitionId);

  // Load tất cả extensions của service
  for (const ext of service.extensions) {
    const extPath = path.join(__dirname, 'extensions', ext.extension_id);

    try {
      await userSession.loadExtension(extPath, { allowFileAccess: true });
      console.log(`✅ Loaded: ${ext.extension_name}`);
    } catch (err) {
      console.error(`❌ Failed to load ${ext.extension_name}:`, err);
    }
  }

  // Tạo window
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      partition: partitionId,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL(service.login_url);
  return win;
}

// Sử dụng
app.whenReady().then(async () => {
  const token = 'your-auth-token';
  const userId = 5;

  // Mở YouTube với uBlock Origin Lite
  await loadServiceWithExtensions('youtube', userId, token);
});
```

## 🧪 Testing

### Test 1: Verify extension loaded
```javascript
app.whenReady().then(async () => {
  // Load extension...

  // Kiểm tra extensions đã load
  const extensions = session.defaultSession.getAllExtensions();
  console.log('Loaded extensions:', extensions);

  // Tìm uBlock Origin Lite
  const ublock = extensions.find(e => e.name.includes('uBlock'));
  console.log('uBlock Origin Lite:', ublock);
});
```

### Test 2: Verify ad blocking
1. Mở YouTube trong app
2. Play video có quảng cáo (ví dụ: video phổ biến)
3. Xác nhận không có quảng cáo hiển thị

### Test 3: Check extension console
```javascript
win.webContents.on('console-message', (event, level, message) => {
  console.log('Console:', message);
});
```

## ⚙️ Admin: Quản lý extensions

### Xem danh sách extensions
```bash
GET http://localhost/wokushop-api/extensions/list.php
```

### Gán extensions cho service khác
```bash
POST http://localhost/wokushop-api/extensions/assign-to-service.php
{
  "service_type": "netflix",
  "extension_ids": ["ublock-origin-lite"]
}
```

## 🔍 Troubleshooting

### Extension không load
**Nguyên nhân:** Path không đúng hoặc manifest.json lỗi

**Giải pháp:**
```javascript
const fs = require('fs');
const extPath = path.join(__dirname, 'extensions', 'ublock-origin-lite');

// Kiểm tra thư mục tồn tại
if (!fs.existsSync(extPath)) {
  console.error('Extension folder not found:', extPath);
}

// Kiểm tra manifest.json
const manifestPath = path.join(extPath, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('Manifest:', manifest);
} else {
  console.error('manifest.json not found');
}
```

### Extension load nhưng không chặn quảng cáo
**Nguyên nhân:** Extension chưa kích hoạt hoặc cần config

**Giải pháp:**
- Kiểm tra extension settings trong Chrome trước
- Đảm bảo extension có permissions cần thiết
- Check console log của extension

### Lỗi "Extension manifest version 2 is deprecated"
**Nguyên nhân:** Dùng nhầm extension MV2

**Giải pháp:** Đảm bảo dùng **uBlock Origin Lite** (MV3) không phải uBlock Origin (MV2)

## 📚 Tài liệu đầy đủ

Xem file `EXTENSIONS_GUIDE.md` để biết chi tiết về:
- Auto-download extensions
- Update extensions
- Load nhiều extensions
- Custom extension settings
