// ============================================
// EVISU Gang - Shared Data Store
// ============================================
const fs = require('fs');
const path = require('path');

// Active check-ins: { userId: { shopId, shopName, userName, avatar, checkinTime } }
const activeCheckIns = new Map();

// Admin settings
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'evisu888';

// Default Ranks
const defaultRanks = [
  { id: 'leader', name: 'หัวแก๊ง', role: 'leader', rankLevel: 5, isAdmin: true, color: '#c9a84c', isSystem: true },
  { id: 'vice_leader', name: 'รองหัวแก๊ง', role: 'vice_leader', rankLevel: 4, isAdmin: true, color: '#cc0000', isSystem: true },
  { id: 'senior', name: 'รุ่นใหญ่', role: 'senior', rankLevel: 3, isAdmin: false, color: '#e67e22', isSystem: false },
  { id: 'member', name: 'สมาชิก', role: 'member', rankLevel: 1, isAdmin: false, color: '#95a5a6', isSystem: true },
];

// Default Official Members list (18 คน)
const defaultMembers = [
  { id: '1', name: 'Pup ha Stikez', rank: 'หัวแก๊ง', role: 'leader', isAdmin: true, rankLevel: 5 },
  { id: '2', name: 'Aya Stikez', rank: 'รองหัวแก๊ง', role: 'vice_leader', isAdmin: true, rankLevel: 4 },
  { id: '3', name: 'God Yarkhutsuththar', rank: 'รองหัวแก๊ง', role: 'vice_leader', isAdmin: true, rankLevel: 4 },
  { id: '4', name: 'Ahlong Silk', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '5', name: 'Bank Kamo', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '6', name: 'Bell Wonderboy', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '7', name: 'Bew Bank', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '8', name: 'Chay Kurozaki', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '9', name: 'Chok Valentine', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '10', name: 'Fresh Shy', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '11', name: 'Gee Skoke', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '12', name: 'Joseph Smith', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '13', name: 'Lee Genz', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '14', name: 'Minato Yuito', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '15', name: 'Patt Krapao', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '16', name: 'Pink Aurora', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '17', name: 'Redroc Stikez', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
  { id: '18', name: 'Zen Mosa', rank: 'สมาชิก', role: 'member', isAdmin: false, rankLevel: 1 },
];

const DATA_FILE = path.join(__dirname, 'gang_data.json');

let gangMembers = [...defaultMembers];
let gangRanks = [...defaultRanks];
let discordConfig = {
  delivery: {
    webhookUrl: process.env.DISCORD_DELIVERY_WEBHOOK || '',
    channelId: process.env.DISCORD_DELIVERY_CHANNEL_ID || ''
  },
  treasury: {
    webhookUrl: process.env.DISCORD_TREASURY_WEBHOOK || '',
    channelId: process.env.DISCORD_TREASURY_CHANNEL_ID || ''
  },
  leave: {
    webhookUrl: process.env.DISCORD_LEAVE_WEBHOOK || '',
    channelId: process.env.DISCORD_LEAVE_CHANNEL_ID || ''
  }
};
let deliveryLogs = [];
let treasuryLogs = [];
let leaveLogs = [];

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.members) && parsed.members.length > 0) {
        gangMembers = parsed.members;
      }
      if (Array.isArray(parsed.ranks) && parsed.ranks.length > 0) {
        gangRanks = parsed.ranks;
      }
      if (parsed.discordConfig && typeof parsed.discordConfig === 'object') {
        discordConfig = {
          delivery: {
            webhookUrl: parsed.discordConfig.delivery?.webhookUrl || process.env.DISCORD_DELIVERY_WEBHOOK || '',
            channelId: parsed.discordConfig.delivery?.channelId || process.env.DISCORD_DELIVERY_CHANNEL_ID || ''
          },
          treasury: {
            webhookUrl: parsed.discordConfig.treasury?.webhookUrl || process.env.DISCORD_TREASURY_WEBHOOK || '',
            channelId: parsed.discordConfig.treasury?.channelId || process.env.DISCORD_TREASURY_CHANNEL_ID || ''
          },
          leave: {
            webhookUrl: parsed.discordConfig.leave?.webhookUrl || process.env.DISCORD_LEAVE_WEBHOOK || '',
            channelId: parsed.discordConfig.leave?.channelId || process.env.DISCORD_LEAVE_CHANNEL_ID || ''
          }
        };
      }
      if (Array.isArray(parsed.deliveryLogs)) deliveryLogs = parsed.deliveryLogs;
      if (Array.isArray(parsed.treasuryLogs)) treasuryLogs = parsed.treasuryLogs;
      if (Array.isArray(parsed.leaveLogs)) leaveLogs = parsed.leaveLogs;
    } else {
      saveData();
    }
  } catch (err) {
    console.error('Error loading gang_data.json:', err.message);
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          members: gangMembers,
          ranks: gangRanks,
          discordConfig,
          deliveryLogs,
          treasuryLogs,
          leaveLogs
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (err) {
    console.error('Error saving gang_data.json:', err.message);
  }
}

// Initial load
loadData();

// Shop definitions - เฉพาะ 8 ร้านตามที่กำหนด
const shops = [
  { id: 'mission_row', name: 'MISSION ROW', emoji: '1', zone: 'Mission Row', color: '#c0392b' },
  { id: 'vinewood', name: 'VINEWOOD', emoji: '2', zone: 'Vinewood', color: '#f39c12' },
  { id: 'grove_street', name: 'GROVE STREET', emoji: '3', zone: 'Grove Street', color: '#27ae60' },
  { id: 'el_rancho', name: 'EL RANCHO', emoji: '4', zone: 'El Rancho', color: '#e67e22' },
  { id: 'little_seoul', name: 'LITTLE SEOUL', emoji: '5', zone: 'Little Seoul', color: '#9b59b6' },
  { id: 'vespucci', name: 'VESPUCCI', emoji: '6', zone: 'Vespucci', color: '#3498db' },
  { id: 'pacific_bluffs', name: 'PACIFIC BLUFFS', emoji: '7', zone: 'Pacific Bluffs', color: '#1abc9c' },
  { id: 'gang_new', name: 'GANG NEW', emoji: '8', zone: 'Gang Area', color: '#e74c3c' },
];

module.exports = {
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
};

