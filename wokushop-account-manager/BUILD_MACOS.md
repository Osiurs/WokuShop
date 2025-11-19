# Hướng Dẫn Build Woku App cho macOS

## ⚠️ YÊU CẦU QUAN TRỌNG

**Để build ứng dụng cho macOS (.dmg, .app), bạn BẮT BUỘC phải có:**
- ✅ **Máy Mac** (macOS 10.13 trở lên)
- ✅ **Xcode Command Line Tools**
- ✅ **Node.js** (v16 trở lên)

> 🚫 **KHÔNG THỂ** build ứng dụng macOS từ Windows hoặc Linux do giới hạn của Apple!

---

## 📋 CHUẨN BỊ (Trên Mac)

### 1. Cài Xcode Command Line Tools

```bash
xcode-select --install
```

### 2. Kiểm tra Node.js

```bash
node --version   # Phải >= v16
npm --version
```

### 3. Chuyển project lên Mac

- **Cách 1:** Push code lên GitHub → Clone về Mac
- **Cách 2:** Copy thư mục project qua Mac (bỏ qua `node_modules` và `dist`)

---

## 🎨 TẠO ICON CHO macOS

### Cách 1: Dùng Online Tool (Dễ nhất)

1. Truy cập: https://cloudconvert.com/png-to-icns
2. Upload file `src/assets/images/logo.png`
3. Download file `logo.icns`
4. Đặt vào `src/assets/images/logo.icns`

### Cách 2: Dùng Terminal (Trên Mac)

```bash
cd wokushop-account-manager

# Tạo iconset
mkdir logo.iconset

# Tạo các kích thước (dùng sips - có sẵn trên Mac)
sips -z 16 16     src/assets/images/logo.png --out logo.iconset/icon_16x16.png
sips -z 32 32     src/assets/images/logo.png --out logo.iconset/icon_16x16@2x.png
sips -z 32 32     src/assets/images/logo.png --out logo.iconset/icon_32x32.png
sips -z 64 64     src/assets/images/logo.png --out logo.iconset/icon_32x32@2x.png
sips -z 128 128   src/assets/images/logo.png --out logo.iconset/icon_128x128.png
sips -z 256 256   src/assets/images/logo.png --out logo.iconset/icon_128x128@2x.png
sips -z 256 256   src/assets/images/logo.png --out logo.iconset/icon_256x256.png
sips -z 512 512   src/assets/images/logo.png --out logo.iconset/icon_256x256@2x.png
sips -z 512 512   src/assets/images/logo.png --out logo.iconset/icon_512x512.png
sips -z 1024 1024 src/assets/images/logo.png --out logo.iconset/icon_512x512@2x.png

# Convert sang .icns
iconutil -c icns logo.iconset -o src/assets/images/logo.icns

# Dọn dẹp
rm -rf logo.iconset
```

---

## 🚀 BUILD ỨNG DỤNG

### Bước 1: Cài dependencies

```bash
cd wokushop-account-manager
npm install
```

### Bước 2: Build

```bash
# Build DMG installer (khuyên dùng)
npm run build:mac
```

**Hoặc build chi tiết hơn:**

```bash
# Build DMG cho Intel Mac
npx electron-builder --mac --x64

# Build DMG cho Apple Silicon (M1/M2/M3)
npx electron-builder --mac --arm64

# Build Universal (chạy được trên cả Intel và Apple Silicon)
npx electron-builder --mac --universal
```

### Bước 3: Tìm file build

File build nằm trong thư mục `dist/`:

```
wokushop-account-manager/dist/
├── Woku App-1.0.0.dmg              # DMG installer
├── Woku App-1.0.0-arm64.dmg        # Cho M1/M2/M3
├── Woku App-1.0.0-x64.dmg          # Cho Intel
└── mac/Woku App.app                # App chưa đóng gói
```

---

## 📦 CÁC LOẠI PACKAGE

| Loại | Lệnh | Mô tả |
|------|------|-------|
| **DMG** | `--mac dmg` | Khuyên dùng - Kéo thả vào Applications |
| **PKG** | `--mac pkg` | Installer tự động |
| **ZIP** | `--mac zip` | Đơn giản - Giải nén và chạy |

---

## ⚙️ TÙY CHỈNH BUILD (Nâng cao)

Chỉnh sửa `package.json` để build Universal:

```json
"build": {
  "mac": {
    "target": [
      {
        "target": "dmg",
        "arch": ["universal"]
      }
    ],
    "icon": "src/assets/images/logo.icns",
    "category": "public.app-category.productivity"
  }
}
```

---

## ❗ XỬ LÝ LỖI

### "Cannot build for macOS on Windows"
→ Phải build trên máy Mac

### "Icon file not found"
→ Tạo file `logo.icns` theo hướng dẫn ở trên

### "xcode-select: error: tool 'xcodebuild' requires Xcode"
→ Chạy: `xcode-select --install`

### Build quá lâu
→ Lần đầu sẽ mất 5-10 phút, lần sau nhanh hơn

---

## ✅ CHECKLIST

- [ ] Đã cài Xcode Command Line Tools
- [ ] Đã có file `logo.icns`
- [ ] Đã chạy `npm install`
- [ ] Đã test với `npm run dev`
- [ ] Đã xóa thư mục `dist` cũ

---

## 🎉 SAU KHI BUILD XONG

1. Mở file `.dmg` trong thư mục `dist/`
2. Kéo `Woku App.app` vào thư mục `Applications`
3. Mở ứng dụng và test

**Nếu gặp cảnh báo "unidentified developer":**
- Right-click vào app → chọn **Open**
- Hoặc: **System Preferences** → **Security & Privacy** → **Open Anyway**

---

## 📊 KÍCH THƯỚC FILE

| Kiến trúc | Dung lượng |
|-----------|------------|
| Intel (x64) | ~150-200 MB |
| Apple Silicon (arm64) | ~150-200 MB |
| Universal | ~250-350 MB |

---

## 🔗 TÀI LIỆU THAM KHẢO

- [Electron Builder - macOS](https://www.electron.build/configuration/mac)
- [Apple Developer Docs](https://developer.apple.com/documentation/)

