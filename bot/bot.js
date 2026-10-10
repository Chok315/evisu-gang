// ============================================
// EVISU Gang - Discord Bot v2
// Tick-based Check-in | No time display
// ============================================
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, Events, ActivityType
} = require('discord.js');

const fetch = require('node-fetch');
const { shops } = require('../data/store');

const API_URL = `http://localhost:${process.env.PORT || 3000}`;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ]
});

// ── Slash Commands ─────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('checkin')
    .setDescription('🏪 Check-in ที่ร้านในเกม — เลือกร้านที่คุณอยู่'),
  new SlashCommandBuilder()
    .setName('checkout')
    .setDescription('🚪 ออกจากร้านที่กำลัง Check-in อยู่'),
  new SlashCommandBuilder()
    .setName('whoswhere')
    .setDescription('👀 ดูว่าใครอยู่ที่ร้านไหนตอนนี้'),
].map(c => c.toJSON());

// ── Register Commands ──────────────────────────
async function registerCommands() {
  if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('  ⚠️  Discord Token ยังไม่ได้ตั้งค่า - Bot จะไม่เริ่มทำงาน');
    console.log('  📝 แก้ไขไฟล์ .env แล้วใส่ DISCORD_TOKEN, CLIENT_ID, GUILD_ID, CHANNEL_ID');
    return false;
  }
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log('  ✅ Slash commands registered');
    return true;
  } catch (err) {
    console.error('  ❌ Register commands failed:', err.message);
    return false;
  }
}

// ── Build Shop Select Menu ─────────────────────
function buildShopMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('shop_select')
      .setPlaceholder('🏪 เลือกร้านที่คุณอยู่...')
      .addOptions(
        shops.map(s => ({
          label: `${s.emoji} ${s.name}`,
          description: `📍 ${s.zone}`,
          value: s.id,
        }))
      )
  );
}

// ── Notification Embed (Check-in) ─────────────
// แสดงเฉพาะว่าใครอยู่ที่ไหน ไม่มีเวลา
function buildCheckinEmbed(user, shop, currentOccupants) {
  const memberList = currentOccupants.length > 0
    ? currentOccupants.map(o => `> 👤 **${o.userName}**`).join('\n')
    : '> 👤 *(ยังไม่มีข้อมูลสมาชิกคนอื่น)*';

  return new EmbedBuilder()
    .setColor(0xcc0000)
    .setAuthor({
      name: 'EVISU Gang | CHECK-IN',
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setTitle(`${shop.emoji}  ${shop.name}`)
    .setDescription(`**${user.displayName || user.username}** กำลังอยู่ที่ **${shop.name}** แล้ว!`)
    .addFields(
      { name: '📍 สถานที่', value: shop.name, inline: true },
      { name: '🗺️ โซน',   value: shop.zone, inline: true },
      { name: `👥 คนที่อยู่ใน ${shop.name} ตอนนี้`, value: memberList }
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'EVISU Gang • FiveM Roleplay' })
    .setTimestamp();
}

// Check-out Embed
function buildCheckoutEmbed(user, shopName, shopEmoji) {
  return new EmbedBuilder()
    .setColor(0x333333)
    .setAuthor({
      name: 'EVISU Gang | CHECK-OUT',
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(`**${user.displayName || user.username}** ออกจาก **${shopEmoji} ${shopName}** แล้ว`)
    .setFooter({ text: 'EVISU Gang • FiveM Roleplay' })
    .setTimestamp();
}

// Who's Where Embed (no time)
function buildWhosWhereEmbed(checkins) {
  const embed = new EmbedBuilder()
    .setColor(0xcc0000)
    .setTitle('👀  EVISU | WHO\'S WHERE')
    .setFooter({ text: 'EVISU Gang • FiveM Roleplay' })
    .setTimestamp();

  if (checkins.length === 0) {
    return embed.setDescription('😴 ยังไม่มีสมาชิกที่กำลัง Check-in อยู่');
  }

  // Group by shop
  const byShop = {};
  checkins.forEach(c => {
    const key = c.shopName;
    if (!byShop[key]) byShop[key] = { emoji: c.shopEmoji || '🏪', members: [] };
    byShop[key].members.push(c.userName);
  });

  embed.setDescription(`มีสมาชิก **${checkins.length} คน** กำลังออนไลน์อยู่`);

  Object.entries(byShop).forEach(([shopName, data]) => {
    embed.addFields({
      name: `${data.emoji}  ${shopName}`,
      value: data.members.map(n => `👤 ${n}`).join('\n'),
      inline: true
    });
  });

  return embed;
}

// ── Event Handlers ─────────────────────────────
client.once(Events.ClientReady, c => {
  console.log(`  ✅ Discord Bot: ${c.user.tag}`);
  c.user.setActivity('EVISU Gang | /checkin', { type: ActivityType.Watching });
});

client.on(Events.InteractionCreate, async interaction => {

  // /checkin → เปิดเมนูเลือกร้าน
  if (interaction.isChatInputCommand() && interaction.commandName === 'checkin') {
    await interaction.reply({
      content: '## 🏪 เลือกร้านที่คุณกำลังอยู่ใน FiveM',
      components: [buildShopMenu()],
      ephemeral: true
    });
    return;
  }

  // /checkout
  if (interaction.isChatInputCommand() && interaction.commandName === 'checkout') {
    try {
      const res = await fetch(`${API_URL}/api/checkins`);
      const all = await res.json();
      const my  = all.find(c => c.userId === interaction.user.id);

      if (!my) {
        await interaction.reply({ content: '❌ คุณยังไม่ได้ Check-in ที่ไหนเลย!', ephemeral: true });
        return;
      }

      await fetch(`${API_URL}/api/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: interaction.user.id, userName: interaction.user.username })
      });

      const embed = buildCheckoutEmbed(interaction.user, my.shopName, my.shopEmoji || '🏪');
      const ch = interaction.guild.channels.cache.get(process.env.DISCORD_CHECKIN_CHANNEL_ID);
      if (ch) await ch.send({ embeds: [embed] });

      await interaction.reply({ content: `✅ Check-out จาก **${my.shopName}** เรียบร้อย!`, ephemeral: true });
    } catch(e) {
      console.error(e);
      await interaction.reply({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true });
    }
    return;
  }

  // /whoswhere
  if (interaction.isChatInputCommand() && interaction.commandName === 'whoswhere') {
    try {
      const res = await fetch(`${API_URL}/api/checkins`);
      const all = await res.json();
      await interaction.reply({ embeds: [buildWhosWhereEmbed(all)] });
    } catch(e) {
      await interaction.reply({ content: '❌ ดึงข้อมูลไม่ได้', ephemeral: true });
    }
    return;
  }

  // ── Select Menu: เลือกร้าน ─────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'shop_select') {
    const shopId = interaction.values[0];
    const shop   = shops.find(s => s.id === shopId);
    if (!shop) { await interaction.update({ content: '❌ ไม่พบร้านนี้', components: [] }); return; }

    try {
      // Call check-in API
      await fetch(`${API_URL}/api/checkin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId:   interaction.user.id,
          userName: interaction.user.displayName || interaction.user.username,
          avatar:   interaction.user.displayAvatarURL({ dynamic: true }),
          shopId:   shop.id
        })
      });

      // Fetch current occupants for this shop (after our check-in)
      const allRes = await fetch(`${API_URL}/api/checkins`);
      const allCheckins = await allRes.json();
      const occupants = allCheckins.filter(c => c.shopId === shop.id);

      // Send notification embed to channel
      const embed = buildCheckinEmbed(interaction.user, shop, occupants);
      const ch = interaction.guild.channels.cache.get(process.env.DISCORD_CHECKIN_CHANNEL_ID);
      if (ch) await ch.send({ embeds: [embed] });

      // Buttons for changing / checking out
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('change_shop')
          .setLabel('🔄 เปลี่ยนร้าน')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('do_checkout')
          .setLabel('🚪 Check-out')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.update({
        content: `✅ **Check-in สำเร็จ!**\nคุณอยู่ที่ ${shop.emoji} **${shop.name}** แล้ว\nมีคนอยู่ด้วยกัน **${occupants.length} คน**`,
        components: [row]
      });

    } catch(e) {
      console.error(e);
      await interaction.update({ content: '❌ เกิดข้อผิดพลาด ลองใหม่', components: [] });
    }
    return;
  }

  // ── Button: เปลี่ยนร้าน ────────────────────
  if (interaction.isButton() && interaction.customId === 'change_shop') {
    await interaction.update({
      content: '## 🔄 เลือกร้านใหม่',
      components: [buildShopMenu()]
    });
    return;
  }

  // ── Button: Check-out ──────────────────────
  if (interaction.isButton() && interaction.customId === 'do_checkout') {
    try {
      const res = await fetch(`${API_URL}/api/checkins`);
      const all = await res.json();
      const my  = all.find(c => c.userId === interaction.user.id);

      await fetch(`${API_URL}/api/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: interaction.user.id, userName: interaction.user.username })
      });

      if (my) {
        const embed = buildCheckoutEmbed(interaction.user, my.shopName, my.shopEmoji || '🏪');
        const ch = interaction.guild.channels.cache.get(process.env.DISCORD_CHECKIN_CHANNEL_ID);
        if (ch) await ch.send({ embeds: [embed] });
      }

      await interaction.update({ content: '🚪 Check-out เรียบร้อยแล้ว!', components: [] });
    } catch(e) {
      await interaction.update({ content: '❌ เกิดข้อผิดพลาด', components: [] });
    }
    return;
  }
});

// ── Start Bot ──────────────────────────────────
async function startBot() {
  const ok = await registerCommands();
  if (!ok) return;
  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch(e) {
    console.error('  ❌ Bot login failed:', e.message);
  }
}

module.exports = { startBot, client };
