#!/bin/bash

# Script để rebuild ứng dụng sau khi fix electron-updater

echo "[object Object]okuShop App - Rebuild Script"
echo "=================================="
echo ""

# Kiểm tra xem có npm không
if ! command -v npm &> /dev/null; then
    echo "❌ npm không được tìm thấy. Vui lòng cài đặt Node.js"
    exit 1
fi

echo "[object Object]ước 1: Cài đặt lại dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Cài đặt dependencies thất bại"
    exit 1
fi

echo "✅ Dependencies đã được cài đặt"
echo ""

echo "🗑️ Bước 2: Xóa build cũ..."
rm -rf dist

echo "✅ Build cũ đã được xóa"
echo ""

# Xác định hệ điều hành
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    BUILD_CMD="npm run build:linux"
    echo "🐧 Phát hiện Linux - Build cho Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    BUILD_CMD="npm run build:mac"
    echo "[object Object]OS - Build cho macOS"
else
    # Mặc định là Windows
    BUILD_CMD="npm run build:win"
    echo "🪟 Phát hiện Windows - Build cho Windows"
fi

echo ""
echo "🔨 Bước 3: Build ứng dụng..."
echo "Lệnh: $BUILD_CMD"
echo ""

$BUILD_CMD

if [ $? -ne 0 ]; then
    echo "❌ Build thất bại"
    exit 1
fi

echo ""
echo "✅ Build hoàn tất thành công!"
echo ""
echo "📁 Bộ cài được lưu tại: ./dist/"
echo ""
echo "🎉 Bạn có thể chạy bộ cài từ thư mục dist"

