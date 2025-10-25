import { registerCommand } from '../../core/commands.js';

// Sederhana: bank soal lokal (pilihan ganda 1..4)
const QUESTION_BANK = [
  {
    q: 'Ibukota Indonesia adalah?',
    c: ['Jakarta', 'Bandung', 'Surabaya', 'Medan'],
    a: 0,
  },
  {
    q: 'Planet terdekat dengan Matahari?',
    c: ['Venus', 'Merkurius', 'Bumi', 'Mars'],
    a: 1,
  },
  {
    q: 'Gunung tertinggi di dunia adalah?',
    c: ['K2', 'Kilimanjaro', 'Everest', 'Elbrus'],
    a: 2,
  },
  {
    q: 'Lambang kimia untuk air adalah?',
    c: ['CO2', 'H2O', 'O2', 'NaCl'],
    a: 1,
  },
  {
    q: 'Siapakah penemu lampu pijar?',
    c: ['Nikola Tesla', 'Thomas A. Edison', 'Alexander G. Bell', 'Albert Einstein'],
    a: 1,
  },
  {
    q: 'Bahasa resmi Brasil?',
    c: ['Spanyol', 'Portugis', 'Inggris', 'Prancis'],
    a: 1,
  },
  {
    q: 'Hewan tercepat di darat?',
    c: ['Cheetah', 'Kuda', 'Singa', 'Rusa'],
    a: 0,
  },
  {
    q: 'Negara dengan populasi terbanyak?',
    c: ['India', 'Tiongkok', 'Amerika Serikat', 'Indonesia'],
    a: 1,
  },
  {
    q: 'Simbol kimia untuk Emas?',
    c: ['Ag', 'Au', 'Fe', 'Cu'],
    a: 1,
  },
  {
    q: 'IBAN merujuk pada sistem di bidang?',
    c: ['Kedokteran', 'Perbankan', 'Pertanian', 'Teknik Mesin'],
    a: 1,
  },
];

// sesi per chat
const quizSessions = new Map(); // chatId -> { idx, startedAt }

function pickRandomQuestion() {
  const idx = Math.floor(Math.random() * QUESTION_BANK.length);
  return { idx, q: QUESTION_BANK[idx] };
}

function renderQuestion(q) {
  const lines = [
    '🧠 Kuis Trivia',
    '',
    q.q,
    ...q.c.map((opt, i) => `${i + 1}. ${opt}`),
    '',
    'Jawab dengan: !1 / !2 / !3 / !4',
    'Berhenti: !kuis stop',
  ];
  return lines.join('\n');
}

registerCommand('!kuis', async ({ sock, message, text }) => {
  const chatId = message.key.remoteJid;
  const sub = text.trim().split(/\s+/)[1]?.toLowerCase() || '';
  if (sub === 'stop' || sub === 'end' || sub === 'selesai') {
    if (quizSessions.has(chatId)) quizSessions.delete(chatId);
    return; // silent sesuai kebijakan
  }

  // Jika sudah ada sesi, kirim ulang soal
  const existing = quizSessions.get(chatId);
  if (existing) {
    const q = QUESTION_BANK[existing.idx];
    await sock.sendMessage(chatId, { text: renderQuestion(q) }, { quoted: message });
    return;
  }

  // Mulai sesi baru
  const picked = pickRandomQuestion();
  quizSessions.set(chatId, { idx: picked.idx, startedAt: Date.now() });
  await sock.sendMessage(chatId, { text: renderQuestion(picked.q) }, { quoted: message });
});

export function kuisHasSession(chatId) {
  return quizSessions.has(chatId);
}

export async function kuisHandleNumeric(sock, message, n) {
  const chatId = message.key.remoteJid;
  const sess = quizSessions.get(chatId);
  if (!sess) return false;

  const q = QUESTION_BANK[sess.idx];
  if (!q) {
    quizSessions.delete(chatId);
    return false;
  }
  const correct = q.a;
  if (n - 1 === correct) {
    quizSessions.delete(chatId);
    await sock.sendMessage(
      chatId,
      { text: `Benar! ✅ Jawaban: ${q.c[correct]}` },
      { quoted: message },
    );
    return true;
  }
  // Salah → beri kesempatan lagi, tidak terlalu spam
  await sock.sendMessage(chatId, { text: 'Salah. Coba lagi!' }, { quoted: message });
  return true;
}
