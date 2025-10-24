import { registerCommand } from './registry.js';

// Sesi permainan per chat (key = remoteJid)
const sessions = new Map();

function randInt1to10() {
  return Math.floor(Math.random() * 10) + 1;
}

function startSession(chatId) {
  const session = {
    target: randInt1to10(),
    attempts: 0,
    startedAt: Date.now(),
  };
  sessions.set(chatId, session);
  return session;
}

function parseGuess(text) {
  const parts = String(text).trim().split(/\s+/);
  if (parts.length < 2) return null;
  const token = parts[1];
  const n = parseInt(token, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 10) return null;
  return n;
}

registerCommand('!tebak', async ({ sock, message, text }) => {
  try {
    const chatId = message.key.remoteJid;
    const guess = parseGuess(text);
    let session = sessions.get(chatId);

    // Tanpa angka: mulai sesi baru jika belum ada; jika sudah ada, tetap silent
    if (guess === null) {
      if (session) return;
      session = startSession(chatId);
      await sock.sendMessage(
        chatId,
        { text: 'Aku sudah memilih angka 1-10. Tebak pakai: !1 s/d !10' },
        { quoted: message },
      );
      return;
    }

    // Dengan angka: evaluasi (mulai sesi jika belum ada)
    await handleGuess(sock, message, guess);
  } catch (err) {
    console.error('!tebak error', err);
  }
});

// Numeric handling now delegated via numeric router

export async function tebakHandleNumeric(sock, message, guess) {
  const chatId = message.key.remoteJid;
  let session = sessions.get(chatId);
  if (!session) return; // tetap silent jika belum ada sesi

  session.attempts += 1;
  const target = session.target;

  if (guess === target) {
    const tries = session.attempts;
    sessions.delete(chatId);
    await sock.sendMessage(
      chatId,
      { text: `Benar! Angkanya ${target}. Percobaan: ${tries}x 🎉` },
      { quoted: message },
    );
    return;
  }

  // Berikan klu
  const clue = guess < target ? 'Terlalu kecil. Klu: lebih besar ⬆️' : 'Terlalu besar. Klu: lebih kecil ⬇️';
  await sock.sendMessage(chatId, { text: clue }, { quoted: message });
}

export function tebakHasSession(chatId) {
  return sessions.has(chatId);
}
