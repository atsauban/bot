import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import config from './config.js';
import createLogger from './logger.js';
import { findCommand } from './commands/index.js';
import { bindReminderScheduler } from './commands/reminder.js';

const logger = createLogger(config.logLevel);

void startBot();

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(config.authFolder);
    const { version } = await fetchLatestBaileysVersion();

    logger.info({ version }, 'Inisialisasi bot (Baileys)...');

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      version,
      logger,
      printQRInTerminal: false,
      browser: ['Bot', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    // Tentukan metode autentikasi efektif
    let method = config.authMethod || 'auto';
    if (method === 'pairing' && !config.pairPhoneNumber) {
      logger.warn('AUTH_METHOD=pairing tetapi PAIR_PHONE_NUMBER belum diisi; fallback ke QR.');
      method = 'qr';
    }

    let reconnecting = false;
    let pairingRequested = false;
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const wantPairing =
          method === 'pairing' || (method === 'auto' && !!config.pairPhoneNumber);
        if (wantPairing) {
          logger.info('Mode pairing via nomor aktif; meminta kode pairing...');
          if (!pairingRequested) {
            try {
              const code = await sock.requestPairingCode(config.pairPhoneNumber);
              logger.warn({ pairWith: config.pairPhoneNumber }, `KODE PAIRING: ${code}`);
              pairingRequested = true;
            } catch (err) {
              logger.error({ err }, 'Gagal meminta pairing code saat QR diterima. Menampilkan QR sebagai fallback.');
              qrcode.generate(qr, { small: true });
            }
          }
        } else {
          logger.info('QR code diterima. Scan via WhatsApp > Perangkat Tertaut.');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        reconnecting = false;
        pairingRequested = false;
        logger.info('Bot tersambung.');
        try {
          bindReminderScheduler(sock, logger);
        } catch (e) {
          logger.error({ e }, 'Gagal mengikat scheduler reminder');
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect && !reconnecting) {
          reconnecting = true;
          pairingRequested = false;
          logger.warn({ statusCode }, 'Terputus, mencoba ulang dalam 2 detik...');
          setTimeout(() => {
            startBot().catch((err) => logger.error({ err }, 'Gagal restart bot'));
          }, 2000);
        } else if (!shouldReconnect) {
          logger.error('Sesi logout. Hapus folder auth untuk login ulang.');
        }
      }
    });

    const handledTypes = new Set(['notify', 'append', 'replace']);
    const processedMessages = new Set();
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (!handledTypes.has(type)) return;

      for (const message of messages) {
        // Dedup: Baileys kadang mengirim event ganda (notify/append)
        const mId = message?.key?.id;
        const rJid = message?.key?.remoteJid;
        if (mId && rJid) {
          const u = `${rJid}:${mId}`;
          if (processedMessages.has(u)) continue;
          processedMessages.add(u);
          if (processedMessages.size > 1000) processedMessages.clear();
        }

        const text = extractText(message);
        if (!text) continue;

        const handler = findCommand(text);
        if (!handler) continue;

        try {
          await handler({ sock, message, text, logger });
        } catch (err) {
          logger.error({ err }, 'Gagal menjalankan command');
        }
      }
    });

    return sock;
  } catch (error) {
    logger.error({ err: error }, 'Gagal inisialisasi. Ulangi dalam 5 detik.');
    setTimeout(() => {
      startBot().catch((err) => logger.error({ err }, 'Gagal restart bot'));
    }, 5000);
    return null;
  }
}

function extractText(message) {
  const msg = message.message;
  if (!msg) return '';

  if (msg.conversation) return msg.conversation.trim();
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text.trim();
  if (msg.imageMessage?.caption) return msg.imageMessage.caption.trim();
  if (msg.videoMessage?.caption) return msg.videoMessage.caption.trim();
  if (msg.buttonsResponseMessage?.selectedButtonId) {
    return msg.buttonsResponseMessage.selectedButtonId.trim();
  }
  if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return msg.listResponseMessage.singleSelectReply.selectedRowId.trim();
  }
  if (msg.templateButtonReplyMessage?.selectedId) {
    return msg.templateButtonReplyMessage.selectedId.trim();
  }
  if (msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const params = JSON.parse(
        msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson,
      );
      return params.id?.trim() ?? '';
    } catch {
      return '';
    }
  }

  return '';
}
// command helpers dipindahkan ke src/commands/*
