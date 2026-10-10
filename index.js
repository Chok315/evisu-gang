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

// Start Discord bot (if configured)
if (process.env.DISCORD_TOKEN) {
  startBot().catch(err => {
    console.log('  ⚠️ Discord bot disabled:', err.message);
  });
} else {
  console.log('  ℹ️ Discord bot skipped (no DISCORD_TOKEN)');
}
