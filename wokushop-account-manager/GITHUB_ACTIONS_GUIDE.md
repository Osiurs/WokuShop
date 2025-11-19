# Hướng Dẫn Build Tự Động với GitHub Actions

## 🎯 Tổng Quan

GitHub Actions cho phép bạn build ứng dụng **tự động** cho cả 3 hệ điều hành:
- ✅ **macOS** (Intel + Apple Silicon)
- ✅ **Windows** (x64)
- ✅ **Linux** (AppImage, DEB)

**MIỄN PHÍ** cho repository public! 🎉

---

## 📁 Cấu Trúc File Đã Tạo

```
.github/
└── workflows/
    ├── build.yml      # Build tự động khi push code
    └── release.yml    # Build và tạo release khi tạo tag
```

---

## 🚀 Cách Sử Dụng

### 1. Push Code Lên GitHub

```bash
cd wokushop-account-manager

# Khởi tạo git (nếu chưa có)
git init

# Add tất cả file
git add .

# Commit
git commit -m "Add GitHub Actions workflows"

# Thêm remote repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push lên GitHub
git push -u origin main
```

### 2. Build Tự Động (build.yml)

**Workflow này sẽ tự động chạy khi:**
- Push code lên branch `main` hoặc `master`
- Tạo Pull Request
- Hoặc chạy thủ công từ GitHub UI

**Kết quả:**
- Build cho cả 3 hệ điều hành
- File build được lưu trong **Artifacts** (giữ 30 ngày)

**Cách xem kết quả:**
1. Vào repository trên GitHub
2. Click tab **Actions**
3. Click vào workflow run mới nhất
4. Scroll xuống phần **Artifacts** để download

### 3. Tạo Release (release.yml)

**Workflow này chạy khi bạn tạo tag version:**

```bash
# Tạo tag version
git tag v1.0.0

# Push tag lên GitHub
git push origin v1.0.0
```

**Kết quả:**
- Build cho cả 3 hệ điều hành
- Tự động tạo **GitHub Release**
- File build được đính kèm vào Release

**Cách xem:**
1. Vào repository trên GitHub
2. Click tab **Releases**
3. Tải file build từ release mới nhất

---

## 🎨 Tạo Icon cho macOS

Trước khi build, bạn cần tạo file `logo.icns`:

### Cách 1: Online Tool (Khuyên dùng)

1. Truy cập: https://cloudconvert.com/png-to-icns
2. Upload `src/assets/images/logo.png`
3. Download `logo.icns`
4. Đặt vào `src/assets/images/logo.icns`
5. Commit và push lên GitHub

### Cách 2: Tự động trong GitHub Actions

Thêm step này vào workflow (trước step Build for macOS):

```yaml
- name: Create macOS icon
  if: matrix.os == 'macos-latest'
  working-directory: wokushop-account-manager
  run: |
    mkdir -p logo.iconset
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
    iconutil -c icns logo.iconset -o src/assets/images/logo.icns
    rm -rf logo.iconset
```

---

## 🔧 Chạy Thủ Công

Bạn có thể chạy workflow thủ công:

1. Vào repository trên GitHub
2. Click tab **Actions**
3. Chọn workflow **Build Woku App**
4. Click **Run workflow**
5. Chọn branch và click **Run workflow**

---

## 📦 File Build Được Tạo

### macOS (macos-latest)
- `Woku App-1.0.0.dmg` - DMG installer
- `Woku App-1.0.0-arm64.dmg` - Cho Apple Silicon
- `Woku App-1.0.0-x64.dmg` - Cho Intel

### Windows (windows-latest)
- `Woku App Setup 1.0.0.exe` - Windows installer

### Linux (ubuntu-latest)
- `Woku App-1.0.0.AppImage` - AppImage (universal)
- `woku-app_1.0.0_amd64.deb` - DEB package

---

## ⚙️ Tùy Chỉnh

### Build Universal Binary cho macOS

Chỉnh sửa `package.json`:

```json
"build": {
  "mac": {
    "target": [
      {
        "target": "dmg",
        "arch": ["universal"]
      }
    ],
    "icon": "src/assets/images/logo.icns"
  }
}
```

### Thay Đổi Trigger

Chỉnh sửa file `.github/workflows/build.yml`:

```yaml
on:
  push:
    branches: [ main, develop ]  # Thêm branch develop
  schedule:
    - cron: '0 0 * * 0'  # Build tự động mỗi Chủ nhật
```

---

## 💰 Giới Hạn Miễn Phí

| Loại Repository | Thời gian build/tháng |
|-----------------|----------------------|
| **Public** | ♾️ Unlimited |
| **Private** | 2,000 phút |

**Thời gian build ước tính:**
- macOS: ~10-15 phút
- Windows: ~5-10 phút
- Linux: ~5-10 phút

---

## ❗ Xử Lý Lỗi

### "Icon file not found" trên macOS
→ Tạo file `logo.icns` và commit lên GitHub

### Build thất bại
→ Xem log chi tiết trong tab **Actions** → Click vào job bị lỗi

### Không thấy Artifacts
→ Đợi workflow chạy xong (có dấu ✅ xanh)

---

## 📊 So Sánh: Local vs GitHub Actions

| Tiêu chí | Build Local | GitHub Actions |
|----------|-------------|----------------|
| **Cần máy Mac** | ✅ Có | ❌ Không |
| **Tốc độ** | Nhanh hơn | Chậm hơn (~10-15 phút) |
| **Chi phí** | Miễn phí | Miễn phí (public repo) |
| **Tự động** | ❌ Không | ✅ Có |
| **Build nhiều OS** | ❌ Khó | ✅ Dễ |

---

## ✅ Checklist

- [ ] Đã tạo repository trên GitHub
- [ ] Đã có file `logo.icns` (hoặc thêm step tự động tạo)
- [ ] Đã commit và push code
- [ ] Đã kiểm tra tab Actions trên GitHub
- [ ] Workflow chạy thành công (dấu ✅ xanh)

---

## 🎉 Quy Trình Hoàn Chỉnh

### Build Thường Xuyên (Development)

```bash
# 1. Code và commit
git add .
git commit -m "Add new feature"
git push

# 2. GitHub Actions tự động build
# 3. Download artifacts từ tab Actions
```

### Tạo Release (Production)

```bash
# 1. Cập nhật version trong package.json
# 2. Commit
git add .
git commit -m "Release v1.0.0"

# 3. Tạo tag
git tag v1.0.0
git push origin v1.0.0

# 4. GitHub Actions tự động:
#    - Build cho cả 3 OS
#    - Tạo GitHub Release
#    - Upload file build vào Release
```

---

## 🔗 Tài Liệu Tham Khảo

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Electron Builder CI](https://www.electron.build/configuration/configuration#configuration)
- [GitHub Actions Billing](https://docs.github.com/en/billing/managing-billing-for-github-actions)

