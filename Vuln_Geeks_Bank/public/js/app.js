// Frontend controller for Geeks Bank
let currentUser = null;
let currentToken = null;
let currentScreen = 'dashboard';
let transactions = [];
let filteredTransactions = [];
let currentFilter = 'all';
let searchActive = false;

// Top up variables
let tuMethod = 'bank';

// Pay bill variables
let pbBiller = 'PLN';

// Visibility toggles
let isDashboardCardVisible = false;
let isProfileAccountVisible = false;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupSearch();
  checkAuth();
  
  // Listen for browser navigation (popstate) for History API routing
  window.addEventListener('popstate', () => {
    routeFromPath();
  });
});

// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (token && user) {
    currentToken = token;
    currentUser = JSON.parse(user);
    showAuthenticatedShell();
  } else {
    routeFromPath();
  }
}

// Show authenticated shell & hide login
function showAuthenticatedShell() {
  document.getElementById('app-auth').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  
  // Render user header profile info
  updateHeaderProfile();
  
  // Route based on URL path or default to dashboard
  routeFromPath();
}

// Route based on browser URL path (SPA routing implementation)
function routeFromPath() {
  const path = window.location.pathname;
  if (!currentUser) {
    if (path === '/forgot-password') {
      showAuthScreen();
      showAuthPanel('forgot-password');
    } else if (path === '/reset-password') {
      showAuthScreen();
      showAuthPanel('reset-password');
    } else {
      showAuthScreen();
      showAuthPanel('auth-card');
    }
    return;
  }
  
  if (path === '/transfer') {
    switchScreen('transfer', false);
  } else if (path === '/history') {
    switchScreen('history', false);
  } else if (path === '/profile') {
    switchScreen('profile', false);
  } else if (path === '/admin') {
    switchScreen('admin', false);
  } else {
    switchScreen('dashboard', false);
  }
}

function navigateToAuthPath(path) {
  history.pushState(null, '', path);
  routeFromPath();
}

function showAuthPanel(panelName) {
  document.getElementById('auth-card-panel').style.display = 'none';
  document.getElementById('forgot-password-panel').style.display = 'none';
  document.getElementById('reset-password-panel').style.display = 'none';

  if (panelName === 'auth-card') {
    document.getElementById('auth-card-panel').style.display = 'block';
  } else if (panelName === 'forgot-password') {
    document.getElementById('forgot-password-panel').style.display = 'block';
    document.getElementById('forgot-email').value = '';
    document.getElementById('forgot-error').style.display = 'none';
    document.getElementById('forgot-success').style.display = 'none';
  } else if (panelName === 'reset-password') {
    document.getElementById('reset-password-panel').style.display = 'block';
    document.getElementById('reset-page-email').value = '';
    document.getElementById('reset-page-new-password').value = '';
    document.getElementById('reset-page-confirm-password').value = '';
    document.getElementById('reset-page-error').style.display = 'none';
  }
}

// Show auth (login/register) screen
function showAuthScreen() {
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('app-auth').style.display = 'grid';
  switchAuthTab('login');
}

// Navigation setup
function setupNavigation() {
  const screens = ['dashboard', 'transfer', 'history', 'profile', 'admin'];
  screens.forEach(scr => {
    const btn = document.getElementById(`nav-${scr}`);
    if (btn) {
      btn.addEventListener('click', () => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        searchActive = false;
        switchScreen(scr, true);
      });
    }
  });

  // Logout button
  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    currentToken = null;
    currentScreen = 'dashboard';
    history.pushState(null, '', '/');
    showAuthScreen();
  });
}

// Toggle navigation button active states & handle client side routing via History API
function switchScreen(screenName, updateHistory = true) {
  currentScreen = screenName;
  
  // Update browser URL (SPA Router)
  if (updateHistory) {
    const targetPath = screenName === 'dashboard' ? '/' : `/${screenName}`;
    history.pushState(null, '', targetPath);
  }

  // Hide all screens
  const screens = ['dashboard', 'transfer', 'history', 'profile', 'admin'];
  screens.forEach(scr => {
    const el = document.getElementById(`screen-${scr}`);
    const navBtn = document.getElementById(`nav-${scr}`);
    if (el) el.style.display = 'none';
    if (navBtn) navBtn.classList.remove('active');
  });

  // Show target screen
  const targetScreen = document.getElementById(`screen-${screenName}`);
  const targetNavBtn = document.getElementById(`nav-${screenName}`);
  if (targetScreen) targetScreen.style.display = 'block';
  if (targetNavBtn) targetNavBtn.classList.add('active');

  // Update header text based on screen
  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-sub');
  
  const headers = {
    dashboard: [`Good evening, ${currentUser ? currentUser.name.split(' ')[0] : 'User'}`, 'Here is your financial overview'],
    transfer: ['Transfer', 'Move money securely in seconds'],
    history: ['Transactions', 'Every movement in your account'],
    profile: ['Profile & Settings', 'Manage your account and security'],
    admin: ['Admin Console', 'Operations overview · internal']
  };

  if (headers[screenName]) {
    titleEl.textContent = headers[screenName][0];
    subEl.textContent = headers[screenName][1];
  }

  // Load screen-specific data
  if (screenName === 'dashboard') {
    loadDashboardData();
  } else if (screenName === 'transfer') {
    resetTransferFlow();
  } else if (screenName === 'history') {
    loadTransactions();
  } else if (screenName === 'profile') {
    loadProfileData();
  } else if (screenName === 'admin') {
    loadAdminConsole();
  }
}

function getInitialsSvgUri(name, width, height, fontSize) {
  const initials = getInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="grad-${width}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#2554f6;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#5b8bff;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" rx="${width * 0.28}" fill="url(#grad-${width})" />
    <text x="50%" y="54%" font-family="'Manrope', sans-serif" font-weight="800" font-size="${fontSize}px" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// Update header avatar & details
function updateHeaderProfile() {
  if (!currentUser) return;
  const avatarEl = document.getElementById('user-avatar');
  if (currentUser.avatar_url && currentUser.avatar_url !== 'null') {
    const url = currentUser.avatar_url.startsWith('data:') ? currentUser.avatar_url : `${currentUser.avatar_url}?t=${Date.now()}`;
    avatarEl.src = url;
  } else {
    avatarEl.src = getInitialsSvgUri(currentUser.name, 34, 34, 13);
  }
  
  document.getElementById('header-user-name').textContent = currentUser.name;
  document.getElementById('header-user-role').textContent = currentUser.role;

  // Render admin menu if Admin
  const adminNav = document.getElementById('nav-admin');
  if (currentUser.role === 'Admin') {
    adminNav.style.display = 'flex';
  } else {
    adminNav.style.display = 'none'; // Fix #4: Hidden from ordinary users by default
  }
}

function getInitials(name) {
  const parts = name.trim().split(' ');
  return (parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '');
}

// Format numbers as Rupiah
function formatIDR(num) {
  return 'Rp ' + Math.abs(num).toLocaleString('id-ID');
}

// -------------------------------------------------------------
// Show/Hide Account Number
// -------------------------------------------------------------

function toggleDashboardCardNumber() {
  isDashboardCardVisible = !isDashboardCardVisible;
  const cardNoEl = document.getElementById('dashboard-card-number');
  const eyeIcon = document.getElementById('eye-icon-dashboard');

  if (isDashboardCardVisible) {
    // Show full account number (e.g. 5421 4021)
    cardNoEl.textContent = formatAccountNumber(currentUser.account_no);
    eyeIcon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    // Hide account number
    cardNoEl.textContent = maskAccountNumber(currentUser.account_no);
    eyeIcon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}

function toggleProfileAccountNumber() {
  isProfileAccountVisible = !isProfileAccountVisible;
  const profileNoEl = document.getElementById('profile-account-number');
  const eyeIcon = document.getElementById('eye-icon-profile');

  if (isProfileAccountVisible) {
    profileNoEl.textContent = formatAccountNumber(currentUser.account_no);
    eyeIcon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    profileNoEl.textContent = maskAccountNumber(currentUser.account_no);
    eyeIcon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}

function maskAccountNumber(accNo) {
  if (!accNo) return '';
  return '•••• ' + accNo.slice(-4);
}

function formatAccountNumber(accNo) {
  if (!accNo) return '';
  if (/^\d+$/.test(accNo)) {
    return accNo.match(/.{1,4}/g).join(' ');
  }
  return accNo;
}

// -------------------------------------------------------------
// Screen Loaders
// -------------------------------------------------------------

async function loadDashboardData() {
  await fetchProfile(); // updates current user balance
  document.getElementById('dashboard-balance').textContent = formatIDR(currentUser.balance);
  document.getElementById('card-main-balance').textContent = formatIDR(currentUser.balance);
  
  // Update masked/unmasked values
  const cardNoEl = document.getElementById('dashboard-card-number');
  if (isDashboardCardVisible) {
    cardNoEl.textContent = formatAccountNumber(currentUser.account_no);
  } else {
    cardNoEl.textContent = maskAccountNumber(currentUser.account_no);
  }

  // Load transactions
  await fetchTransactions();
  
  // Render recent transactions (up to 5)
  const recent = transactions.slice(0, 5);
  const recentContainer = document.getElementById('recent-transactions-list');
  recentContainer.innerHTML = '';

  if (recent.length === 0) {
    recentContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #8a93a8;">No transactions found.</div>';
  } else {
    recent.forEach(t => {
      const isIncome = t.amount > 0;
      const nameForInitials = isIncome ? (t.sender_name || t.recipient_name) : t.recipient_name;
      const initials = getInitials(nameForInitials || 'GB');
      const bg = isIncome ? '#e9f8f0' : '#eef3ff';
      const fg = isIncome ? '#1f9d6b' : '#2554f6';
      const amtStr = (isIncome ? '+' : '−') + formatIDR(t.amount);
      const amtColor = isIncome ? '#1f9d6b' : '#0d1a36';
      const directionStr = isIncome ? 'incoming transaction' : 'outgoing transaction';
      const directionColor = isIncome ? '#1f9d6b' : '#2554f6';

      const row = document.createElement('div');
      row.className = 'txn-row';
      row.style = 'display: flex; align-items: center; gap: 13px; padding: 11px 6px; border-radius: 12px; transition: .15s; cursor: pointer;';
      row.onclick = () => viewTransactionReceipt(t.id);

      const senderInfo = t.sender_name ? `${t.sender_name} (${formatAccountNumber(t.sender_account)})` : 'External Source';
      const recipientInfo = t.recipient_name ? `${t.recipient_name} (${formatAccountNumber(t.recipient_account)})` : 'External Dest';

      row.innerHTML = `
        <span style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; background: ${bg}; color: ${fg};">${initials}</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 700; color: #0d1a36;">${isIncome ? 'From: ' + senderInfo : 'To: ' + recipientInfo}</div>
          <div style="font-size: 12px; color: #8a93a8; font-weight: 500;">
            <span>${t.note || t.type}</span>
            <span style="color: ${directionColor}; font-weight: 700;">(${directionStr})</span>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-family: 'JetBrains Mono',monospace; font-size: 14px; font-weight: 600; color: ${amtColor};">${amtStr}</div>
          <div style="font-size: 11px; color: #aab2c5; font-weight: 500;">${t.date}</div>
        </div>
      `;
      recentContainer.appendChild(row);
    });
  }

  // Calculate In/Out stats
  let totalIn = 0;
  let totalOut = 0;
  transactions.forEach(t => {
    if (t.amount > 0) totalIn += t.amount;
    else totalOut += Math.abs(t.amount);
  });
  document.getElementById('income-str').textContent = '+' + formatIDR(totalIn);
  document.getElementById('spend-str').textContent = '−' + formatIDR(totalOut);
}

async function loadTransactions() {
  if (!searchActive) {
    await fetchTransactions();
  }
  filterTransactions(currentFilter);
}

function filterTransactions(filter) {
  currentFilter = filter;
  document.getElementById('filter-all').classList.remove('active');
  document.getElementById('filter-in').classList.remove('active');
  document.getElementById('filter-out').classList.remove('active');
  document.getElementById(`filter-${filter}`).classList.add('active');

  if (filter === 'all') {
    filteredTransactions = transactions;
  } else if (filter === 'in') {
    filteredTransactions = transactions.filter(t => t.amount > 0);
  } else if (filter === 'out') {
    filteredTransactions = transactions.filter(t => t.amount < 0);
  }

  renderHistoryRows();
}

function renderHistoryRows() {
  const container = document.getElementById('full-transactions-list');
  container.innerHTML = '';
  document.getElementById('transactions-count').textContent = `${filteredTransactions.length} transactions`;

  if (filteredTransactions.length === 0) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #8a93a8;">No transactions to display.</div>';
    return;
  }

  filteredTransactions.forEach(t => {
    const isIncome = t.amount > 0;
    const nameForInitials = isIncome ? (t.sender_name || t.recipient_name) : t.recipient_name;
    const initials = getInitials(nameForInitials || 'GB');
    const bg = isIncome ? '#e9f8f0' : '#eef3ff';
    const fg = isIncome ? '#1f9d6b' : '#2554f6';
    const amtStr = (isIncome ? '+' : '−') + formatIDR(t.amount);
    const amtColor = isIncome ? '#1f9d6b' : '#0d1a36';
    const directionStr = isIncome ? 'incoming transaction' : 'outgoing transaction';
    const directionColor = isIncome ? '#1f9d6b' : '#2554f6';

    const row = document.createElement('div');
    row.className = 'txn-row';
    row.style = 'display: flex; align-items: center; gap: 14px; padding: 13px 8px; border-radius: 12px; border-bottom: 1px solid #f2f4f9; transition: .15s; cursor: pointer;';
    row.onclick = () => viewTransactionReceipt(t.id);

    const senderInfo = t.sender_name ? `${t.sender_name} (${formatAccountNumber(t.sender_account)})` : 'External Source';
    const recipientInfo = t.recipient_name ? `${t.recipient_name} (${formatAccountNumber(t.recipient_account)})` : 'External Dest';

    row.innerHTML = `
      <span style="width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; background: ${bg}; color: ${fg};">${initials}</span>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 14px; font-weight: 700;">${isIncome ? 'From: ' + senderInfo : 'To: ' + recipientInfo}</div>
        <div style="font-size: 11.5px; color: #8a93a8; font-weight: 500; display: flex; gap: 8px;">
          <span>${t.note || t.type}</span>
          <span style="color: ${directionColor}; font-weight: 700;">(${directionStr})</span>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-family: 'JetBrains Mono',monospace; font-size: 14.5px; font-weight: 600; color: ${amtColor};">${amtStr}</div>
        <div style="font-size: 11.5px; color: #aab2c5; font-weight: 500;">${t.date}</div>
      </div>
    `;
    container.appendChild(row);
  });
}

function loadProfileData() {
  if (!currentUser) return;
  document.getElementById('profile-name').textContent = currentUser.name;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-status').textContent = `Verified · ${currentUser.role}`;

  const profileNoEl = document.getElementById('profile-account-number');
  if (isProfileAccountVisible) {
    profileNoEl.textContent = formatAccountNumber(currentUser.account_no);
  } else {
    profileNoEl.textContent = maskAccountNumber(currentUser.account_no);
  }

  const avatarEl = document.getElementById('profile-avatar');
  if (currentUser.avatar_url && currentUser.avatar_url !== 'null') {
    const url = currentUser.avatar_url.startsWith('data:') ? currentUser.avatar_url : `${currentUser.avatar_url}?t=${Date.now()}`;
    avatarEl.src = url;
  } else {
    avatarEl.src = getInitialsSvgUri(currentUser.name, 84, 84, 30);
  }
}

async function loadAdminConsole() {
  try {
    const statsRes = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const stats = await statsRes.json();
    
    if (stats.error) {
      showToast('Error: ' + stats.error);
      return;
    }

    document.getElementById('admin-total-users').textContent = stats.totalUsers || '0';
    document.getElementById('admin-total-deposits').textContent = formatIDR(stats.totalDeposits || 0);

    const usersRes = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const usersList = await usersRes.json();

    const usersContainer = document.getElementById('admin-users-list');
    usersContainer.innerHTML = '';

    usersList.forEach(u => {
      const initials = getInitials(u.name);
      const row = document.createElement('div');
      row.className = 'txn-row';
      row.style = 'display: flex; align-items: center; padding: 13px 12px; border-bottom: 1px solid #f2f4f9; transition: .15s;';
      
      const balStr = u.balance !== null ? formatIDR(u.balance) : '—';
      const roleColor = u.role === 'Admin' ? '#2554f6' : '#586079';
      
      row.innerHTML = `
        <div style="flex: 2; display: flex; align-items: center; gap: 12px; min-width: 0;">
          <span style="width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; background: #eef3ff; color: #2554f6;">${initials}</span>
          <div style="min-width: 0;">
            <div style="font-size: 13.5px; font-weight: 700;">${u.name}</div>
            <div style="font-size: 11.5px; color: #8a93a8; font-weight: 500;">${u.email}</div>
          </div>
        </div>
        <div style="flex: 1;"><span style="font-size: 12.5px; font-weight: 700; color: ${roleColor};">${u.role}</span></div>
        <div style="flex: 1.2; text-align: right; font-family: 'JetBrains Mono',monospace; font-size: 13px; font-weight: 600;">${balStr}</div>
        <div style="flex: 1; text-align: right;"><span style="padding: 4px 11px; border-radius: 20px; font-size: 11.5px; font-weight: 700; background: #e9f8f0; color: #1f9d6b;">Active</span></div>
        <div style="flex: 1.5; text-align: right; display: flex; gap: 6px; justify-content: flex-end;">
          <button onclick="viewAdminUserDetail(${u.id})" style="padding: 4px 8px; border: none; border-radius: 6px; background: #eef3ff; color: #2554f6; font-size: 11px; font-weight: 700; cursor: pointer;">Detail</button>
          <button onclick="editAdminUser(${u.id})" style="padding: 4px 8px; border: none; border-radius: 6px; background: #fff1e8; color: #e07a2c; font-size: 11px; font-weight: 700; cursor: pointer;">Edit</button>
          <button onclick="deleteAdminUser(${u.id})" style="padding: 4px 8px; border: none; border-radius: 6px; background: #fff5f6; color: #e0485f; font-size: 11px; font-weight: 700; cursor: pointer;">Delete</button>
        </div>
      `;
      usersContainer.appendChild(row);
    });
  } catch (err) {
    showToast('Failed to load admin stats');
  }
}

// -------------------------------------------------------------
// API Actions
// -------------------------------------------------------------

async function fetchProfile() {
  if (!currentToken || !currentUser) return;
  try {
    const res = await fetch(`/api/users/${currentUser.id}`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data;
      localStorage.setItem('user', JSON.stringify(currentUser));
      updateHeaderProfile();
    }
  } catch (e) {
    console.error('Fetch profile error:', e);
  }
}

async function fetchTransactions() {
  try {
    const res = await fetch('/api/transactions', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      // Front-end filter: only display transactions where currentUser is sender or recipient (prevent User A->B leaking to C)
      transactions = data.filter(t => Number(t.sender_id) === Number(currentUser.id) || Number(t.recipient_id) === Number(currentUser.id));
    }
  } catch (e) {
    console.error('Error loading transactions:', e);
  }
}

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.value;
      try {
        const res = await fetch(`/api/transactions/search?q=${encodeURIComponent(val)}`, {
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await res.json();
        
        if (res.status === 500) {
          showToast('SQL Error: ' + data.details);
          return;
        }

        transactions = data.filter(t => Number(t.sender_id) === Number(currentUser.id) || Number(t.recipient_id) === Number(currentUser.id));
        searchActive = true;
        if (currentScreen !== 'history') {
          switchScreen('history', true);
        } else {
          filterTransactions('all');
        }
      } catch (err) {
        showToast('Search query error');
      }
    }
  });
}

// -------------------------------------------------------------
// Transfer Flow
// -------------------------------------------------------------

function resetTransferFlow() {
  document.getElementById('transfer-step-form').style.display = 'block';
  document.getElementById('transfer-step-confirm').style.display = 'none';
  document.getElementById('transfer-step-done').style.display = 'none';

  document.getElementById('t-recipient').value = '';
  document.getElementById('t-account').value = '';
  document.getElementById('t-amount').value = '';
  document.getElementById('t-note').value = '';
  document.getElementById('t-error').style.display = 'none';

  document.getElementById('transfer-avail-balance').textContent = `Available ${formatIDR(currentUser.balance)}`;
}

function reviewTransfer() {
  const rec = document.getElementById('t-recipient').value.trim();
  const acc = document.getElementById('t-account').value.trim();
  const amt = document.getElementById('t-amount').value.trim();
  const note = document.getElementById('t-note').value;
  const errEl = document.getElementById('t-error');

  if (!rec) {
    errEl.textContent = 'Please enter a recipient.';
    errEl.style.display = 'block';
    return;
  }
  if (!acc) {
    errEl.textContent = 'Please enter an account number.';
    errEl.style.display = 'block';
    return;
  }
  
  const parsedAmt = parseInt(amt, 10);
  if (isNaN(parsedAmt)) {
    errEl.textContent = 'Minimum transfer is Rp 10.000.';
    errEl.style.display = 'block';
    return;
  }

  errEl.style.display = 'none';
  
  document.getElementById('review-amount').textContent = formatIDR(parsedAmt);
  document.getElementById('review-recipient').textContent = rec;
  document.getElementById('review-account').textContent = acc;

  document.getElementById('transfer-step-form').style.display = 'none';
  document.getElementById('transfer-step-confirm').style.display = 'block';
}

function backToTransferForm() {
  document.getElementById('transfer-step-confirm').style.display = 'none';
  document.getElementById('transfer-step-form').style.display = 'block';
}

async function submitTransfer() {
  const rec = document.getElementById('t-recipient').value.trim();
  const acc = document.getElementById('t-account').value.trim();
  const amt = document.getElementById('t-amount').value.trim();
  const note = document.getElementById('t-note').value;

  try {
    const res = await fetch('/api/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ recipient: rec, account: acc, amount: amt, note })
    });
    
    const data = await res.json();
    if (res.ok) {
      document.getElementById('done-message').textContent = `${formatIDR(amt)} sent to ${rec}`;
      document.getElementById('done-ref').textContent = `REF · ${data.ref}`;
      
      document.getElementById('transfer-step-confirm').style.display = 'none';
      document.getElementById('transfer-step-done').style.display = 'block';
      showToast('Transfer sent successfully');
      fetchProfile(); 
    } else {
      document.getElementById('t-error').textContent = data.error || 'Transfer failed';
      document.getElementById('t-error').style.display = 'block';
      backToTransferForm();
    }
  } catch (err) {
    showToast('Network error during transfer');
  }
}

// Copy Card Number to Clipboard Helper
async function copyCardNumberToClipboard() {
  const numberEl = document.getElementById('card-detail-number');
  const numberText = numberEl.textContent.replace(/\s+/g, '');
  try {
    await navigator.clipboard.writeText(numberText);
    showToast('Card number copied to clipboard!');
  } catch (err) {
    const tempInput = document.createElement('input');
    tempInput.value = numberText;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('Card number copied to clipboard!');
  }
}

// Transaction details receipt modal
async function viewTransactionReceipt(id) {
  try {
    const res = await fetch(`/api/transactions/${id}`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      const isSender = (data.sender_id && Number(data.sender_id) === Number(currentUser.id)) || (data.sender_account && data.sender_account === currentUser.account_no);
      const directionStr = isSender ? 'outgoing transaction' : 'incoming transaction';
      const sign = isSender ? '−' : '+';
      const amtColor = isSender ? '#e0485f' : '#1f9d6b';
      const bg = isSender ? '#fff5f6' : '#e9f8f0';
      const fg = isSender ? '#e0485f' : '#1f9d6b';

      const modalHtml = `
        <div style="text-align: left; padding: 10px 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: ${bg}; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
              <span style="font-weight: 800; font-size: 24px; color: ${fg};">${sign}</span>
            </div>
            <div style="font-size: 20px; font-weight: 800; color: #0d1a36;">Transaction Receipt</div>
            <div style="font-size: 13px; color: #8a93a8; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${directionStr}</div>
          </div>
          
          <div style="background: #f8fafc; border-radius: 14px; padding: 16px; margin-bottom: 20px; border: 1px solid #eef2f6;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13.5px;">
              <span style="color: #8a93a8; font-weight: 500;">Amount</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: ${amtColor};">${sign}${formatIDR(data.amount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13.5px;">
              <span style="color: #8a93a8; font-weight: 500;">Date</span>
              <span style="font-weight: 600; color: #0d1a36;">${data.date}</span>
            </div>
            <div style="height: 1px; background: #eef2f6; margin: 12px 0;"></div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 11px; color: #8a93a8; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Sender</div>
              <div style="font-size: 14px; font-weight: 700; color: #0d1a36;">${data.sender_name || 'External Source'}</div>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #586079; margin-top: 2px;">${formatAccountNumber(data.sender_account) || 'External'}</div>
            </div>
            
            <div>
              <div style="font-size: 11px; color: #8a93a8; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Recipient</div>
              <div style="font-size: 14px; font-weight: 700; color: #0d1a36;">${data.recipient_name || 'External Dest'}</div>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #586079; margin-top: 2px;">${formatAccountNumber(data.recipient_account) || 'External'}</div>
            </div>
          </div>

          <div style="font-size: 13px; padding: 12px; border-radius: 10px; background: #f5f8ff; color: #0d1a36; border: 1px dashed #cdd9f5; margin-bottom: 20px;">
            <strong style="color: #2554f6;">Note:</strong> <span id="receipt-note-payload">${data.note || '-'}</span>
          </div>
          
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #aab2c5; text-align: center;">REF · ${data.ref}</div>
          <button onclick="closeModal()" style="width: 100%; margin-top: 20px; padding: 14px; border: none; border-radius: 13px; background: #0d1a36; color: #fff; font-size: 14.5px; font-weight: 700; cursor: pointer;">Close</button>
        </div>
      `;
      
      const receiptModal = document.getElementById('modal-txn-receipt');
      receiptModal.innerHTML = modalHtml;
      
      const noteSpan = receiptModal.querySelector('#receipt-note-payload');
      if (noteSpan) {
        const scripts = noteSpan.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
          eval(scripts[i].innerText);
        }
      }
      
      openModal('txn-receipt');
    }
  } catch (err) {
    showToast('Failed to fetch receipt details');
  }
}

// Insecure HTTP Methods triggers (Fix #8)
async function triggerInsecurePut(id) {
  const newNote = prompt("Enter new transaction note (PUT payload):");
  if (!newNote) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ amount: -485000, note: newNote, recipient_name: 'Modified Recipient' })
    });
    if (res.ok) {
      showToast('Transaction modified via PUT successfully!');
      closeModal();
      loadDashboardData();
    } else {
      showToast('PUT request failed');
    }
  } catch (err) {
    showToast('Network error during PUT request');
  }
}

async function triggerInsecureDelete(id) {
  if (!confirm("Are you sure you want to trigger DELETE method on this transaction?")) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      showToast('Transaction deleted via DELETE successfully!');
      closeModal();
      loadDashboardData();
    } else {
      showToast('DELETE request failed');
    }
  } catch (err) {
    showToast('Network error during DELETE request');
  }
}

// -------------------------------------------------------------
// Card View Details Modal
// -------------------------------------------------------------

async function viewCardDetails(cardType) {
  openModal('card-detail');
  
  const titleEl = document.getElementById('card-detail-title');
  const subtitleEl = document.getElementById('card-detail-subtitle');
  const numberEl = document.getElementById('card-detail-number');
  const balanceEl = document.getElementById('card-detail-balance');
  const txContainer = document.getElementById('card-detail-transactions');

  txContainer.innerHTML = '<div style="padding: 10px; text-align: center; font-size: 12px; color: #8a93a8;">Loading transactions...</div>';

  if (cardType === 'savings') {
    titleEl.textContent = 'Main Savings Card';
    subtitleEl.textContent = 'Active Savings Account Details';
    numberEl.textContent = formatAccountNumber(currentUser.account_no);
    balanceEl.textContent = formatIDR(currentUser.balance);

    // Filter transaction histories for this card
    await fetchTransactions();
    const cardTx = transactions.filter(t => t.card_number === currentUser.account_no || t.recipient_account === currentUser.account_no);
    renderCardTransactions(cardTx, txContainer);
  } else if (cardType === 'payroll') {
    titleEl.textContent = 'Payroll Card';
    subtitleEl.textContent = 'Salary account card details';
    numberEl.textContent = '5421 1188 3321 1188';
    balanceEl.textContent = 'Rp 21.700.000';

    await fetchTransactions();
    const cardTx = transactions.filter(t => t.card_number === '54211188' || t.recipient_account === '54211188');
    renderCardTransactions(cardTx, txContainer);
  }
}

function renderCardTransactions(list, container) {
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<div style="padding: 10px; text-align: center; font-size: 12px; color: #8a93a8;">No transactions for this card.</div>';
    return;
  }

  list.forEach(t => {
    const isIncome = t.amount > 0;
    const amtStr = (isIncome ? '+' : '−') + formatIDR(t.amount);
    const amtColor = isIncome ? '#1f9d6b' : '#e0485f';
    
    const div = document.createElement('div');
    div.style = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 8px; font-size: 13px;';
    div.innerHTML = `
      <div>
        <div style="font-weight: 700; color: #0d1a36;">${t.recipient_name}</div>
        <div style="font-size: 11px; color: #8a93a8;">${t.date}</div>
      </div>
      <div style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${amtColor};">${amtStr}</div>
    `;
    container.appendChild(div);
  });
}

// -------------------------------------------------------------
// Authentication Forms
// -------------------------------------------------------------

let currentAuthTab = 'login';

function switchAuthTab(tab) {
  currentAuthTab = tab;
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const regFields = document.getElementById('reg-fields');
  const loginExtra = document.getElementById('login-extra');
  const authTitle = document.getElementById('auth-title');
  const authSub = document.getElementById('auth-sub');
  const submitBtn = document.getElementById('btn-auth-submit');
  const switchPrompt = document.getElementById('auth-switch-prompt');
  const switchAction = document.getElementById('auth-switch-action');
  
  if (tab === 'login') {
    loginTab.style.background = '#fff';
    loginTab.style.color = '#0d1a36';
    loginTab.style.boxShadow = '0 2px 8px rgba(13,26,54,.08)';
    
    regTab.style.background = 'transparent';
    regTab.style.color = '#8a93a8';
    regTab.style.boxShadow = 'none';

    regFields.style.display = 'none';
    loginExtra.style.display = 'flex';
    authTitle.textContent = 'Welcome back';
    authSub.textContent = 'Sign in to access your Geeks Bank account.';
    submitBtn.textContent = 'Sign In';
    switchPrompt.textContent = "Don't have an account?";
    switchAction.textContent = 'Register now';
  } else {
    regTab.style.background = '#fff';
    regTab.style.color = '#0d1a36';
    regTab.style.boxShadow = '0 2px 8px rgba(13,26,54,.08)';
    
    loginTab.style.background = 'transparent';
    loginTab.style.color = '#8a93a8';
    loginTab.style.boxShadow = 'none';

    regFields.style.display = 'block';
    loginExtra.style.display = 'none';
    authTitle.textContent = 'Create your account';
    authSub.textContent = 'Join 8 million people banking smarter.';
    submitBtn.textContent = 'Create Account';
    switchPrompt.textContent = 'Already have an account?';
    switchAction.textContent = 'Sign in';
  }
  document.getElementById('auth-error').style.display = 'none';
}

function toggleAuthTabLink() {
  switchAuthTab(currentAuthTab === 'login' ? 'register' : 'login');
}

async function handleAuthSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value.trim();
  const errEl = document.getElementById('auth-error');

  errEl.style.display = 'none';

  if (currentAuthTab === 'login') {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentToken = data.token;
        currentUser = data.user;
        showAuthenticatedShell();
        showToast('Login successful');
      } else {
        errEl.textContent = data.error || 'Authentication failed';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'Network error during login';
      errEl.style.display = 'block';
    }
  } else {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Registration successful! Please login.');
        switchAuthTab('login');
      } else {
        errEl.textContent = data.error || 'Registration failed';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'Network error during registration';
      errEl.style.display = 'block';
    }
  }
}

// Forgot Password Flow
async function submitForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  const errEl = document.getElementById('forgot-error');
  const successEl = document.getElementById('forgot-success');

  errEl.style.display = 'none';
  successEl.style.display = 'none';

  if (!email) {
    errEl.textContent = 'Please enter your email address.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok) {
      successEl.textContent = 'Link reset password telah dikirim ke email.';
      successEl.style.display = 'block';
    } else {
      errEl.textContent = data.error || 'Failed to send reset link';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Error connecting to server';
    errEl.style.display = 'block';
  }
}

async function submitResetPagePassword() {
  const email = document.getElementById('reset-page-email').value.trim();
  const newPassword = document.getElementById('reset-page-new-password').value;
  const confirmPassword = document.getElementById('reset-page-confirm-password').value;
  const errEl = document.getElementById('reset-page-error');

  errEl.style.display = 'none';

  if (!email || !newPassword || !confirmPassword) {
    errEl.textContent = 'All fields are required';
    errEl.style.display = 'block';
    return;
  }

  if (newPassword !== confirmPassword) {
    errEl.textContent = 'Passwords do not match';
    errEl.style.display = 'block';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, newPassword })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Password reset successfully!');
      navigateToAuthPath('/');
    } else {
      errEl.textContent = data.error || 'Reset failed';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Error resetting password';
    errEl.style.display = 'block';
  }
}

// -------------------------------------------------------------
// Avatar Upload & SSRF Profile Actions
// -------------------------------------------------------------

async function importAvatar() {
  const urlInput = document.getElementById('avatar-import-url');
  const url = urlInput.value.trim();
  if (!url) {
    showToast('Please enter an avatar URL');
    return;
  }
  
  try {
    const res = await fetch(`/api/users/${currentUser.id}/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser.avatar_url = data.avatar_url;
      localStorage.setItem('user', JSON.stringify(currentUser));
      updateHeaderProfile();
      loadProfileData();
      urlInput.value = ''; // Clear import url field on success (Fix #7)
      showToast('Profile avatar imported successfully');
    } else {
      showToast('Import failed: ' + (data.error || 'Error'));
    }
  } catch (err) {
    showToast('Error importing avatar');
  }
}

// Insecure File Upload Client (Fix #9)
async function uploadAvatarFile() {
  const fileInput = document.getElementById('profile-upload-file');
  const file = fileInput.files[0];
  if (!file) {
    showToast('Please choose a file to upload first.');
    return;
  }

  // Front-end extension validation
  const allowed = ['.png', '.jpg', '.jpeg'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) {
    showToast('Front-end validation: Only PNG, JPG, and JPEG files are allowed!');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${currentToken}` },
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      currentUser.avatar_url = data.url;
      localStorage.setItem('user', JSON.stringify(currentUser));
      updateHeaderProfile();
      loadProfileData();
      fileInput.value = ''; // Clear file input on success (Fix #4)
      showToast('Avatar updated via file upload successfully!');
    } else {
      showToast('Upload failed: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    showToast('Network error during file upload');
  }
}

// -------------------------------------------------------------
// Change Password & Admin Actions
// -------------------------------------------------------------

async function submitChangePassword() {
  const newPassword = document.getElementById('change-pass-input').value;
  const confirmPassword = document.getElementById('change-pass-confirm').value;
  const errEl = document.getElementById('change-pass-error');

  if (!newPassword || !confirmPassword) {
    errEl.textContent = 'New password and confirm password are required';
    errEl.style.display = 'block';
    return;
  }

  if (newPassword !== confirmPassword) {
    errEl.textContent = 'Passwords do not match';
    errEl.style.display = 'block';
    return;
  }

  try {
    // Front-end change password sends a POST request with body to /api/users/change-password
    const res = await fetch('/api/users/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ userId: currentUser.id, newPassword })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Password changed successfully');
      closeModal();
    } else {
      errEl.textContent = data.error || 'Change password failed';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Network error during change password';
    errEl.style.display = 'block';
  }
}

async function submitAdminNewUser() {
  const name = document.getElementById('admin-new-name').value.trim();
  const email = document.getElementById('admin-new-email').value.trim();
  const password = document.getElementById('admin-new-password').value;
  const role = document.getElementById('admin-new-role').value;
  const balance = document.getElementById('admin-new-balance').value;
  const errEl = document.getElementById('admin-newuser-error');

  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ name, email, password, role, balance })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`User ${name} created successfully!`);
      closeModal();
      loadAdminConsole();
    } else {
      errEl.textContent = data.error || 'Failed to create user';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Error connecting to server';
    errEl.style.display = 'block';
  }
}

// -------------------------------------------------------------
// Modal Structure Handlers
// -------------------------------------------------------------

function openModal(type) {
  const container = document.getElementById('modal-container');
  container.style.display = 'flex';
  
  // Hide all modals internally
  document.getElementById('modal-topup').style.display = 'none';
  document.getElementById('modal-paybill').style.display = 'none';
  document.getElementById('modal-card-detail').style.display = 'none';
  document.getElementById('modal-admin-newuser').style.display = 'none';
  document.getElementById('modal-change-password').style.display = 'none';
  document.getElementById('modal-txn-receipt').style.display = 'none';
  document.getElementById('modal-admin-user-detail').style.display = 'none';
  document.getElementById('modal-admin-user-edit').style.display = 'none';

  if (type === 'topup') {
    document.getElementById('modal-topup').style.display = 'block'; // Fix Top Up blank popup (Fix #3)
    document.getElementById('tu-step-form').style.display = 'block';
    document.getElementById('tu-step-done').style.display = 'none';
    document.getElementById('tu-amount').value = '';
    document.getElementById('tu-error').style.display = 'none';
  } else if (type === 'paybill') {
    document.getElementById('modal-paybill').style.display = 'block';
    document.getElementById('pb-step-form').style.display = 'block';
    document.getElementById('pb-step-done').style.display = 'none';
    document.getElementById('pb-account').value = '';
    document.getElementById('pb-amount').value = '';
    document.getElementById('pb-error').style.display = 'none';
    document.getElementById('pb-avail-balance').textContent = formatIDR(currentUser.balance);
    selectBiller('PLN');
  } else if (type === 'card-detail') {
    document.getElementById('modal-card-detail').style.display = 'block';
  } else if (type === 'admin-newuser') {
    document.getElementById('modal-admin-newuser').style.display = 'block';
    document.getElementById('admin-new-name').value = '';
    document.getElementById('admin-new-email').value = '';
    document.getElementById('admin-new-password').value = '';
    document.getElementById('admin-new-balance').value = '';
    document.getElementById('admin-newuser-error').style.display = 'none';
  } else if (type === 'change-password') {
    document.getElementById('modal-change-password').style.display = 'block';
    document.getElementById('change-pass-input').value = '';
    document.getElementById('change-pass-confirm').value = '';
    document.getElementById('change-pass-error').style.display = 'none';
  } else if (type === 'txn-receipt') {
    document.getElementById('modal-txn-receipt').style.display = 'block';
  } else if (type === 'admin-userdetail') {
    document.getElementById('modal-admin-user-detail').style.display = 'block';
  } else if (type === 'admin-useredit') {
    document.getElementById('modal-admin-user-edit').style.display = 'block';
  }
}

function closeModal() {
  document.getElementById('modal-container').style.display = 'none';
}

async function viewAdminUserDetail(id) {
  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      const u = await res.json();
      document.getElementById('admin-detail-id').textContent = u.id;
      document.getElementById('admin-detail-name').textContent = u.name;
      document.getElementById('admin-detail-email').textContent = u.email;
      document.getElementById('admin-detail-role').textContent = u.role;
      document.getElementById('admin-detail-account').textContent = formatAccountNumber(u.account_no);
      document.getElementById('admin-detail-balance').textContent = formatIDR(u.balance);
      openModal('admin-userdetail');
    } else {
      showToast('Failed to fetch user details');
    }
  } catch (err) {
    showToast('Error loading user details');
  }
}

async function editAdminUser(id) {
  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      const u = await res.json();
      document.getElementById('admin-edit-id').value = u.id;
      document.getElementById('admin-edit-name').value = u.name;
      document.getElementById('admin-edit-email').value = u.email;
      document.getElementById('admin-edit-role').value = u.role;
      document.getElementById('admin-edit-balance').value = u.balance;
      document.getElementById('admin-edit-error').style.display = 'none';
      openModal('admin-useredit');
    } else {
      showToast('Failed to fetch user details');
    }
  } catch (err) {
    showToast('Error loading user details');
  }
}

async function submitAdminEditUser() {
  const id = document.getElementById('admin-edit-id').value;
  const name = document.getElementById('admin-edit-name').value.trim();
  const email = document.getElementById('admin-edit-email').value.trim();
  const role = document.getElementById('admin-edit-role').value;
  const balance = document.getElementById('admin-edit-balance').value;
  const errEl = document.getElementById('admin-edit-error');

  errEl.style.display = 'none';

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ name, email, role, balance })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('User updated successfully');
      closeModal();
      loadAdminConsole();
    } else {
      errEl.textContent = data.error || 'Failed to update user';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Error connecting to server';
    errEl.style.display = 'block';
  }
}

async function deleteAdminUser(id) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('User deleted successfully');
      loadAdminConsole();
    } else {
      showToast('Failed to delete user: ' + (data.error || ''));
    }
  } catch (err) {
    showToast('Error deleting user');
  }
}

function selectTuMethod(method) {
  tuMethod = method;
  document.getElementById('tu-method-bank').classList.remove('active');
  document.getElementById('tu-method-card').classList.remove('active');
  document.getElementById('tu-method-va').classList.remove('active');
  document.getElementById(`tu-method-${method}`).classList.add('active');
}

function quickSelectTu(amt, btn) {
  document.getElementById('tu-amount').value = amt;
  const buttons = document.querySelectorAll('.amt-btn');
  buttons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function submitTopup() {
  const amt = document.getElementById('tu-amount').value;
  const errEl = document.getElementById('tu-error');
  const parsedAmt = parseInt(amt, 10);

  if (isNaN(parsedAmt) || parsedAmt < 10000) {
    errEl.textContent = 'Minimum top up is Rp 10.000.';
    errEl.style.display = 'block';
    return;
  }
  
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/topup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ amount: amt, method: tuMethod })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('tu-step-form').style.display = 'none';
      document.getElementById('tu-step-done').style.display = 'block';
      document.getElementById('tu-done-msg').textContent = `${formatIDR(amt)} added to Main Savings`;
      
      await fetchProfile();
      document.getElementById('tu-done-bal').textContent = `New balance · ${formatIDR(currentUser.balance)}`;
      showToast('Top up successful');
    } else {
      errEl.textContent = data.error || 'Top up failed';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Network error during top up';
    errEl.style.display = 'block';
  }
}

// -------------------------------------------------------------
// Pay Bill Flow
// -------------------------------------------------------------

function selectBiller(biller) {
  pbBiller = biller;
  const billers = ['PLN', 'PDAM', 'Internet', 'BPJS'];
  billers.forEach(b => {
    const btn = document.getElementById(`pb-btn-${b}`);
    if (btn) btn.classList.remove('active');
  });
  document.getElementById(`pb-btn-${biller}`).classList.add('active');

  const names = { PLN: 'PLN Electricity', PDAM: 'PDAM Water', Internet: 'Internet', BPJS: 'BPJS Health' };
  const labels = { Internet: 'CUSTOMER ID', BPJS: 'MEMBER NUMBER', PLN: 'CUSTOMER NUMBER', PDAM: 'CUSTOMER NUMBER' };

  document.getElementById('pb-account-label').textContent = labels[biller];
  document.getElementById('btn-pb-submit').textContent = `Pay ${names[biller]}`;
}

async function submitPaybill() {
  const account = document.getElementById('pb-account').value.trim();
  const amt = document.getElementById('pb-amount').value.trim();
  const errEl = document.getElementById('pb-error');

  if (!account) {
    errEl.textContent = 'Please enter your customer number.';
    errEl.style.display = 'block';
    return;
  }

  const parsedAmt = parseInt(amt, 10);
  if (isNaN(parsedAmt) || parsedAmt < 10000) {
    errEl.textContent = 'Minimum payment is Rp 10.000.';
    errEl.style.display = 'block';
    return;
  }

  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/paybill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ biller: pbBiller, account, amount: amt })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('pb-step-form').style.display = 'none';
      document.getElementById('pb-step-done').style.display = 'block';
      document.getElementById('pb-done-msg').textContent = `${formatIDR(amt)} paid to ${pbBiller}`;
      
      await fetchProfile();
      document.getElementById('pb-done-bal').textContent = `New balance · ${formatIDR(currentUser.balance)}`;
      showToast('Payment successful');
    } else {
      errEl.textContent = data.error || 'Payment failed';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Network error during payment';
    errEl.style.display = 'block';
  }
}

// -------------------------------------------------------------
// UI Utilities
// -------------------------------------------------------------

function toggleSwitch(btn) {
  btn.classList.toggle('active');
  const label = btn.closest('div').querySelector('div').textContent;
  const isActive = btn.classList.contains('active');
  showToast(`${label} ${isActive ? 'enabled' : 'disabled'}`);
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('app-toast');
  toast.textContent = message;
  toast.style.display = 'block';
  
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 2600);
}
