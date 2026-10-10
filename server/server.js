// ============================================
// EVISU Gang - Express Server + Socket.io
// ============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { activeCheckIns, gangMembers, shops } = require('../data/store');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Export io so bot can use it
module.exports.io = io;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Health check ────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/ping', (req, res) => res.send('pong'));

// ── API Routes ──────────────────────────────

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
  res.json({ success: true, shop });
});

// POST check-out (called by bot)
app.post('/api/checkout', (req, res) => {
  const { userId, userName } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const prev = activeCheckIns.get(userId);
  if (prev) {
    activeCheckIns.delete(userId);
    const event = { type: 'CHECKOUT', userId, userName, prevShop: prev };
    io.emit('checkin_update', event);
    console.log(`[CHECK-OUT] ${userName} ← ${prev.shopEmoji} ${prev.shopName}`);
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
