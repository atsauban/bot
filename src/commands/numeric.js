import { registerCommand } from './registry.js';
import { tttHandleNumeric, tttHasSession } from './ttt.js';
import { tebakHandleNumeric, tebakHasSession } from './game.js';

function registerNumeric(n) {
  registerCommand(`!${n}`, async ({ sock, message, logger }) => {
    try {
      const chatId = message.key.remoteJid;
      // Prioritaskan TTT bila ada sesi aktif
      if (tttHasSession(chatId)) {
        const handled = await tttHandleNumeric(sock, message, n, logger);
        if (handled) return;
      }
      // Lalu Tebak Angka bila ada sesi aktif
      if (tebakHasSession(chatId)) {
        await tebakHandleNumeric(sock, message, n);
      }
      // Jika tak ada sesi keduanya: silent
    } catch (err) {
      console.error('numeric handler error', err);
    }
  });
}

for (let i = 1; i <= 9; i++) registerNumeric(i);

