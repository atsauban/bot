import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { registerCommand } from './registry.js';

// Set path ffmpeg bila tersedia (untuk konversi video -> webp animasi)
try {
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }
} catch {}

registerCommand('!stiker', async ({ sock, message, logger }) => {
  try {
    const media = findMediaInMessage(message.message) || findFromQuoted(message.message);
    if (!media) return; // silent jika tidak ada media

    await sendStickerFromMedia(sock, message, media);
  } catch (err) {
    logger?.error?.({ err }, 'Gagal membuat stiker');
  }
});

// Ubah stiker (webp) menjadi gambar (png)
registerCommand('!img', async ({ sock, message, logger }) => {
  try {
    const chatId = message.key.remoteJid;
    const sticker = findStickerInMessage(message.message) || findStickerInMessage(message.message?.extendedTextMessage?.contextInfo?.quotedMessage);
    if (!sticker) return; // silent jika tidak ada stiker

    const webpBuf = await downloadBuffer(sticker, 'sticker');
    let pngBuf = null;

    // Coba sharp terlebih dahulu
    try {
      const mod = await import('sharp');
      const sharp = mod?.default || mod;
      pngBuf = await sharp(webpBuf).png().toBuffer();
    } catch {}

    // Fallback ke jimp bila sharp tidak tersedia/ gagal
    if (!pngBuf) {
      try {
        const mod = await import('jimp');
        const Jimp = mod?.Jimp || mod.default || mod;
        const img = await Jimp.read(webpBuf);
        pngBuf = await img.getBufferAsync(Jimp.MIME_PNG);
      } catch {}
    }

    if (!pngBuf) {
      // Sampaikan info ringan agar pengguna tahu dependensi
      await sock.sendMessage(chatId, { text: 'Gagal mengonversi stiker ke gambar. Pastikan modul sharp atau jimp tersedia.' }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { image: pngBuf }, { quoted: message });
  } catch (err) {
    logger?.error?.({ err }, 'Gagal mengonversi stiker ke gambar');
  }
});

function findFromQuoted(msg) {
  const ctx =
    msg?.extendedTextMessage?.contextInfo ||
    msg?.imageMessage?.contextInfo ||
    msg?.videoMessage?.contextInfo ||
    null;
  const quoted = ctx?.quotedMessage || null;
  if (!quoted) return null;
  return findMediaInMessage(quoted);
}

function findStickerInMessage(msg) {
  if (!msg) return null;
  if (msg.stickerMessage) return msg.stickerMessage;
  return null;
}

function findMediaInMessage(msg) {
  if (!msg) return null;
  if (msg.imageMessage) return { type: 'image', content: msg.imageMessage };
  if (msg.videoMessage) return { type: 'video', content: msg.videoMessage };
  return null;
}

async function downloadMediaBuffer(content, type) {
  const stream = await downloadContentFromMessage(content, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function downloadBuffer(content, type) {
  const stream = await downloadContentFromMessage(content, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function sendStickerFromMedia(sock, message, media) {
  const { type, content } = media;
  if (type === 'video') {
    const seconds = Number(content.seconds || 0);
    if (seconds && seconds > 12) return; // silent jika terlalu panjang
  }

  const buf = await downloadMediaBuffer(content, type);

  const sticker = new Sticker(buf, {
    type: StickerTypes.FULL,
    quality: 70,
    pack: 'mbah',
    author: 'test',
    animated: type === 'video',
  });
  const webp = await sticker.build();
  await sock.sendMessage(message.key.remoteJid, { sticker: webp }, { quoted: message });
}
