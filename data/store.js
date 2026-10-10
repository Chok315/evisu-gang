// ============================================
// EVISU Gang - Shared Data Store (In-Memory)
// ============================================

// Active check-ins: { userId: { shopId, shopName, userName, avatar, checkinTime } }
const activeCheckIns = new Map();

// Members list
const gangMembers = [
  { id: '1', name: 'Boss EVISU', rank: 'Don', rankLevel: 5, avatar: null, status: 'online' },
  { id: '2', name: 'Capo RedWolf', rank: 'Capo', rankLevel: 4, avatar: null, status: 'online' },
  { id: '3', name: 'Soldier Ghost', rank: 'Soldier', rankLevel: 3, avatar: null, status: 'offline' },
  { id: '4', name: 'Associate Blade', rank: 'Associate', rankLevel: 2, avatar: null, status: 'online' },
];

// Shop definitions - เฉพาะ 8 ร้านตามที่กำหนด
const shops = [
  { id: 'mission_row',    name: 'MISSION ROW',    emoji: '🏢', zone: 'Mission Row',    color: '#c0392b' },
  { id: 'vinewood',       name: 'VINEWOOD',       emoji: '🌟', zone: 'Vinewood',       color: '#f39c12' },
  { id: 'grove_street',   name: 'GROVE STREET',   emoji: '🌿', zone: 'Grove Street',   color: '#27ae60' },
  { id: 'el_rancho',      name: 'EL RANCHO',      emoji: '🏭', zone: 'El Rancho',      color: '#e67e22' },
  { id: 'little_seoul',   name: 'LITTLE SEOUL',   emoji: '🏮', zone: 'Little Seoul',   color: '#9b59b6' },
  { id: 'vespucci',       name: 'VESPUCCI',       emoji: '🏖️', zone: 'Vespucci',       color: '#3498db' },
  { id: 'pacific_bluffs', name: 'PACIFIC BLUFFS', emoji: '🌊', zone: 'Pacific Bluffs', color: '#1abc9c' },
  { id: 'gang_new',       name: 'GANG NEW',       emoji: '⚔️', zone: 'Gang Area',      color: '#e74c3c' },
];

module.exports = { activeCheckIns, gangMembers, shops };
