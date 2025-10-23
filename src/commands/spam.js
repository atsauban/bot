import { registerCommand } from './registry.js';

registerCommand('!spam', async ({ sock, message, text, logger }) => {
  try {
    // Hanya bot (fromMe)
    if (!message.key?.fromMe) return;

    const parts = String(text || '').trim().split(/\s+/);
    if (parts.length < 3) return; // format: !spam <count> <pesan>

    const countRaw = parts[1];
    const countNum = parseInt(countRaw, 10);
    if (!Number.isFinite(countNum) || countNum <= 0) return;

    const MAX = 100; // pembatas agar tidak berlebihan
    const n = Math.min(countNum, MAX);
    const body = parts.slice(2).join(' ').trim();
    if (!body) return;

    const chatId = message.key.remoteJid;

    for (let i = 0; i < n; i++) {
      try {
        await sock.sendMessage(chatId, { text: sanitizeForSpam(body) });
      } catch (e) {
        logger?.error?.({ e, i }, '!spam send error');
        break;
      }
      // jeda singkat untuk hindari rate limiting
      await delay(150);
    }
  } catch (err) {
    logger?.error?.({ err }, '!spam error');
  }
});

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeForSpam(text) {
  // Hindari memicu command handler ketika menspam teks yang diawali '!'
  // Sisipkan zero-width space setelah '!'
  const s = String(text);
  const trimmed = s.trimStart();
  if (trimmed.startsWith('!')) {
    // pertahankan spasi di depan
    const leading = s.slice(0, s.length - trimmed.length);
    return leading + '!\u200B' + trimmed.slice(1);
  }
  return s;
}
