@echo off
REM Script để rebuild ứng dụng sau khi fix electron-updater

echo.
echo ============================================
echo WokuShop App - Rebuild Script (Windows)
echo ============================================
echo.

REM Kiểm tra xem có npm không
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [91m❌ npm không được tìm thấy. Vui lòng cài đặt Node.js[0m
    pause
    exit /b 1
)

echo [92m📦 Bước 1: Cài đặt lại dependencies...[0m
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [91m❌ Cài đặt dependencies thất bại[0m
    pause
    exit /b 1
)

echo [92m✅ Dependencies đã được cài đặt[0m
echo.

echo [92m🗑️  Bước 2: Xóa build cũ...[0m
if exist dist (
    rmdir /s /q dist
)

echo [92m✅ Build cũ đã được xóa[0m
echo.

echo [92m🔨 Bước 3: Build ứng dụng cho Windows...[0m
call npm run build:win

if %ERRORLEVEL% NEQ 0 (
    echo [91m❌ Build thất bại[0m
    pause
    exit /b 1
)

echo.
echo [92m✅ Build hoàn tất thành công![0m
echo.
echo [94m📁 Bộ cài được lưu tại: .\dist\[0m
echo.
echo [92m🎉 Bạn có thể chạy bộ cài từ thư mục dist[0m
echo.
pause

