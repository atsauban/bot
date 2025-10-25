import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import config from '../../core/config.js';
import { extractText } from './extract.js';

export async function startWaClient({ logger, onText, onOpen } = {}) {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(config.authFolder);
    const { version } = await fetchLatestBaileysVersion();

    logger?.info?.({ version }, 'Inisialisasi bot (Baileys)...');

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

    let method = config.authMethod || 'auto';
    if (method === 'pairing' && !config.pairPhoneNumber) {
      logger?.warn?.('AUTH_METHOD=pairing tetapi PAIR_PHONE_NUMBER belum diisi; fallback ke QR.');
      method = 'qr';
    }

    let reconnecting = false;
    let pairingRequested = false;
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        const wantPairing = method === 'pairing' || (method === 'auto' && !!config.pairPhoneNumber);
        if (wantPairing) {
          logger?.info?.('Mode pairing via nomor aktif; meminta kode pairing...');
          if (!pairingRequested) {
            try {
              const code = await sock.requestPairingCode(config.pairPhoneNumber);
              logger?.warn?.({ pairWith: config.pairPhoneNumber }, `KODE PAIRING: ${code}`);
              pairingRequested = true;
            } catch (err) {
              logger?.error?.(
                { err },
                'Gagal meminta pairing code saat QR diterima. Menampilkan QR sebagai fallback.',
              );
              qrcode.generate(qr, { small: true });
            }
          }
        } else {
          logger?.info?.('QR code diterima. Scan via WhatsApp > Perangkat Tertaut.');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        reconnecting = false;
        pairingRequested = false;
        logger?.info?.('Bot tersambung.');
        try {
          onOpen && onOpen(sock);
        } catch (e) {
          logger?.error?.({ e }, 'onOpen error');
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect && !reconnecting) {
          reconnecting = true;
          pairingRequested = false;
          logger?.warn?.({ statusCode }, 'Terputus, mencoba ulang dalam 2 detik...');
          setTimeout(() => {
            startWaClient({ logger, onText, onOpen }).catch((err) =>
              logger?.error?.({ err }, 'Gagal restart bot'),
            );
          }, 2000);
        } else if (!shouldReconnect) {
          logger?.error?.('Sesi logout. Hapus folder auth untuk login ulang.');
        }
      }
    });

    const handledTypes = new Set(['notify', 'append', 'replace']);
    const processedMessages = new Set();
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (!handledTypes.has(type)) return;
      for (const message of messages) {
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
        try {
          onText && (await onText(text, { sock, message }));
        } catch (err) {
          logger?.error?.({ err }, 'onText error');
        }
      }
    });

    return sock;
  } catch (error) {
    logger?.error?.({ err: error }, 'Gagal inisialisasi. Ulangi dalam 5 detik.');
    setTimeout(() => {
      startWaClient({ logger, onText, onOpen }).catch((err) =>
        logger?.error?.({ err }, 'Gagal restart bot'),
      );
    }, 5000);
    return null;
  }
}

export default startWaClient;
