const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
app.disable('etag'); // Disable ETag caching to prevent 304 status codes (Fix #5)

// Force 200 OK Status Codes (ETag & Cache Mitigation)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Strip request headers that trigger 304 responses
  delete req.headers['if-modified-since'];
  delete req.headers['if-none-match'];
  next();
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Configure Multer storage without validation (OWASP Vulnerability: Insecure File Upload)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Preserve original filename, allowing upload of malicious extension files like shell.html or shell.php
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup (in-memory SQLite for demonstrations)
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the in-memory SQLite database.');
    initializeDb();
  }
});

function initializeDb() {
  db.serialize(() => {
    // Users table (Vulnerability: MD5 unsalted hashes for password storage - OWASP A02:2021 Cryptographic Failure)
    db.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Customer',
      balance INTEGER NOT NULL DEFAULT 0,
      avatar_url TEXT,
      reset_token TEXT,
      account_no TEXT UNIQUE
    )`);

    // Transactions table (Vulnerability: Stored XSS possible via note - OWASP A03:2021 Injection)
    db.run(`CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      sender_name TEXT,
      sender_account TEXT,
      recipient_id INTEGER,
      recipient_name TEXT,
      recipient_account TEXT,
      amount INTEGER NOT NULL,
      note TEXT,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      ref TEXT NOT NULL,
      card_number TEXT
    )`);

    // Prepopulate Users (MD5 hashes of passwords)
    // passwords:
    // rangga@geekswarrior.id -> hunter2 (MD5: 2ab96390c7dbe3439de74d0c9b0b1767)
    // sinta.m@geekswarrior.id -> s1nt4pass (MD5: d0f3ee18a7c29cb36cc2e947d06637b3)
    // andra.w@geekswarrior.id -> password123 (MD5: 482c811da5d5b4bc6d497ffa98491e38)
    // admin@geekswarrior.id -> adminsecure2026 (MD5: a6b64b1827b508f7db01129bc780775d) // password: adminsecure2026
    const users = [
      ['Dodi Irawan', 'admin@geekswarrior.id', 'a6b64b1827b508f7db01129bc780775d', 'Admin', 0, null, '54219999'],
      ['Rangga Pratama', 'rangga@geekswarrior.id', '2ab96390c7dbe3439de74d0c9b0b1767', 'Customer', 84250000, null, '54214021'],
      ['Sinta Maharani', 'sinta.m@geekswarrior.id', 'd0f3ee18a7c29cb36cc2e947d06637b3', 'Customer', 21700000, null, '54211188'],
      ['Andra Wijaya', 'andra.w@geekswarrior.id', '482c811da5d5b4bc6d497ffa98491e38', 'Customer', 3100000, null, '54213100']
    ];

    const stmt = db.prepare(`INSERT INTO users (name, email, password, role, balance, avatar_url, account_no) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    users.forEach(user => stmt.run(user));
    stmt.finalize();

    // Prepopulate Transactions
    const transactions = [
      [2, 'Rangga Pratama', '54214021', null, 'Tokopedia', 'QRIS', 485000, 'Shopping QRIS', 'out', 'Jun 24', 'GB123456789', '54214021'],
      [null, 'PT Geekstra', 'Payroll', 2, 'Rangga Pratama', '54214021', 12400000, 'Payroll deposit', 'in', 'Jun 23', 'GB123456790', '54214021'],
      [2, 'Rangga Pratama', '54214021', 4, 'Andra Wijaya', '54213100', 1500000, 'Transfer BCA', 'out', 'Jun 22', 'GB123456791', '54214021'],
      [2, 'Rangga Pratama', '54214021', null, 'PLN Postpaid', 'Electricity', 342000, 'Electricity bill', 'out', 'Jun 21', 'GB123456792', '54214021'],
      [2, 'Rangga Pratama', '54214021', null, 'Grab', 'Transport', 58000, 'Transport grab ride', 'out', 'Jun 21', 'GB123456793', '54214021'],
      [3, 'Sinta Maharani', '54211188', null, 'Netflix', 'Sub', 186000, 'Subscription', 'out', 'Jun 24', 'GB123456794', '54211188']
    ];

    const tStmt = db.prepare(`INSERT INTO transactions (sender_id, sender_name, sender_account, recipient_id, recipient_name, recipient_account, amount, note, type, date, ref, card_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    transactions.forEach(t => tStmt.run(t));
    tStmt.finalize();

    console.log('Database initialized successfully.');
  });
}

// MD5 Helper
const crypto = require('crypto');
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Middleware: JWT Verification supporting 'none' algorithm bypass & privilege escalation (OWASP A07:2021)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      if (header.alg === 'none') {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        req.user = payload;
        return next();
      }
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired token', details: err.message });
      req.user = user;
      next();
    });
  } catch (e) {
    return res.status(500).json({ error: 'Internal Authentication Error', stack: e.stack });
  }
}

// -------------------------------------------------------------
// Authentication APIs
// -------------------------------------------------------------

// REGISTER (Vulnerable to Mass Assignment privilege escalation - OWASP A08:2021)
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body; // Vulnerable: takes role parameter from request body (Mass Assignment)
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const userRole = role || 'Customer';
  const account_no = '5421' + Math.floor(1000 + Math.random() * 9000);
  const hashedPassword = md5(password);

  db.run(`INSERT INTO users (name, email, password, role, balance, account_no) VALUES (?, ?, ?, ?, 10000000, ?)`,
    [name, email, hashedPassword, userRole, account_no],
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'Email already exists', details: err.message });
      }
      res.json({ message: 'Registration successful', userId: this.lastID, account_no, role: userRole });
    }
  );
});

// LOGIN (Vulnerable to credential brute force - no rate limiting - OWASP A07:2021)
// Vulnerability: SQL Injection Auth Bypass on Form Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const hashedPassword = md5(password);
  
  // Vulnerable Query using string concatenation (SQLi)
  const sql = `SELECT * FROM users WHERE email = '${email}' AND password = '${hashedPassword}'`;
  
  db.get(sql, [], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'SQL Execution Error', sql, details: err.message });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create JWT
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, balance: user.balance, account_no: user.account_no } });
  });
});

// FORGOT PASSWORD LEGACY
app.post('/api/v1/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const token = 'RESET-' + Math.random().toString(36).substring(2, 15).toUpperCase();
    db.run(`UPDATE users SET reset_token = ? WHERE id = ?`, [token, user.id], (updErr) => {
      if (updErr) {
        return res.status(500).json({ error: 'Failed to generate token' });
      }
      res.json({ 
        message: 'Password reset link generated (sent to email in production)', 
        reset_link: `/reset-password?token=${token}`,
        debug_token: token 
      });
    });
  });
});

// VULNERABLE RESET PASSWORD API (Vulnerability: Weak/No verification of reset_token)
app.post('/api/auth/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password required' });
  }

  // Find user
  db.get('SELECT reset_token FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Vulnerability: Bypasses check if token is empty, null, omitted, or if it matches
    if (!token || token === '' || user.reset_token === token) {
      const hashedPassword = md5(newPassword);
      db.run('UPDATE users SET password = ?, reset_token = NULL WHERE email = ?', [hashedPassword, email], (updErr) => {
        if (updErr) return res.status(500).json({ error: 'Reset failed' });
        res.json({ message: 'Password reset successfully!' });
      });
    } else {
      res.status(400).json({ error: 'Invalid reset token' });
    }
  });
});

// -------------------------------------------------------------
// User APIs
// -------------------------------------------------------------

// VULNERABLE CHANGE PASSWORD (CSRF and BOLA Vulnerability)
app.all('/api/users/change-password', (req, res) => {
  // Vulnerability CSRF: accepts GET and POST without CSRF token protection
  // Vulnerability BOLA: takes userId from req body/query rather than req.user.id session
  const userId = req.query.userId || req.body.userId;
  const newPassword = req.query.newPassword || req.body.newPassword;

  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'userId and newPassword are required' });
  }

  const hashedPassword = md5(newPassword);
  db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Change password failed', details: err.message });
    }
    res.json({ message: `Password changed successfully for user ID ${userId}` });
  });
});

app.get('/api/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error', stack: err.stack });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// SSRF and RFI Avatar URL Import
app.post('/api/users/:id/avatar', authenticateToken, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // RFI / LFI vulnerability: supports reading local files if url starts with file://
    if (url.startsWith('file://')) {
      const filePath = url.replace('file://', '');
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return res.status(500).json({ error: 'File read error', details: err.message });
        }
        const base64Data = data.toString('base64');
        const dataUri = `data:image/png;base64,${base64Data}`;
        db.run(`UPDATE users SET avatar_url = ? WHERE id = ?`, [dataUri, req.params.id], (updErr) => {
          if (updErr) return res.status(500).json({ error: updErr.message });
          res.json({ message: 'Avatar imported from local file', avatar_url: dataUri });
        });
      });
    } else {
      // SSRF: backend requests any URL
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
      const contentType = response.headers['content-type'];
      const base64Data = Buffer.from(response.data, 'binary').toString('base64');
      const dataUri = `data:${contentType};base64,${base64Data}`;

      db.run(`UPDATE users SET avatar_url = ? WHERE id = ?`, [dataUri, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Avatar updated successfully', avatar_url: dataUri });
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch image from URL', details: err.message });
  }
});

// Extract the comment/description embedded in an image's metadata.
// JPEG: the COM marker (0xFFFE). PNG: the first tEXt chunk value.
// This is content the uploader fully controls (e.g. via `exiftool -Comment=...` or Burp).
function extractImageComment(buffer) {
  try {
    // JPEG (starts with FF D8)
    if (buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset + 4 < buffer.length) {
        if (buffer[offset] !== 0xFF) break;
        const marker = buffer[offset + 1];
        if (marker === 0xDA) break; // Start of Scan -> image data begins
        const segLen = buffer.readUInt16BE(offset + 2);
        if (marker === 0xFE) { // COM comment segment
          return buffer.slice(offset + 4, offset + 2 + segLen).toString('utf8');
        }
        offset += 2 + segLen;
      }
    }
    // PNG (starts with 89 50 4E 47): find a tEXt chunk
    if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50) {
      const idx = buffer.indexOf('tEXt');
      if (idx !== -1) {
        const len = buffer.readUInt32BE(idx - 4);
        const data = buffer.slice(idx + 4, idx + 4 + len).toString('utf8');
        return data.split('\x00').pop(); // value after the "keyword\0"
      }
    }
  } catch (e) { /* ignore parse errors */ }
  return '';
}

// Insecure File Upload + Avatar Thumbnail Processing
// Vulnerability chain: Insecure File Upload (#8) -> OS Command Injection -> RCE.
// The server has NO server-side type validation (front-end filter is bypassable), and after
// saving the avatar it generates a thumbnail with ImageMagick, embedding the image's own
// comment metadata into the shell command via raw string concatenation. An attacker uploads
// a valid image whose comment metadata contains shell metacharacters, achieving RCE.
app.post('/api/upload', authenticateToken, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Backend performs no extension or MIME validation (Insecure File Upload)
  const fileUrl = `/uploads/${req.file.filename}`;
  const filePath = path.join(__dirname, 'public', 'uploads', req.file.filename);

  // Read the image and pull its embedded comment metadata (attacker-controlled content)
  const comment = extractImageComment(fs.readFileSync(filePath)) || 'Geeks Bank Avatar';
  const thumbPath = path.join(__dirname, 'public', 'uploads', 'thumb_' + req.file.filename);

  // Vulnerable: the image's comment is concatenated straight into a shell command.
  // ImageMagick generates a captioned thumbnail; shell metacharacters in `comment` execute.
  const cmd = `magick "${filePath}" -resize 128x128 -comment "${comment}" "${thumbPath}"`;

  exec(cmd, { timeout: 10000, maxBuffer: 1024 * 1024 }, (procErr, stdout, stderr) => {
    // Thumbnail generation is best-effort; the avatar is saved regardless (graceful degradation)
    db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [fileUrl, req.user.id], (err) => {
      if (err) return res.status(500).json({ error: 'Database update failed' });
      res.json({
        message: 'File uploaded successfully',
        url: fileUrl,
        thumbnail: `/uploads/thumb_${req.file.filename}`,
        processingLog: (stdout || '') + (stderr || '')
      });
    });
  });
});

// -------------------------------------------------------------
// Transaction APIs
// -------------------------------------------------------------

app.get('/api/transactions', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(`SELECT * FROM transactions WHERE sender_id = ? OR recipient_id = ? ORDER BY id DESC`, [userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Map transactions to present them correctly to the querying user (in-out transaksis)
    const mapped = rows.map(t => {
      const isSender = t.sender_id === userId;
      return {
        ...t,
        amount: isSender ? -Math.abs(t.amount) : Math.abs(t.amount),
        type: isSender ? 'out' : 'in',
        direction: isSender ? 'outgoing transaction' : 'incoming transaction'
      };
    });
    res.json(mapped);
  });
});

app.get('/api/transactions/search', authenticateToken, (req, res) => {
  const query = req.query.q || '';
  const userId = req.user.id;
  const sql = `SELECT * FROM transactions WHERE (sender_id = ${userId} OR recipient_id = ${userId}) AND (note LIKE '%${query}%' OR recipient_name LIKE '%${query}%')`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'SQL Execution Error', sql, details: err.message });
    
    const mapped = rows.map(t => {
      const isSender = t.sender_id === userId;
      return {
        ...t,
        amount: isSender ? -Math.abs(t.amount) : Math.abs(t.amount),
        type: isSender ? 'out' : 'in',
        direction: isSender ? 'outgoing transaction' : 'incoming transaction'
      };
    });
    res.json(mapped);
  });
});

app.get('/api/transactions/:id', authenticateToken, (req, res) => {
  db.get(`SELECT * FROM transactions WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Transaction not found' });
    
    // Respon dari GET /api/transactions/{id} harus menampilkan ID transaksi, amount, dan keterangan transaksi (note)
    res.status(200).json({
      id: row.id,
      amount: row.amount,
      note: row.note,
      recipient_name: row.recipient_name,
      recipient_account: row.recipient_account,
      sender_name: row.sender_name,
      sender_account: row.sender_account,
      ref: row.ref,
      date: row.date,
      type: row.type,
      sender_id: row.sender_id,
      recipient_id: row.recipient_id
    });
  });
});

// Insecure HTTP Methods on Transaction endpoint (PUT/DELETE allowed)
app.put('/api/transactions/:id', authenticateToken, (req, res) => {
  const { amount, note, recipient_name } = req.body;
  db.run('UPDATE transactions SET amount = ?, note = ?, recipient_name = ? WHERE id = ?',
    [amount, note, recipient_name, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Transaction modified successfully', changes: this.changes });
    }
  );
});

app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM transactions WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Transaction deleted successfully', changes: this.changes });
  });
});

// TRANSFER (Validates recipient account exists in database)
app.post('/api/transfer', authenticateToken, (req, res) => {
  const { recipient, account, amount, note } = req.body;
  const senderId = req.user.id;
  const parsedAmount = parseInt(amount, 10);

  if (isNaN(parsedAmount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // Validate account number exists (Fix #6)
  db.get('SELECT * FROM users WHERE account_no = ?', [account], (accErr, targetUser) => {
    if (accErr) return res.status(500).json({ error: accErr.message });
    if (!targetUser) {
      return res.status(400).json({ error: `Transaksi ditolak: nomor rekening '${account}' tidak ditemukan.` });
    }

    db.get(`SELECT * FROM users WHERE id = ?`, [senderId], (err, sender) => {
      if (err || !sender) return res.status(500).json({ error: 'Sender not found' });

      const ref = 'GB' + Date.now().toString().slice(-9);
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      db.serialize(() => {
        db.run(`UPDATE users SET balance = balance - ? WHERE id = ?`, [parsedAmount, senderId]);
        db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [parsedAmount, targetUser.id]);

        db.run(`INSERT INTO transactions (sender_id, sender_name, sender_account, recipient_id, recipient_name, recipient_account, amount, note, type, date, ref, card_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [senderId, sender.name, sender.account_no, targetUser.id, targetUser.name, account, parsedAmount, note, 'out', dateStr, ref, sender.account_no],
          function (insErr) {
            if (insErr) return res.status(500).json({ error: insErr.message });
            res.json({ message: 'Transfer successful', ref, amountSent: parsedAmount });
          }
        );
      });
    });
  });
});

// TOP UP
app.post('/api/topup', authenticateToken, (req, res) => {
  const { amount, method } = req.body;
  const userId = req.user.id;
  const parsedAmount = parseInt(amount, 10);

  if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  db.serialize(() => {
    db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [parsedAmount, userId]);
    const ref = 'GB' + Date.now().toString().slice(-9);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    db.get('SELECT name, account_no FROM users WHERE id = ?', [userId], (err, row) => {
      db.run(`INSERT INTO transactions (sender_id, sender_name, sender_account, recipient_id, recipient_name, recipient_account, amount, note, type, date, ref, card_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [null, `Top Up · ${method}`, 'Incoming', userId, row.name, row.account_no, parsedAmount, 'Deposit', 'in', dateStr, ref, row.account_no],
        function (insErr) {
          if (insErr) return res.status(500).json({ error: insErr.message });
          res.json({ message: 'Top up successful', ref, amount: parsedAmount });
        }
      );
    });
  });
});

// PAY BILL
app.post('/api/paybill', authenticateToken, (req, res) => {
  const { biller, account, amount } = req.body;
  const userId = req.user.id;
  const parsedAmount = parseInt(amount, 10);

  if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  db.serialize(() => {
    db.run(`UPDATE users SET balance = balance - ? WHERE id = ?`, [parsedAmount, userId]);
    const ref = 'GB' + Date.now().toString().slice(-9);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    db.get('SELECT name, account_no FROM users WHERE id = ?', [userId], (err, row) => {
      db.run(`INSERT INTO transactions (sender_id, sender_name, sender_account, recipient_id, recipient_name, recipient_account, amount, note, type, date, ref, card_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, row.name, row.account_no, null, biller, account, parsedAmount, `Bill payment to ${biller}`, 'out', dateStr, ref, row.account_no],
        function (insErr) {
          if (insErr) return res.status(500).json({ error: insErr.message });
          res.json({ message: 'Payment successful', ref, amount: parsedAmount });
        }
      );
    });
  });
});

// -------------------------------------------------------------
// Admin APIs (OWASP API5:2023 BFLA - Broken Function Level Authorization)
// -------------------------------------------------------------

function isAdmin(req, res, next) {
  const adminBypass = req.headers['x-admin-bypass'];
  if (adminBypass === 'true') return next();

  if (req.user && req.user.role === 'Admin') return next();
  
  // Vulnerability: BFLA lets the user through regardless (but logs warning or proceeds anyway)
  next();
}

app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
  db.all(`SELECT id, name, email, role, balance, avatar_url, account_no FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/admin/stats', authenticateToken, isAdmin, (req, res) => {
  db.get(`SELECT SUM(balance) as total_deposits, COUNT(id) as total_users FROM users`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      totalUsers: row.total_users,
      totalDeposits: row.total_deposits || 0,
      activeSessions: 1287,
      flagged: 23
    });
  });
});

// POST to create new user from Admin panel (Fix #5)
app.post('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
  const { name, email, password, role, balance } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }

  const account_no = '5421' + Math.floor(1000 + Math.random() * 9000);
  const hashedPassword = md5(password);
  const userRole = role || 'Customer';
  const userBalance = parseInt(balance, 10) || 0;

  db.run(`INSERT INTO users (name, email, password, role, balance, account_no) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, hashedPassword, userRole, userBalance, account_no],
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'Failed to create user', details: err.message });
      }
      res.json({ message: 'User created successfully', userId: this.lastID, account_no });
    }
  );
});

// GET single user for admin
app.get('/api/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
  db.get(`SELECT id, name, email, role, balance, avatar_url, account_no FROM users WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// PUT to edit user from admin panel
app.put('/api/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
  const { name, email, role, balance } = req.body;
  db.run(`UPDATE users SET name = ?, email = ?, role = ?, balance = ? WHERE id = ?`,
    [name, email, role, parseInt(balance, 10) || 0, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'User updated successfully', changes: this.changes });
    }
  );
});

// DELETE user from admin panel
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
  db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User deleted successfully', changes: this.changes });
  });
});

// -------------------------------------------------------------
// OpenAPI specs / Swagger Documentation Endpoint (Publicly Exposed)
// -------------------------------------------------------------
app.get('/swagger.json', (req, res) => {
  res.json({
    swagger: "2.0",
    info: {
      title: "Geeks Bank API Documentation",
      version: "1.0.0",
      description: "Internal APIs for Geeks Bank digital banking services."
    },
    host: "localhost:3000",
    schemes: ["http"],
    paths: {
      "/api/auth/login": {
        post: {
          summary: "Authenticate User",
          parameters: [
            { name: "body", in: "body", required: true, schema: { type: "object", properties: { email: { type: "string" }, password: { type: "string" } } } }
          ],
          responses: { 200: { description: "Returns JWT Token" } }
        }
      },
      "/api/users/change-password": {
        get: {
          summary: "Change password via GET (CSRF vulnerable)",
          parameters: [
            { name: "userId", in: "query", type: "integer", required: true },
            { name: "newPassword", in: "query", type: "string", required: true }
          ]
        },
        post: {
          summary: "Change password via POST (BOLA vulnerable)",
          parameters: [
            { name: "body", in: "body", required: true, schema: { type: "object", properties: { userId: { type: "integer" }, newPassword: { type: "string" } } } }
          ]
        }
      },
      "/api/transfer": {
        post: {
          summary: "Transfer money to account",
          parameters: [
            { name: "body", in: "body", required: true, schema: { type: "object", properties: { recipient: { type: "string" }, account: { type: "string" }, amount: { type: "integer" }, note: { type: "string" } } } }
          ]
        }
      },
      "/api/admin/users": {
        get: { summary: "List all users (Admin Console - Priv Esc prone)" },
        post: { summary: "Create new user account" }
      },
      "/api/upload": {
        post: {
          summary: "Upload profile avatar image (server-side thumbnail processing - Command Injection RCE)",
          consumes: ["multipart/form-data"],
          parameters: [
            { name: "avatar", in: "formData", type: "file", required: true, description: "Avatar image (png/jpg/jpeg). Server generates a thumbnail via ImageMagick." }
          ]
        }
      }
    }
  });
});

app.get('/api-docs', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Geeks Bank API Swagger</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Manrope:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Manrope', sans-serif; background: #eef1f8; margin: 0; padding: 40px; }
          .container { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
          h1 { color: #0d1a36; margin-top: 0; }
          .endpoint { border: 1px solid #e1e7f1; border-radius: 12px; margin-bottom: 16px; overflow: hidden; }
          .method { display: inline-block; padding: 6px 12px; font-weight: 700; color: #fff; font-size: 13px; min-width: 80px; text-align: center; }
          .get { background: #61afeef0; }
          .post { background: #49cc90; }
          .put { background: #fca130; }
          .delete { background: #f93e3e; }
          .path { font-family: 'JetBrains Mono', monospace; font-weight: 600; padding-left: 12px; color: #0d1a36; }
          .desc { padding: 12px 16px; background: #fcfcfc; border-top: 1px solid #e1e7f1; font-size: 14px; color: #586079; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Geeks Bank Swagger API Docs (Exposed)</h1>
          <p>Exposed system specifications. Download raw definitions at <a href="/swagger.json">/swagger.json</a>.</p>
          
          <div class="endpoint">
            <span class="method post">POST</span><span class="path">/api/auth/login</span>
            <div class="desc">Sign in. Supports SQL Injection authentication bypass on input fields.</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span><span class="path">/api/auth/reset-password</span>
            <div class="desc">Reset password. Vulnerable token validation allows empty tokens.</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span><span class="path">/api/users/change-password</span>
            <div class="desc">Change password via GET requests (CSRF Vulnerable). Params: userId, newPassword.</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span><span class="path">/api/users/change-password</span>
            <div class="desc">Change password via POST body (BOLA Vulnerable - allows taking over other users).</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span><span class="path">/api/transfer</span>
            <div class="desc">Transfer money. Validates recipient account exists in database.</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span><span class="path">/api/admin/stats</span>
            <div class="desc">Retrieve total deposits and stats. Exposed via BFLA.</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span><span class="path">/api/admin/users</span>
            <div class="desc">Register new user account (Admin feature).</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span><span class="path">/api/upload</span>
            <div class="desc">Upload avatar image. Server generates a thumbnail via ImageMagick using the image's embedded comment metadata (Command Injection - RCE).</div>
          </div>
        </div>
      </body>
    </html>
  `);
});

// SPA routing fallback (Fix #13)
app.get(['/dashboard', '/transfer', '/history', '/profile', '/admin', '/reset-password', '/forgot-password'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
