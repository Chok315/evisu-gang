// ============================================
// EVISU Gang - Discord Webhook & Bot Service
// Handles rich Discord Embed formatting and posting
// via Webhook URL and/or Discord Channel ID
// ============================================

const { EmbedBuilder } = require('discord.js');

// Gang theme colors
const COLORS = {
  DELIVERY: 0x2ecc71,  // Emerald green for items/supplies
  DEPOSIT:  0xf1c40f,  // Gold for money deposit
  WITHDRAW: 0xe74c3c,  // Crimson red for money withdraw
  LEAVE:    0x3498db,  // Ice blue for leave notice
  SYSTEM:   0xc9a84c,  // EVISU Gold
  ERROR:    0xff3333   // Alert red
};

const LOGO_URL = 'https://raw.githubusercontent.com/Chok315/evisu-gang/main/public/img/evisu_logo.png';

/**
 * Format currency with commas
 */
function formatMoney(val) {
  const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  return '$' + num.toLocaleString('en-US');
}

/**
 * Convert JSON embed format to Discord.js EmbedBuilder instance
 */
function toEmbedBuilder(embedJson) {
  const embed = new EmbedBuilder();
  if (embedJson.title) embed.setTitle(embedJson.title);
  if (embedJson.description) embed.setDescription(embedJson.description);
  if (embedJson.color !== undefined) embed.setColor(embedJson.color);
  if (embedJson.author) embed.setAuthor(embedJson.author);
  if (embedJson.thumbnail?.url) embed.setThumbnail(embedJson.thumbnail.url);
  if (embedJson.image?.url) embed.setImage(embedJson.image.url);
  if (embedJson.footer) embed.setFooter(embedJson.footer);
  if (embedJson.timestamp) embed.setTimestamp(new Date(embedJson.timestamp));
  if (Array.isArray(embedJson.fields)) {
    embed.addFields(embedJson.fields.map(f => ({
      name: String(f.name || '•'),
      value: String(f.value || '-'),
      inline: Boolean(f.inline)
    })));
  }
  return embed;
}

function sanitizeDiscordError(status, rawText) {
  if (!rawText) return `Webhook error (${status})`;
  if (rawText.includes('<!doctype') || rawText.includes('<html') || rawText.includes('Error 1015') || rawText.includes('rate limited')) {
    return `Discord Webhook ติด Cloudflare Rate Limit (Error 1015 บน Cloud Host) - ระบบพยายามส่งต่อแต่ Discord บล็อก IP ชั่วคราว`;
  }
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.message) return `Discord: ${parsed.message}`;
    return `Discord error (${status}): ${JSON.stringify(parsed)}`;
  } catch (e) {
    const clean = rawText.replace(/<[^>]*>?/gm, '').trim();
    const short = clean.length > 120 ? clean.slice(0, 120) + '...' : clean;
    return `Webhook error (${status}): ${short}`;
  }
}

/**
 * Main dispatcher: sends embed via Webhook and/or Bot Channel ID
 */
async function sendDiscordNotification({ webhookUrl, channelId, embedPayload, content = '', botClient = null }) {
  const cleanWebhook = (webhookUrl || '').trim();
  const cleanChannelId = (channelId || '').trim();

  let webhookSuccess = false;
  let botSuccess = false;
  const errors = [];

  // 1. Try sending via Webhook
  if (cleanWebhook && cleanWebhook.startsWith('http')) {
    const body = {
      username: 'EVISU GANG MANAGEMENT',
      avatar_url: LOGO_URL,
      content: content || undefined,
      embeds: [embedPayload]
    };

    try {
      let targetUrl = cleanWebhook;
      let res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok || res.status === 204) {
        webhookSuccess = true;
      } else {
        const text = await res.text().catch(() => '');

        // If rate limited or blocked by Cloudflare (Error 1015) on discord.com, auto-retry with Discord Proxy
        if (targetUrl.includes('discord.com/api/webhooks/') && (res.status === 429 || res.status === 403 || text.includes('1015') || text.includes('Cloudflare'))) {
          try {
            const proxyUrl = targetUrl.replace('discord.com/api/webhooks/', 'webhook.lewisakura.moe/api/webhooks/');
            const proxyRes = await fetch(proxyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });

            if (proxyRes.ok || proxyRes.status === 204) {
              webhookSuccess = true;
              return { success: true, method: 'webhook (proxy)', details: 'ส่งเข้า Discord ผ่าน Webhook Proxy สำเร็จ' };
            } else {
              const proxyText = await proxyRes.text().catch(() => '');
              errors.push(sanitizeDiscordError(proxyRes.status, proxyText));
            }
          } catch (proxyErr) {
            errors.push(`Webhook Proxy: ${proxyErr.message}`);
          }
        } else {
          errors.push(sanitizeDiscordError(res.status, text));
        }
      }
    } catch (err) {
      errors.push(`Webhook fetch failed: ${err.message}`);
    }
  }

  // 2. If webhook succeeded, return early
  if (webhookSuccess) {
    return { success: true, method: 'webhook', details: 'ส่งเข้า Discord ผ่าน Webhook สำเร็จ' };
  }

  // 3. Fallback / direct to Discord Bot channel ID
  if (cleanChannelId) {
    try {
      let client = botClient;
      if (!client) {
        try {
          const botModule = require('../bot/bot');
          client = botModule.client;
        } catch (e) {
          // ignore
        }
      }

      if (client && client.isReady && client.isReady()) {
        let channel = client.channels.cache.get(cleanChannelId);
        if (!channel) {
          channel = await client.channels.fetch(cleanChannelId).catch(() => null);
        }

        if (channel && typeof channel.send === 'function') {
          const discordEmbed = toEmbedBuilder(embedPayload);
          await channel.send({ content: content || undefined, embeds: [discordEmbed] });
          botSuccess = true;
          return { success: true, method: 'bot', details: 'ส่งเข้า Discord ผ่าน Bot เข้า Channel ID สำเร็จ' };
        } else {
          errors.push(`Bot ไม่พบห้องแชท ID: ${cleanChannelId} (ตรวจสอบสิทธิ์หรือ ID ห้อง)`);
        }
      } else {
        errors.push('Discord Bot ยังไม่ได้ล็อกอินหรือไม่ได้เริ่มทำงาน');
      }
    } catch (err) {
      errors.push(`Discord Bot send failed: ${err.message}`);
    }
  }

  if (!cleanWebhook && !cleanChannelId) {
    return {
      success: false,
      error: 'ยังไม่ได้ระบุ Webhook URL หรือ Channel ID สำหรับระบบนี้ (กรุณาตั้งค่าใน Admin Panel หรือใส่ในฟอร์ม)'
    };
  }

  return {
    success: false,
    error: errors.join(' | ') || 'ไม่สามารถส่งข้อความเข้า Discord ได้'
  };
}

// ── Embed Payload Builders ────────────────────────────────────

/**
 * Build Embed for Gang Item Delivery (ส่งของแก๊ง)
 */
function buildDeliveryEmbed({ senderName, itemName, amount, location, imageUrl, note, timeStr }) {
  const fields = [
    { name: '👤 สมาชิกผู้ส่ง', value: `**${senderName || 'ไม่ระบุชื่อ'}**`, inline: true },
    { name: '📦 ไอเทม / สิ่งของ', value: `**${itemName || 'ของส่งแก๊ง'}**`, inline: true },
    { name: '🔢 จำนวนที่ส่ง', value: `**${amount || '1'}**`, inline: true },
    { name: '📍 จุดส่ง / ตู้เก็บของ', value: location || 'ตู้แก๊ง EVISU', inline: true }
  ];

  if (note && note.trim()) {
    fields.push({ name: '📝 บันทึกเพิ่มเติม', value: note.trim(), inline: false });
  }

  const embed = {
    title: '📦 รายงานการส่งของแก๊ง EVISU',
    description: `สมาชิก **${senderName}** ได้ทำการบันทึกส่งของเข้าแก๊งเรียบร้อยแล้ว`,
    color: COLORS.DELIVERY,
    author: {
      name: 'EVISU GANG | DELIVERY SYSTEM',
      icon_url: LOGO_URL
    },
    fields,
    footer: {
      text: 'EVISU Gang • FiveM Management System',
      icon_url: LOGO_URL
    },
    timestamp: new Date().toISOString()
  };

  if (imageUrl && imageUrl.trim().startsWith('http')) {
    embed.image = { url: imageUrl.trim() };
  }

  return embed;
}

/**
 * Build Embed for Gang Treasury (เงินแก๊ง)
 */
function buildTreasuryEmbed({ type, userName, amount, purpose, imageUrl, note, currentTotal }) {
  const isDeposit = type === 'deposit';
  const actionText = isDeposit ? '🟢 ฝากเงินเข้ากองกลางแก๊ง' : '🔴 เบิกเงินจากกองกลางแก๊ง';
  const color = isDeposit ? COLORS.DEPOSIT : COLORS.WITHDRAW;

  const fields = [
    { name: '👤 ผู้ทำรายการ', value: `**${userName || 'ไม่ระบุชื่อ'}**`, inline: true },
    { name: '💵 จำนวนเงิน', value: `**${formatMoney(amount)}**`, inline: true },
    { name: '🏷️ ประเภทรายการ', value: isDeposit ? '🟢 ฝากเงิน (Deposit)' : '🔴 เบิกเงิน (Withdraw)', inline: true },
    { name: '📋 วัตถุประสงค์ / รายละเอียด', value: purpose || (isDeposit ? 'เงินสนับสนุนแก๊ง' : 'เบิกค่าใช้จ่ายแก๊ง'), inline: false }
  ];

  if (note && note.trim()) {
    fields.push({ name: '📝 หมายเหตุ', value: note.trim(), inline: false });
  }

  if (currentTotal !== undefined && currentTotal !== null) {
    fields.push({ name: '💰 ยอดกองกลางปัจจุบัน (ระบบ)', value: `**${formatMoney(currentTotal)}**`, inline: false });
  }

  const embed = {
    title: `💰 ${isDeposit ? 'ส่งเงินแก๊ง / ฝากเงิน' : 'เบิกเงินแก๊ง'} | EVISU GANG TREASURY`,
    description: `**${userName}** ทำรายการ: **${actionText}** จำนวน **${formatMoney(amount)}**`,
    color,
    author: {
      name: 'EVISU GANG | TREASURY SYSTEM',
      icon_url: LOGO_URL
    },
    fields,
    footer: {
      text: 'EVISU Gang • FiveM Management System',
      icon_url: LOGO_URL
    },
    timestamp: new Date().toISOString()
  };

  if (imageUrl && imageUrl.trim().startsWith('http')) {
    embed.image = { url: imageUrl.trim() };
  }

  return embed;
}

/**
 * Build Embed for Gang Leave (ห้องลา)
 */
function buildLeaveEmbed({ memberName, leaveType, startDate, endDate, reason, contact }) {
  const fields = [
    { name: '👤 สมาชิกที่ขอลา', value: `**${memberName || 'ไม่ระบุชื่อ'}**`, inline: true },
    { name: '📋 ประเภทการลา', value: `**${leaveType || 'ลากิจ'}**`, inline: true },
    { name: '📅 วันที่เริ่มลา', value: startDate || '-', inline: true },
    { name: '🏁 วันที่สิ้นสุด (กลับมา)', value: endDate || '-', inline: true },
    { name: '💬 เหตุผลการลา', value: reason || 'ติดภารกิจส่วนตัว', inline: false }
  ];

  if (contact && contact.trim()) {
    fields.push({ name: '📞 ช่องทางติดต่อฉุกเฉิน', value: contact.trim(), inline: true });
  }

  const embed = {
    title: '📝 ใบแจ้งขอลาหยุดสมาชิกแก๊ง EVISU',
    description: `สมาชิก **${memberName}** ได้ยื่นเรื่องขอลาหยุด (${leaveType})`,
    color: COLORS.LEAVE,
    author: {
      name: 'EVISU GANG | LEAVE ROOM SYSTEM',
      icon_url: LOGO_URL
    },
    fields,
    footer: {
      text: 'EVISU Gang • FiveM Management System',
      icon_url: LOGO_URL
    },
    timestamp: new Date().toISOString()
  };

  return embed;
}

/**
 * Build Embed for Test Connection (ทดสอบ Webhook / Channel ID)
 */
function buildTestEmbed({ systemName, testerName }) {
  return {
    title: `⚡ ทดสอบการเชื่อมต่อระบบ Discord: ${systemName}`,
    description: `การเชื่อมต่อระหว่างเว็บไซต์ EVISU Gang และห้อง Discord ทำงานได้อย่างสมบูรณ์แบบ! 🎉`,
    color: COLORS.SYSTEM,
    author: {
      name: 'EVISU GANG | TEST CONNECTION',
      icon_url: LOGO_URL
    },
    fields: [
      { name: '📡 ระบบที่ทดสอบ', value: systemName || 'ระบบแก๊ง', inline: true },
      { name: '👤 ผู้ทดสอบ', value: testerName || 'Admin EVISU', inline: true },
      { name: '🕒 เวลาทดสอบ', value: new Date().toLocaleString('th-TH'), inline: true },
      { name: '✅ สถานะ', value: '🟢 พร้อมใช้งาน 100%', inline: false }
    ],
    footer: {
      text: 'EVISU Gang • FiveM Management System',
      icon_url: LOGO_URL
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  sendDiscordNotification,
  buildDeliveryEmbed,
  buildTreasuryEmbed,
  buildLeaveEmbed,
  buildTestEmbed,
  formatMoney
};
