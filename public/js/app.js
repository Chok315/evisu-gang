/* ═══════════════════════════════════════════════════════════════
   EVISU GANG - Official FiveM Gang Web Application
   Tick-based Shop Check-in & Discord Real-time Sync
   ═══════════════════════════════════════════════════════════════ */

let socket = null;
let shopsData = [];
let checkins = [];
let membersData = [];
let myCheckedShopId = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initNavbar();
  initUsername();
  initSocket();
  loadData();
});

// ── Particle Canvas Background ───────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 45; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      color: Math.random() > 0.5 ? 'rgba(204, 0, 0, 0.4)' : 'rgba(201, 168, 76, 0.25)'
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    requestAnimationFrame(render);
  }
  render();
}

// ── Navbar ───────────────────────────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  });

  const links = document.querySelectorAll('.nav-link');
  links.forEach(l => {
    l.addEventListener('click', (e) => {
      links.forEach(x => x.classList.remove('active'));
      l.classList.add('active');
    });
  });
}

// ── Username Management ──────────────────────────────────────
function initUsername() {
  const input = document.getElementById('usernameInput');
  const clearBtn = document.getElementById('clearAllBtn');
  if (!input) return;

  const savedName = localStorage.getItem('evisu_username') || '';
  input.value = savedName;

  input.addEventListener('change', () => {
    const val = input.value.trim();
    if (val) localStorage.setItem('evisu_username', val);
  });

  clearBtn?.addEventListener('click', () => {
    checkoutCurrent();
  });
}

function getMyUsername() {
  const input = document.getElementById('usernameInput');
  let name = input ? input.value.trim() : '';
  if (!name) {
    name = localStorage.getItem('evisu_username') || 'EVISU Member';
    if (input) input.value = name;
  }
  return name;
}

function getMyUserId() {
  let id = localStorage.getItem('evisu_user_id');
  if (!id) {
    id = 'web_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('evisu_user_id', id);
  }
  return id;
}

// ── Socket.io Connection ─────────────────────────────────────
function initSocket() {
  try {
    if (typeof io !== 'undefined') {
      socket = io();

      socket.on('connect', () => {
        setConnStatus(true);
      });

      socket.on('disconnect', () => {
        setConnStatus(false);
      });

      socket.on('initial_state', (data) => {
        if (data.shops) shopsData = data.shops;
        if (data.checkins) checkins = data.checkins;
        if (data.gangMembers) membersData = data.gangMembers;
        renderAll();
      });

      socket.on('checkin_update', (event) => {
        handleCheckinEvent(event);
      });
    } else {
      setConnStatus(false);
    }
  } catch (err) {
    console.warn('Socket connection error:', err);
    setConnStatus(false);
  }
}

function setConnStatus(connected) {
  const dot = document.getElementById('connectionDot');
  const txt = document.getElementById('connectionText');
  if (dot) dot.className = connected ? 'status-dot connected' : 'status-dot disconnected';
  if (txt) txt.textContent = connected ? 'Connected' : 'Offline';
}

// ── Load Data via REST API ───────────────────────────────────
async function loadData() {
  try {
    const [sRes, cRes, mRes, stRes] = await Promise.all([
      fetch('/api/shops').then(r => r.json()).catch(() => []),
      fetch('/api/checkins').then(r => r.json()).catch(() => []),
      fetch('/api/members').then(r => r.json()).catch(() => []),
      fetch('/api/stats').then(r => r.json()).catch(() => null)
    ]);

    if (Array.isArray(sRes) && sRes.length > 0) shopsData = sRes;
    if (Array.isArray(cRes)) checkins = cRes;
    if (Array.isArray(mRes)) membersData = mRes;

    if (stRes) {
      animateNum('statMembers', stRes.totalMembers || 0);
      animateNum('statActive', stRes.activeNow || 0);
      animateNum('statShops', stRes.totalShops || shopsData.length);
    } else {
      animateNum('statMembers', membersData.length || 12);
      animateNum('statActive', checkins.length);
      animateNum('statShops', shopsData.length || 15);
    }

    // Check if user is currently checked into a shop
    const myId = getMyUserId();
    const myCheckin = checkins.find(c => c.userId === myId);
    if (myCheckin) {
      myCheckedShopId = myCheckin.shopId;
    }

    renderAll();
  } catch (err) {
    console.error('Failed to load API data:', err);
  }
}

// ── Event Handler ─────────────────────────────────────────────
function handleCheckinEvent(event) {
  if (event.type === 'CHECKIN') {
    // Add or update checkin
    checkins = checkins.filter(c => c.userId !== event.userId);
    checkins.push({
      userId: event.userId,
      userName: event.userName,
      shopId: event.shop.id,
      shopName: event.shop.name,
      shopEmoji: event.shop.emoji,
      avatar: event.avatar,
      checkinTime: event.checkinTime
    });

    addActivityLog('in', `${event.shop.emoji} <strong>${escapeHtml(event.userName)}</strong> เข้า ${escapeHtml(event.shop.name)}`);
  } else if (event.type === 'CHECKOUT') {
    const prev = checkins.find(c => c.userId === event.userId);
    checkins = checkins.filter(c => c.userId !== event.userId);
    if (prev) {
      addActivityLog('out', `🚪 <strong>${escapeHtml(event.userName)}</strong> ออกจาก ${escapeHtml(prev.shopName)}`);
    }
  }

  animateNum('statActive', checkins.length);
  renderAll();
}

// ── Render All ────────────────────────────────────────────────
function renderAll() {
  renderShops();
  renderWhoIsWhere();
  renderMembers();
}

// ── Render Shop List (Tick-based) ─────────────────────────────
function renderShops() {
  const container = document.getElementById('shopList');
  if (!container) return;

  if (!shopsData || shopsData.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">กำลังโหลดรายชื่อร้าน...</div>';
    return;
  }

  const myId = getMyUserId();

  container.innerHTML = shopsData.map(shop => {
    const occupants = checkins.filter(c => c.shopId === shop.id || c.shopName === shop.name);
    const isOccupied = occupants.length > 0;
    const isCheckedByMe = (myCheckedShopId === shop.id) || occupants.some(o => o.userId === myId);

    const occupantBadge = isOccupied
      ? `<span class="shop-occupant-count has-people">🔴 ${occupants.length} คน</span>`
      : `<span class="shop-occupant-count empty">ว่าง</span>`;

    return `
      <div class="shop-row ${isCheckedByMe ? 'checked' : ''}" data-shop-id="${shop.id}">
        <div class="shop-checkbox">
          <span class="shop-checkbox-icon">✓</span>
        </div>
        <span class="shop-emoji">${shop.emoji || '🏪'}</span>
        <div class="shop-info">
          <div class="shop-name">${escapeHtml(shop.name)}</div>
          <div class="shop-zone">📍 ${escapeHtml(shop.zone || 'Los Santos')}</div>
        </div>
        ${occupantBadge}
      </div>
    `;
  }).join('');

  // Attach click events
  container.querySelectorAll('.shop-row').forEach(row => {
    row.addEventListener('click', () => {
      const shopId = row.getAttribute('data-shop-id');
      handleShopToggle(shopId);
    });
  });
}

// ── Toggle Shop Check-in ──────────────────────────────────────
async function handleShopToggle(shopId) {
  const myId = getMyUserId();
  const myName = getMyUsername();

  // If already checked in to THIS shop -> Check out
  if (myCheckedShopId === shopId) {
    await checkoutCurrent();
    return;
  }

  // Otherwise -> Check in to this shop
  myCheckedShopId = shopId;
  const shop = shopsData.find(s => s.id === shopId);
  const shopName = shop ? shop.name : shopId;

  // Optimistic UI update
  renderShops();

  try {
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: myId,
        userName: myName,
        shopId: shopId
      })
    });

    if (res.ok) {
      showToast(`🏪 Check-in สำเร็จ: ${shopName}`);
    } else {
      console.warn('Checkin API responded with error');
    }
  } catch (err) {
    console.error('Checkin network error:', err);
  }
}

async function checkoutCurrent() {
  const myId = getMyUserId();
  const myName = getMyUsername();
  myCheckedShopId = null;

  renderShops();

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: myId,
        userName: myName
      })
    });

    if (res.ok) {
      showToast('🚪 ออกจากร้านเรียบร้อย');
    }
  } catch (err) {
    console.error('Checkout network error:', err);
  }
}

// ── Render Who is Where ───────────────────────────────────────
function renderWhoIsWhere() {
  const list = document.getElementById('whoiswhereList');
  const badge = document.getElementById('onlineBadge');
  if (!list) return;

  if (badge) badge.textContent = `${checkins.length} คน`;

  if (!checkins || checkins.length === 0) {
    list.innerHTML = `
      <div class="ww-empty">
        <span>😴</span>
        <p>ยังไม่มีใคร Check-in</p>
        <small>พิมพ์ชื่อแล้วกดติ๊กเลือกร้านด้านซ้ายได้เลย</small>
      </div>
    `;
    return;
  }

  list.innerHTML = checkins.map(c => {
    const initial = (c.userName || '?')[0].toUpperCase();
    const avatar = c.avatar
      ? `<img src="${c.avatar}" class="ww-avatar" alt="${escapeHtml(c.userName)}" />`
      : `<div class="ww-avatar-placeholder">${initial}</div>`;

    return `
      <div class="ww-item">
        ${avatar}
        <div class="ww-info">
          <div class="ww-name">${escapeHtml(c.userName)}</div>
          <div class="ww-shop">${c.shopEmoji || '🏪'} ${escapeHtml(c.shopName)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Render Activity Log ───────────────────────────────────────
function addActivityLog(type, text) {
  const logContainer = document.getElementById('activityLog');
  if (!logContainer) return;

  // Clear "waiting for data" empty message if present
  const empty = logContainer.querySelector('.activity-empty');
  if (empty) empty.remove();

  const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const item = document.createElement('div');
  item.className = 'activity-item';
  item.style.cssText = 'padding: 6px 10px; font-size: 0.78rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-dim); display: flex; justify-content: space-between; align-items: center;';
  item.innerHTML = `
    <span>${text}</span>
    <span style="font-size: 0.65rem; color: var(--text-muted);">${time}</span>
  `;

  logContainer.insertBefore(item, logContainer.firstChild);

  // Keep max 8 items
  while (logContainer.children.length > 8) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// ── Render Gang Members ───────────────────────────────────────
function renderMembers() {
  const grid = document.getElementById('membersGrid');
  if (!grid) return;

  if (!membersData || membersData.length === 0) {
    grid.innerHTML = '<div style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">ไม่มีข้อมูลสมาชิก</div>';
    return;
  }

  grid.innerHTML = membersData.map(m => {
    const checkin = checkins.find(c => c.userId === m.id) || m.currentCheckin;
    const isOnline = Boolean(checkin || m.status === 'online');

    const locText = checkin
      ? `<div style="color: var(--gold); font-size: 0.75rem; margin-top: 4px;">📍 ${checkin.shopEmoji || '🏪'} ${escapeHtml(checkin.shopName)}</div>`
      : `<div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">😴 ออฟไลน์</div>`;

    return `
      <div class="member-card" style="background: var(--glass); border: 1px solid var(--glass-border); border-radius: var(--radius); padding: 20px; text-align: center; position: relative;">
        <span class="rank-badge" style="position: absolute; top: 12px; right: 12px; background: rgba(204,0,0,0.2); border: 1px solid var(--red-dark); color: var(--red-light); font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${m.rank || 'Member'}</span>
        <div style="width: 56px; height: 56px; margin: 0 auto 12px; border-radius: 50%; border: 2px solid ${isOnline ? 'var(--red)' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-family: var(--font-brand); font-size: 1.4rem; color: var(--gold); background: var(--bg3);">
          ${(m.name || 'E')[0].toUpperCase()}
        </div>
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text);">${escapeHtml(m.name)}</div>
        ${locText}
      </div>
    `;
  }).join('');
}

// ── Helpers ───────────────────────────────────────────────────
function animateNum(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  if (diff === 0) return;

  let current = start;
  const step = diff > 0 ? 1 : -1;
  const timer = setInterval(() => {
    current += step;
    el.textContent = current;
    if (current === target) clearInterval(timer);
  }, 25);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  let container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: rgba(10, 10, 10, 0.95);
    border: 1px solid var(--red);
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    margin-top: 8px;
    font-size: 0.85rem;
    box-shadow: 0 4px 15px rgba(204, 0, 0, 0.4);
    animation: fadeIn 0.3s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}
