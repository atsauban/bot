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

