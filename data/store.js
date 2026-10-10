// ============================================
// EVISU Gang - Shared Data Store (In-Memory)
// ============================================

// Active check-ins: { userId: { shopId, shopName, userName, avatar, checkinTime } }
const activeCheckIns = new Map();

// Admin settings
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'evisu888';

// Official Members list (18 คน)
const gangMembers = [
  { id: '1',  name: 'Pup ha Stikez',       rank: 'หัวแก๊ง',     role: 'leader',      isAdmin: true,  rankLevel: 5 },
  { id: '2',  name: 'Aya Stikez',          rank: 'รองหัวแก๊ง',  role: 'vice_leader', isAdmin: true,  rankLevel: 4 },
  { id: '3',  name: 'God Yarkhutsuththar', rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '4',  name: 'Ahlong Silk',         rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '5',  name: 'Bank Kamo',           rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '6',  name: 'Bell Wonderboy',      rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '7',  name: 'Bew Bank',            rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '8',  name: 'Chay Kurozaki',       rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '9',  name: 'Chok Valentine',      rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '10', name: 'Fresh Shy',           rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '11', name: 'Gee Skoke',           rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '12', name: 'Joseph Smith',        rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '13', name: 'Lee Genz',            rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '14', name: 'Minato Yuito',        rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '15', name: 'Patt Krapao',         rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '16', name: 'Pink Aurora',         rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '17', name: 'Redroc Stikez',       rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
  { id: '18', name: 'Zen Mosa',            rank: 'สมาชิก',     role: 'member',      isAdmin: false, rankLevel: 1 },
];

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

module.exports = { activeCheckIns, gangMembers, shops, ADMIN_PASSWORD };
