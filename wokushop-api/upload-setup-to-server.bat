@echo off
echo 📤 UPLOAD CHAT LOCK SETUP TO SSH SERVER
echo ========================================

echo.
echo ℹ️  This will upload setup-chat-locks-database.php to your server
echo.

:: Prompt for server details
set /p SERVER_USER="Enter SSH username: "
set /p SERVER_HOST="Enter server host (default: db.handymancode.com): "
set /p SERVER_PATH="Enter server API path (default: /var/www/html/api/wokushop-api/): "

:: Set defaults if empty
if "%SERVER_HOST%"=="" set SERVER_HOST=db.handymancode.com
if "%SERVER_PATH%"=="" set SERVER_PATH=/var/www/html/api/wokushop-api/

echo.
echo 🔄 Uploading to %SERVER_USER%@%SERVER_HOST%:%SERVER_PATH%
echo File: setup-chat-locks-database.php
echo.

:: Upload the setup script
scp setup-chat-locks-database.php %SERVER_USER%@%SERVER_HOST%:%SERVER_PATH%

if %errorlevel% == 0 (
    echo.
    echo ✅ Upload successful!
    echo.
    echo 📋 Next steps:
    echo 1. SSH to server: ssh %SERVER_USER%@%SERVER_HOST%
    echo 2. Go to API directory: cd %SERVER_PATH%
    echo 3. Run setup: php setup-chat-locks-database.php
    echo 4. Test app: npm start (in local project)
    echo.
    echo 🧪 Test API after setup:
    echo curl -H "Authorization: Bearer YOUR_TOKEN" ^
         https://%SERVER_HOST%/api/wokushop-api/chatlocks/list.php
    echo.
) else (
    echo.
    echo ❌ Upload failed!
    echo.
    echo 🔧 Try manual upload:
    echo scp setup-chat-locks-database.php %SERVER_USER%@%SERVER_HOST%:%SERVER_PATH%
    echo.
)

pause