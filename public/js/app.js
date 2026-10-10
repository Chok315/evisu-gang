/* ════════════════════════════════════════
   EVISU GANG - Frontend JavaScript
   Socket.io + Real-time Updates
   ════════════════════════════════════════ */

// ── Global State ──────────────────────────────
let socket = null;
let checkins = [];
let shopsData = [];
let membersData = [];
let activityLog = [];
let currentFilter = 'all';
const MAX_ACTIVITY = 30;

// ── Init ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initNavbar();
  initSocket();
  loadInitialData();
  initShopsFilter();
  initCounter();
});

// ── Socket.io Connection ──────────────────────
function initSocket() {
  try {
    socket = io();

    socket.on('connect', () => {
      setConnectionStatus(true);
    });

    socket.on('disconnect', () => {
      setConnectionStatus(false);
    });

    socket.on('initial_state', (data) => {
      checkins = data.checkins || [];
      shopsData = data.shops || [];
      membersData = data.gangMembers || [];
      renderAll();
    });

    socket.on('checkin_update', (event) => {
      handleCheckinUpdate(event);
    });
  } catch (e) {
    console.warn('Socket.io not available, using polling...');
    setConnectionStatus(false);
    setInterval(loadInitialData, 10000);
  }
}

function setConnectionStatus(connected) {
  const dot = document.getElementById('connectionDot');
  const text = document.getElementById('connectionText');
  if (connected) {
    dot.className = 'status-dot connected';
    text.textContent = 'Connected';
  } else {
    dot.className = 'status-dot disconnected';
    text.textContent = 'Offline';
  }
}

// ── Load Initial Data via REST ────────────────
async function loadInitialData() {
  try {
    const [shopsRes, checkinsRes, membersRes, statsRes] = await Promise.all([
      fetch('/api/shops'),
      fetch('/api/checkins'),
      fetch('/api/members'),
      fetch('/api/stats'),
    ]);

    shopsData = await shopsRes.json();
    checkins = await checkinsRes.json();
    membersData = await membersRes.json();
    const stats = await statsRes.json();

    animateCounter('statMembers', stats.totalMembers);
    animateCounter('statActive', stats.activeNow);
    animateCounter('statShops', stats.totalShops);

    renderAll();
    setConnectionStatus(true);
  } catch (e) {
    console.error('Failed to load data:', e);
    // Show demo data when server not connected
    loadDemoData();
  }
}

function loadDemoData() {
  document.getElementById('statMembers').textContent = '12';
  document.getElementById('statActive').textContent = '3';
  document.getElementById('statShops').textContent = '15';

  // Demo members
  membersData = [
    { id: '1', name: 'Boss EVISU', rank: 'Don', rankLevel: 5, status: 'online', currentCheckin: { shopName: 'Ammu-Nation', shopEmoji: '🔫' } },
    { id: '2', name: 'Capo RedWolf', rank: 'Capo', rankLevel: 4, status: 'online', currentCheckin: null },
    { id: '3', name: 'Soldier Ghost', rank: 'Soldier', rankLevel: 3, status: 'offline', currentCheckin: null },
    { id: '4', name: 'Associate Blade', rank: 'Associate', rankLevel: 2, status: 'online', currentCheckin: { shopName: 'Fleeca Bank', shopEmoji: '🏦' } },
    { id: '5', name: 'Associate Shadow', rank: 'Associate', rankLevel: 2, status: 'online', currentCheckin: null },
    { id: '6', name: 'Soldier Reaper', rank: 'Soldier', rankLevel: 3, status: 'offline', currentCheckin: null },
  ];

  checkins = [
    { userId: '1', userName: 'Boss EVISU', shopName: 'Ammu-Nation', shopEmoji: '🔫', checkinTime: new Date(Date.now() - 1800000).toISOString() },
    { userId: '4', userName: 'Associate Blade', shopName: 'Fleeca Bank', shopEmoji: '🏦', checkinTime: new Date(Date.now() - 600000).toISOString() },
    { userId: '7', userName: 'Soldier Cruz', shopName: 'Mechanic Shop', shopEmoji: '🔧', checkinTime: new Date(Date.now() - 300000).toISOString() },
  ];

  renderAll();
}

// ── Handle Real-time Updates ──────────────────
function handleCheckinUpdate(event) {
  if (event.type === 'CHECKIN') {
    // Remove existing check-in for this user
    checkins = checkins.filter(c => c.userId !== event.userId);
    // Add new
    checkins.push({
      userId: event.userId,
      userName: event.userName,
      avatar: event.avatar,
      shopId: event.shop.id,
      shopName: event.shop.name,
      shopEmoji: event.shop.emoji,
      checkinTime: event.checkinTime
    });

    addActivity('checkin', event);
    showToast('checkin', `${event.shop.emoji} ${event.userName} เข้า ${event.shop.name}`);
    animateCounter('statActive', checkins.length);

  } else if (event.type === 'CHECKOUT') {
    const prev = checkins.find(c => c.userId === event.userId);
    checkins = checkins.filter(c => c.userId !== event.userId);
    if (prev) {
      addActivity('checkout', { ...event, prevShop: prev });
      showToast('checkout', `🚪 ${event.userName} ออกจาก ${prev.shopName}`);
    }
    animateCounter('statActive', checkins.length);
  }

  updateLastUpdated();
  renderCheckins();
  renderShops();
  renderMembers();
}

// ── Render All ────────────────────────────────
function renderAll() {
  renderCheckins();
  renderShops();
  renderMembers();
  updateLastUpdated();
  animateCounter('statActive', checkins.length);
}

// ── Render Check-ins ──────────────────────────
function renderCheckins() {
  const grid = document.getElementById('checkinGrid');
  const emptyState = document.getElementById('emptyState');
  const liveCount = document.getElementById('liveCount');

  liveCount.textContent = `${checkins.length} คนกำลัง Online`;

  if (checkins.length === 0) {
    grid.innerHTML = '';
    grid.appendChild(emptyState || createEmptyState());
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Build cards HTML
  const cards = checkins.map(c => {
    const timeAgo = formatTimeAgo(c.checkinTime);
    const avatarHtml = c.avatar
      ? `<img src="${c.avatar}" alt="${c.userName}" class="checkin-avatar" onerror="this.outerHTML=getPlaceholderAvatar('${c.userName}')" />`
      : getPlaceholderAvatar(c.userName);

    return `
      <div class="checkin-card" data-user="${c.userId}">
        ${avatarHtml}
        <div class="checkin-info">
          <div class="checkin-name">${escHtml(c.userName)}</div>
          <div class="checkin-shop">${c.shopEmoji || '🏪'} ${escHtml(c.shopName)}</div>
          <div class="checkin-time">⏱ ${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = cards;
}

function getPlaceholderAvatar(name) {
  const initial = name ? name[0].toUpperCase() : '?';
  return `<div class="checkin-avatar-placeholder">${initial}</div>`;
}

function createEmptyState() {
  const div = document.createElement('div');
  div.id = 'emptyState';
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-icon">😴</div>
    <p>ยังไม่มีสมาชิก Check-in</p>
    <small>ใช้ <strong>/checkin</strong> ใน Discord เพื่อบอกตำแหน่ง</small>
  `;
  return div;
}

// ── Render Shops ──────────────────────────────
function renderShops() {
  const grid = document.getElementById('shopsGrid');
  if (!grid) return;

  const cards = shopsData.map(shop => {
    const occupants = checkins.filter(c => c.shopId === shop.id || c.shopName === shop.name);
    const hasOccupants = occupants.length > 0;
    const filterHide = shouldHideShop(hasOccupants);

    const occupantList = hasOccupants
      ? occupants.map(o => `<div class="shop-occupant-name">👤 ${escHtml(o.userName)}</div>`).join('')
      : '';

    return `
      <div class="shop-card ${hasOccupants ? 'occupied' : ''} ${filterHide ? 'hidden' : ''}"
           data-occupied="${hasOccupants}" data-shop="${shop.id}">
        <span class="shop-emoji">${shop.emoji}</span>
        <div class="shop-name">${escHtml(shop.name)}</div>
        <div class="shop-zone">📍 ${escHtml(shop.zone)}</div>
        <div class="shop-occupants">
          <div class="shop-count ${hasOccupants ? 'has-people' : 'empty'}">
            ${hasOccupants ? `🔴 ${occupants.length} คน` : '⬜ ว่าง'}
          </div>
          ${hasOccupants ? `<div class="shop-occupant-list">${occupantList}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = cards;
}

function shouldHideShop(hasOccupants) {
  if (currentFilter === 'occupied') return !hasOccupants;
  if (currentFilter === 'empty') return hasOccupants;
  return false;
}

// ── Render Members ────────────────────────────
function renderMembers() {
  const grid = document.getElementById('membersGrid');
  if (!grid) return;

  const cards = membersData.map(m => {
    const checkin = checkins.find(c => c.userId === m.id) || m.currentCheckin;
    const avatarHtml = m.avatar
      ? `<img src="${m.avatar}" alt="${m.name}" class="member-avatar" />`
      : `<div class="member-avatar-placeholder">${m.name[0]}</div>`;

    const locationHtml = checkin
      ? `<div class="member-location at-shop">${checkin.shopEmoji || '🏪'} ${escHtml(checkin.shopName)}</div>`
      : `<div class="member-location">😴 ไม่ได้ออนไลน์</div>`;

    return `
      <div class="member-card">
        <span class="rank-badge rank-${m.rankLevel}">${m.rank}</span>
        <div class="member-avatar-wrap">
          ${avatarHtml}
          <span class="member-online-dot ${m.status}"></span>
        </div>
        <div class="member-name">${escHtml(m.name)}</div>
        <div class="member-rank-text">${m.rank.toUpperCase()}</div>
        ${locationHtml}
      </div>
    `;
  }).join('');

  grid.innerHTML = cards;
}

// ── Activity Feed ─────────────────────────────
function addActivity(type, event) {
  const item = { type, event, time: new Date() };
  activityLog.unshift(item);
  if (activityLog.length > MAX_ACTIVITY) activityLog.pop();
  renderActivityFeed();
}

function renderActivityFeed() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  if (activityLog.length === 0) {
    feed.innerHTML = '<div class="feed-empty">รอรับข้อมูลจาก Discord...</div>';
    return;
  }

  feed.innerHTML = activityLog.map(({ type, event, time }) => {
    const timeStr = time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    if (type === 'checkin') {
      return `
        <div class="feed-item checkin">
          <span class="feed-time">${timeStr}</span>
          <span class="feed-text">
            ${event.shop ? event.shop.emoji : '🏪'}
            <strong>${escHtml(event.userName)}</strong>
            เข้า
            <span class="shop-name">${event.shop ? escHtml(event.shop.name) : ''}</span>
          </span>
        </div>
      `;
    } else {
      const prev = event.prevShop || {};
      return `
        <div class="feed-item checkout">
          <span class="feed-time">${timeStr}</span>
          <span class="feed-text">
            🚪 <strong>${escHtml(event.userName)}</strong>
            ออกจาก <span class="shop-name">${escHtml(prev.shopName || '')}</span>
          </span>
        </div>
      `;
    }
  }).join('');
}

// ── Toast Notifications ───────────────────────
function showToast(type, message) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Shop Filter ───────────────────────────────
function initShopsFilter() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderShops();
    });
  });
}

// ── Navbar ────────────────────────────────────
function initNavbar() {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar.classList.toggle('scrolled', window.scrollY > 50);

    // Active link highlighting
    const sections = ['home', 'live', 'members', 'shops'];
    let current = 'home';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 100) current = id;
    });
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.section === current);
    });
  });

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ── Counter Animation ─────────────────────────
function initCounter() {
  animateCounter('statMembers', 0);
  animateCounter('statActive', 0);
  animateCounter('statShops', 0);
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  const diff = target - current;
  const steps = 20;
  const step = diff / steps;
  let i = 0;
  const timer = setInterval(() => {
    i++;
    el.textContent = Math.round(current + step * i);
    if (i >= steps) { el.textContent = target; clearInterval(timer); }
  }, 30);
}

// ── Last Updated ──────────────────────────────
function updateLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (el) {
    el.textContent = `อัพเดทล่าสุด: ${new Date().toLocaleTimeString('th-TH')}`;
  }
}

// ── Particle System ───────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let particles = [];
  const PARTICLE_COUNT = 60;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = -Math.random() * 0.6 - 0.2;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.6 ? '#c9a84c' : '#cc0000';
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.opacity -= 0.001;
      if (this.y < 0 || this.opacity <= 0) this.reset();
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }

  animate();
}

// ── Utilities ─────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTimeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff} วินาทีที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
}

// ── Auto refresh time display ─────────────────
setInterval(() => {
  document.querySelectorAll('.checkin-time').forEach(el => {
    const card = el.closest('.checkin-card');
    const userId = card?.dataset.user;
    const c = checkins.find(c => c.userId === userId);
    if (c) el.textContent = `⏱ ${formatTimeAgo(c.checkinTime)}`;
  });
}, 30000);
