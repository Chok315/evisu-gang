// ============================================
// EVISU Gang - Express Server + Socket.io
// ============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  activeCheckIns,
  gangMembers,
  gangRanks,
  shops,
  ADMIN_PASSWORD,
  discordConfig,
  deliveryLogs,
  treasuryLogs,
  leaveLogs,
  saveData
} = require('../data/store');

const {
  sendDiscordNotification,
  buildDeliveryEmbed,
  buildTreasuryEmbed,
  buildLeaveEmbed,
  buildTestEmbed
} = require('./discordService');
const path = require('path');

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

// ── Gang Systems API (ส่งของแก๊ง / เงินแก๊ง / ห้องลา) ───────

// GET Gang Systems Data
app.get('/api/gang-systems/data', (req, res) => {
  res.json({
    discordConfig: {
      delivery: {
        hasWebhook: Boolean(discordConfig.delivery?.webhookUrl),
        channelId: discordConfig.delivery?.channelId || '',
        webhookUrl: discordConfig.delivery?.webhookUrl ? discordConfig.delivery.webhookUrl.replace(/(webhooks\/\d+\/)(.{4}).+(.{4})$/, '$1$2****$3') : ''
      },
      treasury: {
        hasWebhook: Boolean(discordConfig.treasury?.webhookUrl),
        channelId: discordConfig.treasury?.channelId || '',
        webhookUrl: discordConfig.treasury?.webhookUrl ? discordConfig.treasury.webhookUrl.replace(/(webhooks\/\d+\/)(.{4}).+(.{4})$/, '$1$2****$3') : ''
      },
      leave: {
        hasWebhook: Boolean(discordConfig.leave?.webhookUrl),
        channelId: discordConfig.leave?.channelId || '',
        webhookUrl: discordConfig.leave?.webhookUrl ? discordConfig.leave.webhookUrl.replace(/(webhooks\/\d+\/)(.{4}).+(.{4})$/, '$1$2****$3') : ''
      }
    },
    deliveryLogs,
    treasuryLogs,
    leaveLogs
  });
});

// Admin: GET Full Discord Config (includes full webhook URLs)
app.post('/api/gang-systems/admin/get-config', (req, res) => {
  const { adminPin } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }
  res.json({ success: true, discordConfig });
});

// Admin: Save Discord Config
app.post('/api/gang-systems/config', (req, res) => {
  const { adminPin, config } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }
  if (!config) return res.status(400).json({ error: 'Missing config payload' });

  if (config.delivery) {
    discordConfig.delivery.webhookUrl = (config.delivery.webhookUrl || '').trim();
    discordConfig.delivery.channelId = (config.delivery.channelId || '').trim();
  }
  if (config.treasury) {
    discordConfig.treasury.webhookUrl = (config.treasury.webhookUrl || '').trim();
    discordConfig.treasury.channelId = (config.treasury.channelId || '').trim();
  }
  if (config.leave) {
    discordConfig.leave.webhookUrl = (config.leave.webhookUrl || '').trim();
    discordConfig.leave.channelId = (config.leave.channelId || '').trim();
  }

  saveData();
  io.emit('discord_config_update', discordConfig);
  console.log('[ADMIN DISCORD CONFIG UPDATED]');
  res.json({ success: true, discordConfig });
});

// Admin: Test Discord Webhook / Channel ID
app.post('/api/gang-systems/test-discord', async (req, res) => {
  const { adminPin, systemKey, webhookUrl, channelId, testerName } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }

  const targetWebhook = (webhookUrl !== undefined && webhookUrl !== '') ? webhookUrl : discordConfig[systemKey]?.webhookUrl;
  const targetChannel = (channelId !== undefined && channelId !== '') ? channelId : discordConfig[systemKey]?.channelId;

  const titles = {
    delivery: 'ระบบส่งของแก๊ง (DELIVERY)',
    treasury: 'ระบบเงินแก๊ง (TREASURY)',
    leave: 'ระบบห้องลา (LEAVE ROOM)'
  };

  const embed = buildTestEmbed({
    systemName: titles[systemKey] || systemKey,
    testerName: testerName || 'EVISU Admin'
  });

  const result = await sendDiscordNotification({
    webhookUrl: targetWebhook,
    channelId: targetChannel,
    embedPayload: embed
  });

  res.json(result);
});

// POST Delivery (ระบบส่งของแก๊ง)
app.post('/api/gang-systems/delivery', async (req, res) => {
  const { senderName, itemName, amount, location, imageUrl, note, customWebhook, customChannelId } = req.body;
  if (!senderName || !senderName.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ส่ง' });
  }
  if (!itemName || !itemName.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุรายการของหรือไอเทม' });
  }
  if (!amount || !String(amount).trim()) {
    return res.status(400).json({ error: 'กรุณาระบุจำนวนของที่ส่ง' });
  }

  const newLog = {
    id: 'del_' + Date.now(),
    date: new Date().toISOString(),
    senderName: senderName.trim(),
    itemName: itemName.trim(),
    amount: String(amount).trim(),
    location: (location || 'ตู้แก๊งใหญ่').trim(),
    imageUrl: (imageUrl || '').trim(),
    note: (note || '').trim()
  };

  deliveryLogs.unshift(newLog);
  if (deliveryLogs.length > 200) deliveryLogs.pop();
  saveData();

  // Send to Discord
  const targetWebhook = (customWebhook || '').trim() || discordConfig.delivery?.webhookUrl;
  const targetChannel = (customChannelId || '').trim() || discordConfig.delivery?.channelId;

  const embed = buildDeliveryEmbed(newLog);
  const discordResult = await sendDiscordNotification({
    webhookUrl: targetWebhook,
    channelId: targetChannel,
    embedPayload: embed
  });

  io.emit('delivery_new', newLog);
  console.log(`[DELIVERY] ${newLog.senderName} ส่ง ${newLog.itemName} (${newLog.amount}) - Discord: ${discordResult.success ? 'OK' : discordResult.error}`);

  res.json({
    success: true,
    log: newLog,
    discordResult,
    embedPayload: embed,
    targetWebhook
  });
});

// POST Treasury (ระบบเงินแก๊ง - ฝาก/เบิก)
app.post('/api/gang-systems/treasury', async (req, res) => {
  const { type, userName, amount, purpose, imageUrl, note, customWebhook, customChannelId } = req.body;
  if (!type || (type !== 'deposit' && type !== 'withdraw')) {
    return res.status(400).json({ error: 'กรุณาระบุประเภทรายการ (deposit หรือ withdraw)' });
  }
  if (!userName || !userName.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ทำรายการ' });
  }
  const cleanAmount = Number(String(amount).replace(/[^0-9.-]+/g, ''));
  if (isNaN(cleanAmount) || cleanAmount <= 0) {
    return res.status(400).json({ error: 'กรุณาระบุจำนวนเงินที่ถูกต้อง (มากกว่า 0)' });
  }

  // Calculate total balance from all logs
  let totalBalance = cleanAmount * (type === 'deposit' ? 1 : -1);
  treasuryLogs.forEach(l => {
    const a = Number(String(l.amount).replace(/[^0-9.-]+/g, '')) || 0;
    if (l.type === 'deposit') totalBalance += a;
    else if (l.type === 'withdraw') totalBalance -= a;
  });

  const newLog = {
    id: 'tr_' + Date.now(),
    date: new Date().toISOString(),
    type,
    userName: userName.trim(),
    amount: cleanAmount,
    purpose: (purpose || (type === 'deposit' ? 'ฝากเงินเข้าแก๊ง' : 'เบิกเงินกองกลางแก๊ง')).trim(),
    imageUrl: (imageUrl || '').trim(),
    note: (note || '').trim()
  };

  treasuryLogs.unshift(newLog);
  if (treasuryLogs.length > 200) treasuryLogs.pop();
  saveData();

  // Send to Discord
  const targetWebhook = (customWebhook || '').trim() || discordConfig.treasury?.webhookUrl;
  const targetChannel = (customChannelId || '').trim() || discordConfig.treasury?.channelId;

  const embed = buildTreasuryEmbed({
    ...newLog,
    currentTotal: totalBalance
  });

  const discordResult = await sendDiscordNotification({
    webhookUrl: targetWebhook,
    channelId: targetChannel,
    embedPayload: embed
  });

  io.emit('treasury_new', newLog);
  console.log(`[TREASURY] ${newLog.type.toUpperCase()} by ${newLog.userName} ($${newLog.amount}) - Discord: ${discordResult.success ? 'OK' : discordResult.error}`);

  res.json({
    success: true,
    log: newLog,
    totalBalance,
    discordResult,
    embedPayload: embed,
    targetWebhook
  });
});

// POST Leave (ระบบห้องลา)
app.post('/api/gang-systems/leave', async (req, res) => {
  const { memberName, leaveType, startDate, endDate, reason, contact, customWebhook, customChannelId } = req.body;
  if (!memberName || !memberName.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ขอลา' });
  }
  if (!leaveType || !leaveType.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุประเภทการลา' });
  }
  if (!startDate || !startDate.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุวันที่เริ่มลา' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุเหตุผลการลา' });
  }

  const newLog = {
    id: 'lv_' + Date.now(),
    date: new Date().toISOString(),
    memberName: memberName.trim(),
    leaveType: leaveType.trim(),
    startDate: startDate.trim(),
    endDate: (endDate || 'ยังไม่กำหนด').trim(),
    reason: reason.trim(),
    contact: (contact || '').trim()
  };

  leaveLogs.unshift(newLog);
  if (leaveLogs.length > 200) leaveLogs.pop();
  saveData();

  // Send to Discord
  const targetWebhook = (customWebhook || '').trim() || discordConfig.leave?.webhookUrl;
  const targetChannel = (customChannelId || '').trim() || discordConfig.leave?.channelId;

  const embed = buildLeaveEmbed(newLog);
  const discordResult = await sendDiscordNotification({
    webhookUrl: targetWebhook,
    channelId: targetChannel,
    embedPayload: embed
  });

  io.emit('leave_new', newLog);
  console.log(`[LEAVE] ${newLog.memberName} (${newLog.leaveType}: ${newLog.startDate} - ${newLog.endDate}) - Discord: ${discordResult.success ? 'OK' : discordResult.error}`);

  res.json({
    success: true,
    log: newLog,
    discordResult,
    embedPayload: embed,
    targetWebhook
  });
});

// Admin: Clear Logs
app.post('/api/gang-systems/admin/clear-logs', (req, res) => {
  const { adminPin, systemKey } = req.body;
  if (adminPin !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }

  if (systemKey === 'delivery') deliveryLogs.length = 0;
  else if (systemKey === 'treasury') treasuryLogs.length = 0;
  else if (systemKey === 'leave') leaveLogs.length = 0;
  else if (systemKey === 'all') {
    deliveryLogs.length = 0;
    treasuryLogs.length = 0;
    leaveLogs.length = 0;
  }

  saveData();
  io.emit('logs_cleared', { systemKey });
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
  socket.emit('initial_state', {
    checkins: currentState,
    shops,
    gangMembers,
    ranks: gangRanks,
    deliveryLogs: deliveryLogs.slice(0, 50),
    treasuryLogs: treasuryLogs.slice(0, 50),
    leaveLogs: leaveLogs.slice(0, 50),
    discordConfig: {
      delivery: {
        hasWebhook: Boolean(discordConfig.delivery?.webhookUrl),
        channelId: discordConfig.delivery?.channelId || ''
      },
      treasury: {
        hasWebhook: Boolean(discordConfig.treasury?.webhookUrl),
        channelId: discordConfig.treasury?.channelId || ''
      },
      leave: {
        hasWebhook: Boolean(discordConfig.leave?.webhookUrl),
        channelId: discordConfig.leave?.channelId || ''
      }
    }
  });

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
