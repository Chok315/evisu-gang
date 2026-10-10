// ============================================
// EVISU Gang - Shared Data Store (In-Memory)
// ============================================

// Active check-ins: { userId: { shopId, shopName, userName, avatar, checkinTime } }
const activeCheckIns = new Map();

// Members list (can be expanded)
const gangMembers = [
  { id: '1', name: 'Boss EVISU', rank: 'Don', rankLevel: 5, avatar: null, status: 'online' },
  { id: '2', name: 'Capo RedWolf', rank: 'Capo', rankLevel: 4, avatar: null, status: 'online' },
  { id: '3', name: 'Soldier Ghost', rank: 'Soldier', rankLevel: 3, avatar: null, status: 'offline' },
  { id: '4', name: 'Associate Blade', rank: 'Associate', rankLevel: 2, avatar: null, status: 'online' },
];

// Shop definitions
const shops = [
  { id: 'supermarket_1', name: '24/7 Supermarket', emoji: '🏪', zone: 'Downtown', color: '#ff6b35' },
  { id: 'ammu_nation', name: 'Ammu-Nation', emoji: '🔫', zone: 'Vinewood', color: '#c0392b' },
  { id: 'hospital', name: 'Hospital', emoji: '🏥', zone: 'Pillbox Hill', color: '#3498db' },
  { id: 'mechanic', name: 'Mechanic Shop', emoji: '🔧', zone: 'La Mesa', color: '#f39c12' },
  { id: 'drug_lab', name: 'Drug Lab', emoji: '💊', zone: 'Sandy Shores', color: '#8e44ad' },
  { id: 'burger_shot', name: 'Burger Shot', emoji: '🍔', zone: 'Strawberry', color: '#e74c3c' },
  { id: 'gas_station', name: 'Gas Station', emoji: '⛽', zone: 'Various', color: '#f1c40f' },
  { id: 'barber', name: 'Barber Shop', emoji: '💈', zone: 'Mirror Park', color: '#1abc9c' },
  { id: 'clothing', name: 'Clothing Store', emoji: '👗', zone: 'Rockford Hills', color: '#e91e63' },
  { id: 'bank', name: 'Fleeca Bank', emoji: '🏦', zone: 'Vinewood Blvd', color: '#2ecc71' },
  { id: 'car_dealer', name: 'Premium Deluxe', emoji: '🚗', zone: 'Legion Square', color: '#3498db' },
  { id: 'pizza', name: 'Pizza This', emoji: '🍕', zone: 'Little Seoul', color: '#ff5722' },
  { id: 'jewellery', name: 'Jewellery Store', emoji: '💎', zone: 'Rockford Hills', color: '#9b59b6' },
  { id: 'strip_club', name: 'Vanilla Unicorn', emoji: '🎭', zone: 'Strawberry', color: '#ff4081' },
  { id: 'port', name: 'LSIA Port', emoji: '⚓', zone: 'Port', color: '#607d8b' },
];

module.exports = { activeCheckIns, gangMembers, shops };
