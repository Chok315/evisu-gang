// ============================================
// EVISU Gang - Express Server + Socket.io
// ============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { activeCheckIns, gangMembers, gangRanks, shops, ADMIN_PASSWORD, saveData } = require('../data/store');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Export io so other modules can use it
module.exports.io = io;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Health check ────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/ping', (req, res) => res.send('pong'));

// ── API Routes ──────────────────────────────

// Member Login
app.post('/api/login', (req, res) => {
  const { memberId, name, pin } = req.body;
  const member = gangMembers.find(m => m.id === memberId || (name && m.name.toLowerCase() === name.toLowerCase().trim()));
  if (!member) {
    return res.status(404).json({ error: 'ไม่พบรายชื่อนี้ในระบบแก๊ง' });
  }

  // If Admin (หัวแก๊ง / รองหัวแก๊ง / custom admin rank), requires PIN
  if (member.isAdmin) {
    if (!pin) {
      return res.json({ requireAdminPin: true, member: { id: member.id, name: member.name, rank: member.rank, role: member.role } });
    }
    if (pin !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'รหัสผ่านแอดมิน (PIN) ไม่ถูกต้อง' });
    }
  }

  res.json({
    success: true,
    user: {
      id: member.id,
      name: member.name,
      rank: member.rank,
      role: member.role,
      isAdmin: Boolean(member.isAdmin),
      rankLevel: member.rankLevel || 1
    }
  });
});

// Admin: Force check out user
app.post('/api/admin/checkout-user', (req, res) => {
  const { adminPin, targetUserId } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }

  const prev = activeCheckIns.get(targetUserId);
  if (prev) {
    activeCheckIns.delete(targetUserId);
    io.emit('checkin_update', { type: 'CHECKOUT', userId: targetUserId, userName: prev.userName, prevShop: prev });
    console.log(`[ADMIN FORCE CHECK-OUT] ${prev.userName} by Admin`);
  }
  res.json({ success: true });
});

// Admin: Clear all check-ins
app.post('/api/admin/clear-all', (req, res) => {
  const { adminPin } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }

  activeCheckIns.clear();
  io.emit('checkin_update', { type: 'CLEAR_ALL' });
  console.log('[ADMIN CLEAR ALL] All shop check-ins cleared by Admin');
  res.json({ success: true });
});

// GET all ranks
app.get('/api/ranks', (req, res) => {
  const sorted = [...gangRanks].sort((a, b) => (b.rankLevel || 0) - (a.rankLevel || 0));
  res.json(sorted);
});

// Admin: Add custom rank (หัวแก๊ง/แอดมินสร้างยศใหม่)
app.post('/api/admin/add-rank', (req, res) => {
  const { adminPin, name, rankLevel, isAdmin, color } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อยศ' });
  }

  const trimmedName = name.trim();
  if (gangRanks.some(r => r.name.toLowerCase() === trimmedName.toLowerCase())) {
    return res.status(400).json({ error: `มียศชื่อ "${trimmedName}" ในระบบแล้ว` });
  }

  const newRank = {
    id: 'rank_' + Date.now(),
    name: trimmedName,
    role: 'custom_' + Date.now(),
    rankLevel: Math.max(1, Math.min(5, parseInt(rankLevel) || 2)),
    isAdmin: Boolean(isAdmin),
    color: color || '#c9a84c',
    isSystem: false
  };

  gangRanks.push(newRank);
  if (typeof saveData === 'function') saveData();
  io.emit('ranks_update', gangRanks);
  console.log(`[ADMIN ADD RANK] ${newRank.name} (Lv.${newRank.rankLevel}, Admin: ${newRank.isAdmin})`);
  res.json({ success: true, rank: newRank, ranks: gangRanks });
});

// Admin: Remove custom rank
app.post('/api/admin/remove-rank', (req, res) => {
  const { adminPin, rankId } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }

  const rankIndex = gangRanks.findIndex(r => r.id === rankId);
  if (rankIndex === -1) {
    return res.status(404).json({ error: 'ไม่พบยศที่ต้องการลบ' });
  }

  const targetRank = gangRanks[rankIndex];
  if (targetRank.isSystem) {
    return res.status(400).json({ error: 'ไม่สามารถลบยศระบบหลักได้ (หัวแก๊ง / รองหัวแก๊ง / สมาชิก)' });
  }

  // Any member holding this deleted rank falls back to standard member
  const defaultMemberRank = gangRanks.find(r => r.id === 'member') || { name: 'สมาชิก', role: 'member', rankLevel: 1, isAdmin: false };
  let updatedAny = false;
  gangMembers.forEach(m => {
    if (m.rank === targetRank.name || m.role === targetRank.role || m.role === targetRank.id) {
      m.rank = defaultMemberRank.name;
      m.role = defaultMemberRank.role;
      m.rankLevel = defaultMemberRank.rankLevel;
      m.isAdmin = defaultMemberRank.isAdmin;
      updatedAny = true;
    }
  });

  gangRanks.splice(rankIndex, 1);
  if (typeof saveData === 'function') saveData();
  io.emit('ranks_update', gangRanks);
  if (updatedAny) {
    io.emit('members_update', gangMembers);
  }

  console.log(`[ADMIN REMOVE RANK] ${targetRank.name}`);
  res.json({ success: true, ranks: gangRanks });
});

// Admin: Update member rank (เปลี่ยนยศสมาชิก)
app.post('/api/admin/update-member-rank', (req, res) => {
  const { adminPin, memberId, rankId } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }

  const member = gangMembers.find(m => m.id === memberId);
  if (!member) {
    return res.status(404).json({ error: 'ไม่พบสมาชิกนี้ในระบบ' });
  }

  const targetRank = gangRanks.find(r => r.id === rankId || r.name === rankId);
  if (!targetRank) {
    return res.status(404).json({ error: 'ไม่พบยศที่ต้องการเปลี่ยน' });
  }

  // Don't allow changing Supreme leader to something else unless intended
  if (member.id === '1' && targetRank.id !== 'leader') {
    return res.status(400).json({ error: 'ไม่สามารถลดหรือเปลี่ยนยศของหัวแก๊งหลักได้' });
  }

  member.rank = targetRank.name;
  member.role = targetRank.role || targetRank.id;
  member.rankLevel = targetRank.rankLevel || 1;
  member.isAdmin = Boolean(targetRank.isAdmin);

  if (typeof saveData === 'function') saveData();
  io.emit('members_update', gangMembers);
  console.log(`[ADMIN UPDATE RANK] ${member.name} -> ${member.rank} (Lv.${member.rankLevel})`);
  res.json({ success: true, member });
});

// Admin: Add member
app.post('/api/admin/add-member', (req, res) => {
  const { adminPin, name, rankId, rank, role } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อสมาชิก' });
  }

  let matchedRank = gangRanks.find(r => r.id === rankId || r.name === rank || r.role === role);
  if (!matchedRank) {
    matchedRank = gangRanks.find(r => r.id === 'member') || { name: 'สมาชิก', role: 'member', rankLevel: 1, isAdmin: false };
  }

  const newId = String(Date.now());
  const newMember = {
    id: newId,
    name: name.trim(),
    rank: matchedRank.name,
    role: matchedRank.role || matchedRank.id,
    isAdmin: Boolean(matchedRank.isAdmin),
    rankLevel: matchedRank.rankLevel || 1
  };

  gangMembers.push(newMember);
  if (typeof saveData === 'function') saveData();
  io.emit('members_update', gangMembers);
  console.log(`[ADMIN ADD MEMBER] ${newMember.name} (${newMember.rank})`);
  res.json({ success: true, member: newMember });
});

// Admin: Remove member
app.post('/api/admin/remove-member', (req, res) => {
  const { adminPin, memberId } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }

  const idx = gangMembers.findIndex(m => m.id === memberId);
  if (idx !== -1) {
    const removed = gangMembers.splice(idx, 1)[0];
    activeCheckIns.delete(memberId);
    if (typeof saveData === 'function') saveData();
    io.emit('members_update', gangMembers);
    io.emit('checkin_update', { type: 'CHECKOUT', userId: memberId, userName: removed.name });
    console.log(`[ADMIN REMOVE MEMBER] ${removed.name}`);
  }
  res.json({ success: true });
});

// GET all shops with current occupants
app.get('/api/shops', (req, res) => {
  const shopsWithOccupants = shops.map(shop => {
    const occupants = [];
    activeCheckIns.forEach((checkin, userId) => {
      if (checkin.shopId === shop.id) {
        occupants.push({
          userId,
          userName: checkin.userName,
          avatar: checkin.avatar,
          checkinTime: checkin.checkinTime
        });
      }
    });
    return { ...shop, occupants };
  });
  res.json(shopsWithOccupants);
});

// GET all active check-ins
app.get('/api/checkins', (req, res) => {
  const checkins = [];
  activeCheckIns.forEach((checkin, userId) => {
    checkins.push({ userId, ...checkin });
  });
  res.json(checkins);
});

// GET gang members
app.get('/api/members', (req, res) => {
  const membersWithStatus = gangMembers.map(member => {
    let currentCheckin = null;
    activeCheckIns.forEach((checkin, userId) => {
      if (userId === member.id) currentCheckin = checkin;
    });
    return { ...member, currentCheckin };
  });
  res.json(membersWithStatus);
});

// GET stats
app.get('/api/stats', (req, res) => {
  res.json({
    totalMembers: gangMembers.length,
    activeNow: activeCheckIns.size,
    totalShops: shops.length,
    gangName: 'EVISU',
  });
});

// POST check-in (called by bot)
app.post('/api/checkin', (req, res) => {
  const { userId, userName, avatar, shopId } = req.body;
  if (!userId || !shopId) return res.status(400).json({ error: 'Missing fields' });

  const shop = shops.find(s => s.id === shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  activeCheckIns.set(userId, {
    shopId,
    shopName: shop.name,
    shopEmoji: shop.emoji,
    userName,
    avatar,
    checkinTime: new Date().toISOString()
  });

  const event = {
    type: 'CHECKIN',
    userId,
    userName,
    avatar,
    shop,
    checkinTime: new Date().toISOString()
  };

  io.emit('checkin_update', event);
  console.log(`[CHECK-IN] ${userName} → ${shop.emoji} ${shop.name}`);

  // Notify Discord channel
  try {
    const { sendCheckinNotification } = require('../bot/bot');
    const occupants = [];
    activeCheckIns.forEach((c) => {
      if (c.shopId === shop.id) occupants.push(c);
    });
    sendCheckinNotification(userName, shop, occupants, avatar);
  } catch (err) {
    console.error('Discord notify error:', err.message);
  }

  res.json({ success: true, shop });
});

// POST check-out (called by bot or web)
app.post('/api/checkout', (req, res) => {
  const { userId, userName } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const prev = activeCheckIns.get(userId);
  if (prev) {
    activeCheckIns.delete(userId);
    const event = { type: 'CHECKOUT', userId, userName, prevShop: prev };
    io.emit('checkin_update', event);
    console.log(`[CHECK-OUT] ${userName} ← ${prev.shopEmoji} ${prev.shopName}`);

    // Notify Discord channel
    try {
      const { sendCheckoutNotification } = require('../bot/bot');
      sendCheckoutNotification(userName || prev.userName, prev.shopName, prev.shopEmoji);
    } catch (err) {
      console.error('Discord checkout notify error:', err.message);
    }
  }

  res.json({ success: true });
});

// ── Socket.io ────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Send current state on connect
  const currentState = [];
  activeCheckIns.forEach((checkin, userId) => {
    currentState.push({ userId, ...checkin });
  });
  socket.emit('initial_state', { checkins: currentState, shops, gangMembers, ranks: gangRanks });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── Start Server ─────────────────────────────
function startServer() {
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`  ✅ Web Server running at http://localhost:${PORT}`);
  });
}

module.exports.startServer = startServer;
