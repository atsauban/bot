import { registerCommand } from '../../core/commands.js';
import {
  tttHandleNumeric,
  tttHasSession,
  tebakHandleNumeric,
  tebakHasSession,
} from './game.command.js';
import { kuisHandleNumeric, kuisHasSession } from './quiz.command.js';

function registerNumeric(n) {
  registerCommand(`!${n}`, async ({ sock, message, logger }) => {
    try {
      const chatId = message.key.remoteJid;
      if (kuisHasSession(chatId)) {
        const handled = await kuisHandleNumeric(sock, message, n);
        if (handled) return;
      }
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
