import figlet from 'figlet';
import { registerCommand } from '../../core/commands.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const figletFonts = {
  list: () =>
    new Promise((resolve, reject) => figlet.fonts((e, f) => (e ? reject(e) : resolve(f)))),
  text: (str, opts) =>
    new Promise((resolve, reject) =>
      figlet.text(str, opts, (e, data) => (e ? reject(e) : resolve(data))),
    ),
};

registerCommand('!ascii-list', async ({ sock, message, text, logger }) => {
  try {
    const filter = text.slice('!ascii-list'.length).trim().toLowerCase();
    const fonts = await figletFonts.list();
    const filtered = filter ? fonts.filter((f) => f.toLowerCase().includes(filter)) : fonts;
    const header = `Fonts (${filtered.length})${filter ? ` — filter: ${filter}` : ''}`;
    const joined = filtered.join(', ');
    const chunkSize = 3500;
    if (!joined) {
      await sock.sendMessage(
        message.key.remoteJid,
        { text: header + '\n(tidak ada yang cocok)' },
        { quoted: message },
      );
      return;
    }
    for (let i = 0; i < joined.length; i += chunkSize) {
      const prefix = i === 0 ? header + '\n' : '';
      const piece = joined.slice(i, i + chunkSize);
      await sock.sendMessage(message.key.remoteJid, { text: prefix + piece }, { quoted: message });
    }
  } catch (err) {
    logger?.error?.({ err }, '!ascii-list error');
  }
});

registerCommand('!ascii', async ({ sock, message, text, logger }) => {
  try {
    const img = findImage(message);
    if (img) {
      const arg = text.replace(/^!ascii\s*/i, '').trim();
      let targetWidth = parseInt(arg, 10);
      if (!Number.isFinite(targetWidth)) targetWidth = 64;
      targetWidth = Math.max(16, Math.min(120, targetWidth));
      const buf = await downloadImageBuffer(img);
      const ascii = await convertBufferToAscii(buf, targetWidth);
      if (!ascii) return;
      const fence = '```';
      const maxLen = 3500;
      let chunk = fence + '\n';
      for (const line of ascii.split('\n')) {
        if ((chunk + line + '\n' + fence).length > maxLen) {
          await sock.sendMessage(
            message.key.remoteJid,
            { text: chunk + fence },
            { quoted: message },
          );
          chunk = fence + '\n';
        }
        chunk += line + '\n';
      }
      if (chunk.trim() !== '```') {
        await sock.sendMessage(message.key.remoteJid, { text: chunk + fence }, { quoted: message });
      }
      return;
    }

    const args = text.trim().split(/\s+/).slice(1);
    if (args.length < 2) return;
    const fonts = await figletFonts.list();
    const fontName = resolveFontFromArgs(args, fonts);
    if (!fontName) return;
    const usedTokens = fontName.split(/\s+/).length;
    const content = args.slice(usedTokens).join(' ').trim();
    if (!content) return;
    const safeContent = content.slice(0, 48);
    const rendered = await figletFonts.text(safeContent, {
      font: fontName,
      horizontalLayout: 'default',
    });
    const maxChars = 3500;
    const out = rendered.length > maxChars ? rendered.slice(0, maxChars) : rendered;
    const monospaced = '```\n' + out + '\n```';
    await sock.sendMessage(message.key.remoteJid, { text: monospaced }, { quoted: message });
  } catch (err) {
    logger?.error?.({ err }, '!ascii error');
  }
});

function resolveFontFromArgs(args, fonts) {
  const lowerSet = new Set(fonts.map((f) => f.toLowerCase()));
  for (let i = Math.min(args.length - 1, 4); i >= 1; i--) {
    const candidate = args.slice(0, i).join(' ');
    if (lowerSet.has(candidate.toLowerCase())) {
      return fonts.find((f) => f.toLowerCase() === candidate.toLowerCase());
    }
  }
  const first = args[0];
  if (lowerSet.has(first.toLowerCase())) {
    return fonts.find((f) => f.toLowerCase() === first.toLowerCase());
  }
  return null;
}

function findImage(message) {
  const msg = message.message || {};
  if (msg.imageMessage) return msg.imageMessage;
  const quoted = msg?.extendedTextMessage?.contextInfo?.quotedMessage || null;
  return quoted?.imageMessage || null;
}

async function downloadImageBuffer(imgMsg) {
  const stream = await downloadContentFromMessage(imgMsg, 'image');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function convertBufferToAscii(buffer, targetWidth = 64) {
  let Jimp;
  try {
    const mod = await import('jimp');
    Jimp = mod?.Jimp || mod.default || mod;
  } catch {}
  if (Jimp) {
    try {
      const img = await Jimp.read(buffer);
      const { width: w, height: h } = img.bitmap;
      const ratio = h / w;
      const targetHeight = Math.max(8, Math.round(ratio * targetWidth * 0.5));
      img.resize({ w: targetWidth, h: targetHeight });
      img.grayscale();
      const chars = ' .:-=+*#%@';
      let out = '';
      for (let y = 0; y < targetHeight; y++) {
        let line = '';
        for (let x = 0; x < targetWidth; x++) {
          const color = img.getPixelColor(x, y);
          const { r, g, b } = Jimp.intToRGBA(color);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const idx = Math.max(
            0,
            Math.min(chars.length - 1, Math.round((lum / 255) * (chars.length - 1))),
          );
          line += chars[idx];
        }
        out += line + '\n';
      }
      return out;
    } catch {}
  }
  let sharp;
  try {
    const mod = await import('sharp');
    sharp = mod?.default || mod;
  } catch {}
  if (sharp) {
    try {
      const meta = await sharp(buffer).metadata();
      const w = meta.width || targetWidth;
      const h = meta.height || targetWidth;
      const ratio = h / w;
      const targetHeight = Math.max(8, Math.round(ratio * targetWidth * 0.5));
      const { data, info } = await sharp(buffer)
        .resize(targetWidth, targetHeight)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const chars = ' .:-=+*#%@';
      let out = '';
      for (let y = 0; y < info.height; y++) {
        let line = '';
        for (let x = 0; x < info.width; x++) {
          const lum = data[y * info.width + x];
          const idx = Math.max(
            0,
            Math.min(chars.length - 1, Math.round((lum / 255) * (chars.length - 1))),
          );
          line += chars[idx];
        }
        out += line + '\n';
      }
      return out;
    } catch {}
  }
  return '';
}
