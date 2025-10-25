import { registerCommand } from '../../core/commands.js';
import {
  tttHandleNumeric,
  tttHasSession,
  tebakHandleNumeric,
  tebakHasSession,
} from './game.command.js';

function registerNumeric(n) {
  registerCommand(`!${n}`, async ({ sock, message, logger }) => {
    try {
      const chatId = message.key.remoteJid;
      if (tttHasSession(chatId)) {
        const handled = await tttHandleNumeric(sock, message, n, logger);
        if (handled) return;
      }
      if (tebakHasSession(chatId)) {
        await tebakHandleNumeric(sock, message, n);
      }
    } catch (err) {
      console.error('numeric handler error', err);
    }
  });
}

for (let i = 1; i <= 9; i++) registerNumeric(i);
