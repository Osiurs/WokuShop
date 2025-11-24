/**
 * Test if backend auth.php checks session database
 *
 * This script tests if the backend properly returns 401
 * when session is terminated
 */

const axios = require('axios');

const API_BASE = 'https://db.handymancode.com/api/wokushop-api';

async function testBackendSessionCheck() {
  console.log('🧪 Testing Backend Session Check...\n');

  // Step 1: Login to get a valid token
  console.log('Step 1: Login to get token...');
  try {
    const loginResponse = await axios.post(`${API_BASE}/auth/login.php`, {
      username: 'minh',
      password: 'minh'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.token;
    const userId = loginResponse.data.user.id;
    console.log('✅ Login successful');
    console.log('   Token:', token.substring(0, 20) + '...');
    console.log('   User ID:', userId);

    // Step 2: Login again to force logout previous session
    console.log('\nStep 2: Login again to force logout previous session...');
    const secondLoginResponse = await axios.post(`${API_BASE}/auth/login.php`, {
      username: 'minh',
      password: 'minh'
    });

    if (!secondLoginResponse.data.success) {
      console.log('❌ Second login failed:', secondLoginResponse.data.message);
      return;
    }

    const newToken = secondLoginResponse.data.token;
    console.log('✅ Second login successful');
    console.log('   New Token:', newToken.substring(0, 20) + '...');

    // Step 3: Try using OLD token (should get 401 with session_terminated)
    console.log('\nStep 3: Testing OLD token (should return 401)...');
    try {
      const testResponse = await axios.get(`${API_BASE}/accounts/list.php`, {
        headers: {
          'X-Auth-Token': token
        }
      });

      // If we get here, it means the old token still works (BAD!)
      console.log('❌ FAILED: Old token still works!');
      console.log('   Backend is NOT checking session database');
      console.log('   Response:', testResponse.data);
      console.log('\n🔧 FIX NEEDED:');
      console.log('   1. Upload auth-updated.php to server');
      console.log('   2. Rename it to auth.php');
      console.log('   3. Make sure it has isSessionActive() method');

    } catch (error) {
      if (error.response && error.response.status === 401) {
        const errorData = error.response.data;

        if (errorData.reason === 'session_terminated') {
          console.log('✅ SUCCESS: Backend correctly returned 401');
          console.log('   Reason:', errorData.reason);
          console.log('   Message:', errorData.message);
          console.log('\n✅ Backend is working correctly!');
        } else {
          console.log('⚠️ Got 401 but wrong reason:');
          console.log('   Expected reason: "session_terminated"');
          console.log('   Actual reason:', errorData.reason);
          console.log('   Message:', errorData.message);
        }
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

  } catch (error) {
    console.log('❌ Error during test:', error.message);
    if (error.response) {
      console.log('   Response:', error.response.data);
    }
  }
}

// Run test
testBackendSessionCheck();
