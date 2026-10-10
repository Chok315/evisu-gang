require('dotenv').config();
const { startServer } = require('./server/server');
const { startBot } = require('./bot/bot');

console.log('');
console.log('███████╗██╗   ██╗██╗███████╗██╗   ██╗');
console.log('██╔════╝██║   ██║██║██╔════╝██║   ██║');
console.log('█████╗  ██║   ██║██║███████╗██║   ██║');
console.log('██╔══╝  ╚██╗ ██╔╝██║╚════██║██║   ██║');
console.log('███████╗ ╚████╔╝ ██║███████║╚██████╔╝');
console.log('╚══════╝  ╚═══╝  ╚═╝╚══════╝ ╚═════╝ ');
console.log('');
console.log('  🔫 EVISU Gang FiveM Management System');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Start Express server
startServer();

// Start Discord bot
startBot();
