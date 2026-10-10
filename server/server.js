// ============================================
// EVISU Gang - Express Server + Socket.io
// ============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { activeCheckIns, gangMembers, shops, ADMIN_PASSWORD } = require('../data/store');

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

  // If Admin (หัวแก๊ง / รองหัวแก๊ง), requires PIN
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
      isAdmin: Boolean(member.isAdmin)
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

// Admin: Add member
app.post('/api/admin/add-member', (req, res) => {
  const { adminPin, name, rank, role } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อสมาชิก' });
  }

  const newId = String(Date.now());
  const isAdm = role === 'leader' || role === 'vice_leader';
  const newMember = {
    id: newId,
    name: name.trim(),
    rank: rank || (isAdm ? (role === 'leader' ? 'หัวแก๊ง' : 'รองหัวแก๊ง') : 'สมาชิก'),
    role: role || 'member',
    isAdmin: isAdm,
    rankLevel: role === 'leader' ? 5 : (role === 'vice_leader' ? 4 : 1)
  };

  gangMembers.push(newMember);
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
  socket.emit('initial_state', { checkins: currentState, shops, gangMembers });

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
