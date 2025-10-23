import { registerCommand } from './registry.js';

registerCommand('!ping', async ({ sock, message }) => {
  const now = Date.now();
  let msgTsMs = null;
  // Baileys biasanya memberi messageTimestamp (detik)
  const ts = message.messageTimestamp ?? message.message?.messageTimestamp;
  if (ts !== undefined && ts !== null) {
    const num = Number(ts);
    if (Number.isFinite(num)) {
      // asumsikan dalam detik → konversi ke ms jika terlihat kecil
      msgTsMs = num < 1e12 ? num * 1000 : num;
    }
  }

  const latency = msgTsMs ? Math.max(0, now - msgTsMs) : null;
  const lines = [
    'pong (👉ﾟヮﾟ)👉',
    latency !== null ? `Latency: ${latency} ms` : undefined,
  ].filter(Boolean);

  await sock.sendMessage(
    message.key.remoteJid,
    { text: lines.join('\n') },
    { quoted: message },
  );
});
