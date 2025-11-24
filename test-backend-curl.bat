@echo off
echo ================================================
echo Testing Backend Session Check with CURL
echo ================================================
echo.

echo Step 1: Login to get first token...
curl -s -X POST "https://db.handymancode.com/api/wokushop-api/auth/login.php" ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"minh\",\"password\":\"minh\"}" > temp_response1.json

echo Done!
echo.

echo Step 2: Login again to force logout first session...
curl -s -X POST "https://db.handymancode.com/api/wokushop-api/auth/login.php" ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"minh\",\"password\":\"minh\"}" > temp_response2.json

echo Done!
echo.

echo Step 3: Test old token - should get 401...
echo.
curl -v -X GET "https://db.handymancode.com/api/wokushop-api/accounts/list.php" ^
  -H "X-Auth-Token: OLD_TOKEN_PLACEHOLDER" ^
  2>&1 | findstr /i "401 reason session_terminated"

echo.
echo ================================================
echo.
echo If you see "401" and "session_terminated" above:
echo   ^>^> Backend is WORKING correctly!
echo.
echo If you see "200" or no "session_terminated":
echo   ^>^> Backend needs to be updated (upload auth-updated.php)
echo.
echo ================================================

del temp_response1.json temp_response2.json 2>nul
pause
