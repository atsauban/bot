import config from './core/config.js';
import createLogger from './core/logger.js';
import './features/index.js';
import { findCommand } from './core/commands.js';
import { bindReminderScheduler } from './features/reminder/reminder.command.js';
import { startWaClient } from './platform/wa/client.js';
import { shouldProcess } from './core/state.js';

const logger = createLogger(config.logLevel);

void startBot();

async function startBot() {
  return startWaClient({
    logger,
    onOpen: (sock) => {
      try {
        bindReminderScheduler(sock, logger);
      } catch (e) {
        logger.error({ e }, 'Gagal mengikat scheduler reminder');
      }
    },
    onText: async (text, { sock, message }) => {
      const chatId = message.key.remoteJid;
      if (!shouldProcess(text, chatId)) return;
      const handler = findCommand(text);
      if (!handler) return;
      try {
        await handler({ sock, message, text, logger });
      } catch (err) {
        logger.error({ err }, 'Gagal menjalankan command');
      }
    },
  });
}

// command helpers terletak di src/features/*
