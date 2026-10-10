/* ═══════════════════════════════════════════════════════════════
   EVISU GANG - Official FiveM Gang Web Application
   Member-based Login & Admin Management System
   ═══════════════════════════════════════════════════════════════ */

let socket = null;
let shopsData = [];
let checkins = [];
let membersData = [];
let ranksData = [];
let myCheckedShopId = null;

// User session
let currentUser = null;
let adminPin = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initNavbar();
  initUserSession();
  initModals();
  initAdminPanel();
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
    l.addEventListener('click', () => {
      links.forEach(x => x.classList.remove('active'));
      l.classList.add('active');
    });
  });
}

// ── User Session & Login ─────────────────────────────────────
function initUserSession() {
  try {
    const saved = localStorage.getItem('evisu_user');
    if (saved) {
      currentUser = JSON.parse(saved);
      adminPin = sessionStorage.getItem('evisu_admin_pin') || null;
    }
  } catch (e) {
    currentUser = null;
  }
  updateUserUI();
}

function updateUserUI() {
  const navLoginBtn = document.getElementById('navLoginBtn');
  const userProfileNav = document.getElementById('userProfileNav');
  const adminBtn = document.getElementById('adminBtn');
  const sessionAvatar = document.getElementById('sessionAvatar');
  const sessionName = document.getElementById('sessionName');
  const sessionRank = document.getElementById('sessionRank');
  const sessionLoginBtn = document.getElementById('sessionLoginBtn');
  const sessionLogoutBtn = document.getElementById('sessionLogoutBtn');

  if (currentUser) {
    // Nav Profile
    if (userProfileNav) {
      const initial = (currentUser.name || 'E')[0].toUpperCase();
      userProfileNav.innerHTML = `
        <div class="user-badge-nav" title="คลิกเพื่อออกจากระบบ" style="cursor: pointer;" id="navUserBadge">
          <div class="nav-user-avatar">${initial}</div>
          <span class="nav-user-name">${escapeHtml(currentUser.name)}</span>
          <span class="nav-user-rank">${escapeHtml(currentUser.rank || 'สมาชิก')}</span>
        </div>
      `;
      document.getElementById('navUserBadge')?.addEventListener('click', openLogoutConfirm);
    }

    // Admin button
    if (adminBtn) {
      if (currentUser.isAdmin) {
        adminBtn.classList.remove('hidden');
      } else {
        adminBtn.classList.add('hidden');
      }
    }

    // Tracker Session Banner
    if (sessionAvatar) sessionAvatar.textContent = (currentUser.name || 'E')[0].toUpperCase();
    if (sessionName) sessionName.textContent = currentUser.name;
    if (sessionRank) {
      sessionRank.textContent = currentUser.rank || 'สมาชิก';
      if (currentUser.isAdmin) {
        sessionRank.className = 'session-rank leader';
      } else {
        sessionRank.className = 'session-rank';
      }
    }

    sessionLoginBtn?.classList.add('hidden');
    sessionLogoutBtn?.classList.remove('hidden');

  } else {
    // Guest
    if (userProfileNav) {
      userProfileNav.innerHTML = `
        <button id="navLoginBtn" class="btn-login-nav">
          <span>🔑</span> เข้าสู่ระบบ
        </button>
      `;
      document.getElementById('navLoginBtn')?.addEventListener('click', openLoginModal);
    }

    adminBtn?.classList.add('hidden');

    if (sessionAvatar) sessionAvatar.textContent = '?';
    if (sessionName) sessionName.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
    if (sessionRank) {
      sessionRank.textContent = 'กรุณาเข้าสู่ระบบ';
      sessionRank.className = 'session-rank';
    }

    sessionLoginBtn?.classList.remove('hidden');
    sessionLogoutBtn?.classList.add('hidden');
  }

  // Update shop checkboxes
  renderShops();
}

function openLogoutConfirm() {
  if (confirm(`คุณต้องการออกจากระบบของ "${currentUser?.name}" หรือไม่?`)) {
    logoutUser();
  }
}

function logoutUser() {
  currentUser = null;
  adminPin = null;
  localStorage.removeItem('evisu_user');
  sessionStorage.removeItem('evisu_admin_pin');
  myCheckedShopId = null;
  updateUserUI();
  showToast('🚪 ออกจากระบบเรียบร้อย');
}

// ── Modals: Login & Admin ────────────────────────────────────
function initModals() {
  const loginModal = document.getElementById('loginModal');
  const closeLoginBtn = document.getElementById('closeLoginModal');
  const sessionLoginBtn = document.getElementById('sessionLoginBtn');
  const heroLoginBtn = document.getElementById('heroLoginBtn');
  const sessionLogoutBtn = document.getElementById('sessionLogoutBtn');
  const memberSelect = document.getElementById('memberSelect');
  const adminPinGroup = document.getElementById('adminPinGroup');
  const adminPinInput = document.getElementById('adminPinInput');
  const submitLoginBtn = document.getElementById('submitLoginBtn');
  const loginError = document.getElementById('loginError');

  // Trigger login modal
  sessionLoginBtn?.addEventListener('click', openLoginModal);
  heroLoginBtn?.addEventListener('click', openLoginModal);
  closeLoginBtn?.addEventListener('click', () => loginModal?.classList.add('hidden'));

  sessionLogoutBtn?.addEventListener('click', openLogoutConfirm);

  loginModal?.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.classList.add('hidden');
  });

  // When member is selected in dropdown
  memberSelect?.addEventListener('change', () => {
    const selectedId = memberSelect.value;
    const member = membersData.find(m => m.id === selectedId);
    if (member && member.isAdmin) {
      adminPinGroup?.classList.remove('hidden');
      adminPinInput?.focus();
    } else {
      adminPinGroup?.classList.add('hidden');
      if (adminPinInput) adminPinInput.value = '';
    }
    if (loginError) loginError.classList.add('hidden');
  });

  // Submit login
  submitLoginBtn?.addEventListener('click', async () => {
    const selectedId = memberSelect?.value;
    if (!selectedId) {
      showLoginError('กรุณาเลือกรายชื่อสมาชิก');
      return;
    }

    const pin = adminPinInput?.value || '';
    submitLoginBtn.disabled = true;
    submitLoginBtn.textContent = 'กำลังตรวจสอบ...';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedId, pin })
      });

      const data = await res.json();

      if (!res.ok) {
        showLoginError(data.error || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        submitLoginBtn.disabled = false;
        submitLoginBtn.textContent = 'เข้าสู่ระบบ';
        return;
      }

      // Success
      currentUser = data.user;
      localStorage.setItem('evisu_user', JSON.stringify(currentUser));
      if (pin) {
        adminPin = pin;
        sessionStorage.setItem('evisu_admin_pin', pin);
      }

      loginModal?.classList.add('hidden');
      updateUserUI();
      showToast(`👋 ยินดีต้อนรับ ${currentUser.name} (${currentUser.rank})`);

      // Sync active check-in
      const myCheckin = checkins.find(c => c.userId === currentUser.id);
      myCheckedShopId = myCheckin ? myCheckin.shopId : null;
      renderShops();

    } catch (err) {
      showLoginError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      submitLoginBtn.disabled = false;
      submitLoginBtn.textContent = 'เข้าสู่ระบบ';
    }
  });
}

function openLoginModal() {
  const loginModal = document.getElementById('loginModal');
  const loginError = document.getElementById('loginError');
  const adminPinInput = document.getElementById('adminPinInput');
  if (loginError) loginError.classList.add('hidden');
  if (adminPinInput) adminPinInput.value = '';

  populateMemberSelect();
  loginModal?.classList.remove('hidden');
}

function showLoginError(msg) {
  const loginError = document.getElementById('loginError');
  if (loginError) {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
  }
}

function populateMemberSelect() {
  const select = document.getElementById('memberSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- กรุณาเลือกชื่อของคุณ --</option>';

  // Sort by rank: Leader -> Vice Leader -> Members
  const sorted = [...membersData].sort((a, b) => (b.rankLevel || 0) - (a.rankLevel || 0));

  sorted.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.rank || 'สมาชิก'})${m.isAdmin ? ' 🛡️' : ''}`;
    select.appendChild(opt);
  });

  if (currentVal) select.value = currentVal;
}

// ── Admin Panel ──────────────────────────────────────────────
function initAdminPanel() {
  const adminBtn = document.getElementById('adminBtn');
  const adminModal = document.getElementById('adminModal');
  const closeAdminBtn = document.getElementById('closeAdminModal');
  const clearAllBtn = document.getElementById('adminClearAllBtn');
  const addMemberBtn = document.getElementById('adminAddMemberBtn');

  adminBtn?.addEventListener('click', () => {
    if (!currentUser || !currentUser.isAdmin) {
      showToast('❌ เฉพาะหัวแก๊งและรองหัวแก๊งเท่านั้น');
      return;
    }
    populateRankSelects();
    renderAdminOccupants();
    renderAdminMemberList();
    renderAdminRanksList();
    adminModal?.classList.remove('hidden');
  });

  closeAdminBtn?.addEventListener('click', () => adminModal?.classList.add('hidden'));

  adminModal?.addEventListener('click', (e) => {
    if (e.target === adminModal) adminModal.classList.add('hidden');
  });

  // Tab switching
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId)?.classList.add('active');

      if (targetId === 'manage-ranks-tab') {
        renderAdminRanksList();
      } else if (targetId === 'manage-members-tab') {
        renderAdminMemberList();
      } else if (targetId === 'add-member-tab') {
        populateRankSelects();
      }
    });
  });

  // Admin Clear All
  clearAllBtn?.addEventListener('click', async () => {
    if (!confirm('⚠️ ยืนยันการรีเซ็ตการ Check-in ของทุกคนออกจากทุกร้าน?')) return;
    try {
      const res = await fetch('/api/admin/clear-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin: getAdminPin() })
      });
      if (res.ok) {
        showToast('✅ รีเซ็ตการ Check-in ทั้งหมดเรียบร้อย');
        renderAdminOccupants();
      } else {
        showToast('❌ ไม่สามารถทำรายการได้');
      }
    } catch (err) {
      showToast('❌ เกิดข้อผิดพลาด');
    }
  });

  // Admin Add Member
  addMemberBtn?.addEventListener('click', async () => {
    const nameInput = document.getElementById('newMemberName');
    const roleSelect = document.getElementById('newMemberRole');
    const name = nameInput?.value.trim();
    const rankId = roleSelect?.value;

    if (!name) {
      alert('กรุณากรอกชื่อสมาชิก');
      return;
    }

    const selectedRank = ranksData.find(r => r.id === rankId) || { name: 'สมาชิก', role: 'member' };

    try {
      const res = await fetch('/api/admin/add-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin: getAdminPin(),
          name,
          rankId,
          role: selectedRank.role || selectedRank.id,
          rank: selectedRank.name
        })
      });

      if (res.ok) {
        showToast(`➕ เพิ่มสมาชิก "${name}" (${selectedRank.name}) สำเร็จ`);
        if (nameInput) nameInput.value = '';
        renderAdminMemberList();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(`❌ ${data.error || 'เพิ่มสมาชิกไม่สำเร็จ'}`);
      }
    } catch (err) {
      showToast('❌ ข้อผิดพลาดในการเชื่อมต่อ');
    }
  });

  // Initialize Rank Management Sub-system
  initRankManagement();
}

function getAdminPin() {
  return adminPin || sessionStorage.getItem('evisu_admin_pin') || prompt('กรุณาใส่รหัสผ่านแอดมิน (PIN):') || '';
}

// ── Rank Management & Helpers ────────────────────────────────
function getRankInfo(rankName, role) {
  const found = ranksData.find(r => r.name === rankName || r.id === role || r.role === role);
  if (found) return found;
  if (role === 'leader' || rankName === 'หัวแก๊ง') {
    return { name: 'หัวแก๊ง', rankLevel: 5, color: '#c9a84c', isAdmin: true };
  }
  if (role === 'vice_leader' || rankName === 'รองหัวแก๊ง') {
    return { name: 'รองหัวแก๊ง', rankLevel: 4, color: '#cc0000', isAdmin: true };
  }
  return { name: rankName || 'สมาชิก', rankLevel: 1, color: '#95a5a6', isAdmin: false };
}

function initRankManagement() {
  const nameInput = document.getElementById('newRankName');
  const levelSelect = document.getElementById('newRankLevel');
  const colorPicker = document.getElementById('newRankColorPicker');
  const presetBtns = document.querySelectorAll('.color-preset-dot');
  const preview = document.getElementById('rankBadgePreview');
  const addRankBtn = document.getElementById('adminAddRankBtn');
  const isAdminCheck = document.getElementById('newRankIsAdmin');

  let currentColor = colorPicker?.value || '#c9a84c';

  function updatePreview() {
    if (!preview) return;
    const txt = nameInput?.value.trim() || 'ตัวอย่างยศ';
    preview.textContent = txt;
    preview.style.background = `${currentColor}28`;
    preview.style.borderColor = currentColor;
    preview.style.color = currentColor;
  }

  // Color preset buttons
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentColor = btn.getAttribute('data-color') || '#c9a84c';
      if (colorPicker) colorPicker.value = currentColor;
      updatePreview();
    });
  });

  // Native color picker
  colorPicker?.addEventListener('input', (e) => {
    currentColor = e.target.value;
    presetBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-color') === currentColor);
    });
    updatePreview();
  });

  // Name input listener
  nameInput?.addEventListener('input', updatePreview);
  updatePreview();

  // Add Rank Button
  addRankBtn?.addEventListener('click', async () => {
    const name = nameInput?.value.trim();
    const rankLevel = parseInt(levelSelect?.value) || 2;
    const isAdmin = Boolean(isAdminCheck?.checked);
    const color = currentColor;

    if (!name) {
      alert('กรุณากรอกชื่อยศ');
      nameInput?.focus();
      return;
    }

    addRankBtn.disabled = true;
    addRankBtn.textContent = 'กำลังบันทึก...';

    try {
      const res = await fetch('/api/admin/add-rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin: getAdminPin(),
          name,
          rankLevel,
          isAdmin,
          color
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`🎖️ เพิ่มยศ "${name}" เรียบร้อยแล้ว`);
        if (nameInput) nameInput.value = '';
        if (isAdminCheck) isAdminCheck.checked = false;
        updatePreview();
        if (data.ranks) ranksData = data.ranks;
        populateRankSelects();
        renderAdminRanksList();
        renderAdminMemberList();
        renderMembers();
      } else {
        alert(data.error || 'เพิ่มยศไม่สำเร็จ');
      }
    } catch (err) {
      showToast('❌ ข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      addRankBtn.disabled = false;
      addRankBtn.textContent = '➕ บันทึกยศใหม่';
    }
  });
}

function populateRankSelects() {
  const roleSelect = document.getElementById('newMemberRole');
  if (!roleSelect) return;

  const currentVal = roleSelect.value;
  const sorted = [...ranksData].sort((a, b) => (b.rankLevel || 0) - (a.rankLevel || 0));

  roleSelect.innerHTML = sorted.map(r => `
    <option value="${r.id}">${escapeHtml(r.name)} (Lv.${r.rankLevel})${r.isAdmin ? ' 🛡️' : ''}</option>
  `).join('');

  if (currentVal && sorted.some(r => r.id === currentVal)) {
    roleSelect.value = currentVal;
  }
}

function renderAdminRanksList() {
  const container = document.getElementById('adminRanksList');
  if (!container) return;

  if (!ranksData || ranksData.length === 0) {
    container.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">ไม่พบข้อมูลยศ</div>';
    return;
  }

  const sorted = [...ranksData].sort((a, b) => (b.rankLevel || 0) - (a.rankLevel || 0));

  container.innerHTML = sorted.map(r => {
    const memberCount = membersData.filter(m => m.rank === r.name || m.role === r.role || m.role === r.id).length;
    const color = r.color || '#c9a84c';
    const isSystem = Boolean(r.isSystem);

    return `
      <div class="admin-item-row">
        <div class="admin-item-info">
          <span class="rank-badge preview-badge" style="background: ${color}25; border: 1px solid ${color}; color: ${color};">
            ${escapeHtml(r.name)}
          </span>
          <div>
            <div class="admin-item-name" style="font-size: 0.82rem;">
              ระดับ Lv.${r.rankLevel} ${r.isAdmin ? '<span style="color: var(--gold); font-size: 0.75rem;">• 🛡️ มีสิทธิ์แอดมิน</span>' : ''}
            </div>
            <div class="admin-item-sub">สมาชิกในยศนี้: <strong>${memberCount}</strong> คน</div>
          </div>
        </div>
        ${!isSystem ? `
          <button class="btn-danger-small" onclick="adminRemoveRank('${r.id}', '${escapeHtml(r.name)}')">🗑️ ลบ</button>
        ` : `
          <span style="font-size: 0.72rem; color: var(--text-muted); padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">ยศหลัก</span>
        `}
      </div>
    `;
  }).join('');
}

window.adminRemoveRank = async function(rankId, rankName) {
  if (!confirm(`ยืนยันการลบยศ "${rankName}" ออกจากแก๊ง?\n\n(สมาชิกที่มียศนี้อยู่จะถูกปรับเป็น "สมาชิก" ทั่วไปอัตโนมัติ)`)) return;

  try {
    const res = await fetch('/api/admin/remove-rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPin: getAdminPin(), rankId })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`🗑️ ลบยศ "${rankName}" สำเร็จ`);
      if (data.ranks) ranksData = data.ranks;
      populateRankSelects();
      renderAdminRanksList();
      renderAdminMemberList();
      renderMembers();
    } else {
      alert(data.error || 'ลบยศไม่สำเร็จ');
    }
  } catch (err) {
    showToast('❌ ข้อผิดพลาดในการเชื่อมต่อ');
  }
};

function renderAdminOccupants() {
  const container = document.getElementById('adminOccupantsList');
  if (!container) return;

  if (!checkins || checkins.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">ไม่มีสมาชิกที่ Check-in อยู่ในขณะนี้</div>';
    return;
  }

  container.innerHTML = checkins.map(c => `
    <div class="admin-item-row">
      <div class="admin-item-info">
        <span class="shop-badge-num">${escapeHtml(c.shopEmoji || '')}</span>
        <div>
          <div class="admin-item-name">${escapeHtml(c.userName)}</div>
          <div class="admin-item-sub">ประจำอยู่ที่: ${escapeHtml(c.shopName)}</div>
        </div>
      </div>
      <button class="btn-danger-small" onclick="adminForceCheckout('${c.userId}')">🚪 เตะออก</button>
    </div>
  `).join('');
}

window.adminForceCheckout = async function(userId) {
  if (!confirm('ยืนยันให้สมาชิกคนนี้ออกจากร้าน?')) return;
  try {
    const res = await fetch('/api/admin/checkout-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPin: getAdminPin(), targetUserId: userId })
    });
    if (res.ok) {
      showToast('✅ สั่ง Check-out เรียบร้อย');
      renderAdminOccupants();
    }
  } catch (err) {
    showToast('❌ เกิดข้อผิดพลาด');
  }
};

function renderAdminMemberList() {
  const container = document.getElementById('adminMemberList');
  if (!container) return;

  const sortedMembers = [...membersData].sort((a, b) => (b.rankLevel || 0) - (a.rankLevel || 0));

  container.innerHTML = sortedMembers.map(m => {
    const isLeader = m.id === '1' || m.role === 'leader';
    const rankInfo = getRankInfo(m.rank, m.role);
    const rColor = rankInfo.color || '#c9a84c';

    // Build options for all ranks
    const rankOptions = ranksData.map(r => {
      const isSelected = (m.rank === r.name) || (m.role === r.role) || (m.role === r.id);
      return `<option value="${r.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(r.name)} (Lv.${r.rankLevel})</option>`;
    }).join('');

    return `
      <div class="admin-item-row">
        <div class="admin-item-info">
          <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--bg); display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${rColor}; border: 1px solid ${rColor}; flex-shrink: 0;">
            ${(m.name || 'E')[0].toUpperCase()}
          </div>
          <div>
            <div class="admin-item-name">${escapeHtml(m.name)}</div>
            <div class="admin-item-sub">
              <span class="rank-badge preview-badge" style="background: ${rColor}22; border: 1px solid ${rColor}; color: ${rColor}; font-size: 0.65rem; padding: 2px 7px;">
                ${escapeHtml(m.rank || 'สมาชิก')}
              </span>
              ${m.isAdmin ? '<span style="color: var(--gold); font-size: 0.75rem; margin-left: 4px;">🛡️</span>' : ''}
            </div>
          </div>
        </div>
        <div class="admin-member-actions">
          ${!isLeader ? `
            <select class="admin-member-rank-select" onchange="adminChangeMemberRank('${m.id}', this.value)" title="เปลี่ยนยศ">
              ${rankOptions}
            </select>
            <button class="btn-danger-small" onclick="adminRemoveMember('${m.id}', '${escapeHtml(m.name)}')" title="ลบสมาชิก">ลบ</button>
          ` : `
            <span style="font-size: 0.75rem; color: var(--gold); font-weight: 700; padding: 4px 8px; border: 1px solid var(--gold); border-radius: 4px; background: rgba(201,168,76,0.1);">👑 หัวแก๊งหลัก</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

window.adminChangeMemberRank = async function(memberId, rankId) {
  try {
    const res = await fetch('/api/admin/update-member-rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminPin: getAdminPin(),
        memberId,
        rankId
      })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`✅ เปลี่ยนยศสมาชิกสำเร็จ`);
      // If updating currently logged in user
      if (currentUser && currentUser.id === memberId) {
        currentUser.rank = data.member.rank;
        currentUser.role = data.member.role;
        currentUser.rankLevel = data.member.rankLevel;
        currentUser.isAdmin = Boolean(data.member.isAdmin);
        localStorage.setItem('evisu_user', JSON.stringify(currentUser));
        updateUserUI();
      }
    } else {
      alert(data.error || 'เปลี่ยนยศไม่สำเร็จ');
      renderAdminMemberList();
    }
  } catch (err) {
    showToast('❌ ข้อผิดพลาดในการเชื่อมต่อ');
    renderAdminMemberList();
  }
};

window.adminRemoveMember = async function(id, name) {
  if (!confirm(`ยืนยันการลบสมาชิก "${name}" ออกจากระบบแก๊ง?`)) return;
  try {
    const res = await fetch('/api/admin/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPin: getAdminPin(), memberId: id })
    });
    if (res.ok) {
      showToast(`🗑️ ลบสมาชิก "${name}" เรียบร้อย`);
      renderAdminMemberList();
    }
  } catch (err) {
    showToast('❌ เกิดข้อผิดพลาด');
  }
};

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
        if (data.ranks) {
          ranksData = data.ranks;
          populateRankSelects();
          renderAdminRanksList();
        }
        if (data.gangMembers) {
          membersData = data.gangMembers;
          populateMemberSelect();
        }
        syncMyCheckinState();
        renderAll();
      });

      socket.on('checkin_update', (event) => {
        handleCheckinEvent(event);
      });

      socket.on('members_update', (newMembers) => {
        membersData = newMembers;
        populateMemberSelect();
        renderMembers();
        renderAdminMemberList();
        renderAdminRanksList();
        animateNum('statMembers', membersData.length);
      });

      socket.on('ranks_update', (newRanks) => {
        ranksData = newRanks;
        populateRankSelects();
        renderAdminRanksList();
        renderAdminMemberList();
        renderMembers();
      });
    } else {
      setConnStatus(false);
    }
  } catch (err) {
    setConnStatus(false);
  }
}

function setConnStatus(connected) {
  const dot = document.getElementById('connectionDot');
  const txt = document.getElementById('connectionText');
  if (dot) dot.className = connected ? 'status-dot connected' : 'status-dot disconnected';
  if (txt) txt.textContent = connected ? 'Connected' : 'Offline';
}

function syncMyCheckinState() {
  if (currentUser) {
    const my = checkins.find(c => c.userId === currentUser.id);
    myCheckedShopId = my ? my.shopId : null;
  } else {
    myCheckedShopId = null;
  }
}

// ── Load Data via REST API ───────────────────────────────────
async function loadData() {
  try {
    const [sRes, cRes, mRes, rkRes, stRes] = await Promise.all([
      fetch('/api/shops').then(r => r.json()).catch(() => []),
      fetch('/api/checkins').then(r => r.json()).catch(() => []),
      fetch('/api/members').then(r => r.json()).catch(() => []),
      fetch('/api/ranks').then(r => r.json()).catch(() => []),
      fetch('/api/stats').then(r => r.json()).catch(() => null)
    ]);

    if (Array.isArray(sRes) && sRes.length > 0) shopsData = sRes;
    if (Array.isArray(cRes)) checkins = cRes;
    if (Array.isArray(rkRes) && rkRes.length > 0) {
      ranksData = rkRes;
      populateRankSelects();
    }
    if (Array.isArray(mRes)) {
      membersData = mRes;
      populateMemberSelect();
    }

    if (stRes) {
      animateNum('statMembers', stRes.totalMembers || membersData.length);
      animateNum('statActive', stRes.activeNow || checkins.length);
      animateNum('statShops', stRes.totalShops || shopsData.length);
    } else {
      animateNum('statMembers', membersData.length);
      animateNum('statActive', checkins.length);
      animateNum('statShops', shopsData.length);
    }

    syncMyCheckinState();
    renderAll();
  } catch (err) {
    console.error('Failed to load API data:', err);
  }
}

// ── Event Handler ─────────────────────────────────────────────
function handleCheckinEvent(event) {
  if (event.type === 'CLEAR_ALL') {
    checkins = [];
    myCheckedShopId = null;
    addActivityLog('out', '⚠️ <strong>แอดมิน</strong> รีเซ็ตการ Check-in ทั้งหมด');
  } else if (event.type === 'CHECKIN') {
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

    if (currentUser && currentUser.id === event.userId) {
      myCheckedShopId = event.shop.id;
    }

    addActivityLog('in', `<span class="shop-badge-num">${event.shop.emoji}</span> <strong>${escapeHtml(event.userName)}</strong> เข้า ${escapeHtml(event.shop.name)}`);
  } else if (event.type === 'CHECKOUT') {
    const prev = checkins.find(c => c.userId === event.userId);
    checkins = checkins.filter(c => c.userId !== event.userId);

    if (currentUser && currentUser.id === event.userId) {
      myCheckedShopId = null;
    }

    const sName = prev ? prev.shopName : 'ร้าน';
    addActivityLog('out', `🚪 <strong>${escapeHtml(event.userName || 'สมาชิก')}</strong> ออกจาก ${escapeHtml(sName)}`);
  }

  animateNum('statActive', checkins.length);
  renderAll();
  renderAdminOccupants();
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
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">กำลังโหลดรายชื่อจุดประจำทั้ง 8 ร้าน...</div>';
    return;
  }

  const currentId = currentUser ? currentUser.id : null;

  container.innerHTML = shopsData.map(shop => {
    const occupants = checkins.filter(c => c.shopId === shop.id || c.shopName === shop.name);
    const isOccupied = occupants.length > 0;
    const isCheckedByMe = currentId && ((myCheckedShopId === shop.id) || occupants.some(o => o.userId === currentId));

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
  // Check if user is logged in
  if (!currentUser) {
    showToast('⚠️ กรุณาเข้าสู่ระบบด้วยชื่อของคุณก่อนกด Check-in ครับ');
    openLoginModal();
    return;
  }

  const myId = currentUser.id;
  const myName = currentUser.name;

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
      showToast(`🏪 Check-in สำเร็จ: [${shop?.emoji || ''}] ${shopName}`);
    }
  } catch (err) {
    console.error('Checkin network error:', err);
  }
}

async function checkoutCurrent() {
  if (!currentUser) return;

  const myId = currentUser.id;
  const myName = currentUser.name;
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
        <small>เข้าสู่ระบบแล้วกดติ๊กเลือกร้านด้านซ้ายได้เลย</small>
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
          <div class="ww-shop"><span class="shop-badge-num">${escapeHtml(c.shopEmoji || '')}</span> ${escapeHtml(c.shopName)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Render Activity Log ───────────────────────────────────────
function addActivityLog(type, text) {
  const logContainer = document.getElementById('activityLog');
  if (!logContainer) return;

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

  // Sort: Leader -> Vice Leader -> Members
  const sorted = [...membersData].sort((a, b) => (b.rankLevel || 0) - (a.rankLevel || 0));

  grid.innerHTML = sorted.map(m => {
    const checkin = checkins.find(c => c.userId === m.id);
    const isOnline = Boolean(checkin);

    const locText = checkin
      ? `<div style="color: var(--gold); font-size: 0.75rem; margin-top: 4px;">📍 <span class="shop-badge-num">${escapeHtml(checkin.shopEmoji || '')}</span> ${escapeHtml(checkin.shopName)}</div>`
      : `<div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">😴 ออฟไลน์</div>`;

    const rankInfo = getRankInfo(m.rank, m.role);
    const rColor = rankInfo.color || '#c9a84c';
    const isLeader = m.role === 'leader' || rankInfo.rankLevel === 5;
    const isHighRank = rankInfo.rankLevel >= 4;
    const borderColor = isLeader
      ? 'var(--gold)'
      : (isHighRank
        ? 'var(--red)'
        : (isOnline ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)'));
    const badgeColor = `background: ${rColor}25; border-color: ${rColor}; color: ${rColor};`;

    return `
      <div class="member-card" style="background: var(--glass); border: 1px solid ${borderColor}; border-radius: var(--radius); padding: 20px; text-align: center; position: relative; transition: var(--transition);">
        <span class="rank-badge" style="position: absolute; top: 12px; right: 12px; border: 1px solid; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; ${badgeColor}">${escapeHtml(m.rank || 'สมาชิก')}</span>
        <div style="width: 58px; height: 58px; margin: 0 auto 12px; border-radius: 50%; border: 2px solid ${isOnline ? 'var(--red)' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-family: var(--font-brand); font-size: 1.5rem; color: var(--gold); background: var(--bg3); box-shadow: ${isOnline ? '0 0 14px rgba(204,0,0,0.5)' : 'none'};">
          ${(m.name || 'E')[0].toUpperCase()}
        </div>
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text);">${escapeHtml(m.name)}</div>
        ${locText}
      </div>
    `;
  }).join('');
}

// ── Utils ─────────────────────────────────────────────────────
function animateNum(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const duration = 400;
  const step = target > current ? 1 : -1;
  let cur = current;

  const timer = setInterval(() => {
    cur += step;
    el.textContent = cur;
    if (cur === target) clearInterval(timer);
  }, Math.max(15, Math.floor(duration / Math.abs(target - current || 1))));
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
