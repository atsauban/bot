import { registerCommand } from './registry.js';

registerCommand('!help', async ({ sock, message, text }) => {
  const chatId = message.key.remoteJid;
  const topic = text.replace(/^!help\s*/i, '').trim().toLowerCase();
  const isGroup = chatId.endsWith('@g.us');

  if (!topic) {
    // Kirim menu interaktif (List)
    const payload = buildHelpList(isGroup);
    await sock.sendMessage(chatId, payload, { quoted: message });
    return;
  }

  const lines = helpByTopic(topic, isGroup);
  if (!lines || lines.length === 0) return;
  await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
});

registerCommand('!help-topic', async ({ sock, message, text }) => {
  const chatId = message.key.remoteJid;
  const isGroup = chatId.endsWith('@g.us');
  const topic = (text.split(/\s+/)[1] || '').toLowerCase();
  const lines = helpByTopic(topic, isGroup);
  if (!lines || !lines.length) return;
  await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
});

function buildHelpList(isGroup) {
  const sections = [];
  sections.push({
    title: 'Umum',
    rows: [
      { title: 'Umum (ping/status/media/ascii)', rowId: '!help-topic general', description: 'Dasar bot' },
    ],
  });
  sections.push({
    title: 'Game',
    rows: [
      { title: 'Tebak Angka', rowId: '!help-topic game', description: 'Cara main tebak angka' },
      { title: 'Tic-Tac-Toe', rowId: '!help-topic ttt', description: 'Main XO di grup/DM' },
    ],
  });
  if (isGroup) {
    sections.push({
      title: 'Grup',
      rows: [
        { title: 'Fitur Grup', rowId: '!help-topic group', description: 'Info, list, tagall, admin tools' },
      ],
    });
  }
  sections.push({
    title: 'Bot-only',
    rows: [
      { title: 'Reminder', rowId: '!help-topic reminder', description: 'Set/list/cancel reminder' },
      { title: 'AI (Groq)', rowId: '!help-topic ai', description: 'Jawaban AI via Groq' },
      { title: 'Spam', rowId: '!help-topic spam', description: 'Kirim teks berulang (batas aman)' },
    ],
  });

  return {
    text: 'Pilih topik bantuan:',
    buttonText: 'Pilih Topik',
    sections,
  };
}

function helpByTopic(topic, isGroup) {
  switch (topic) {
    case 'general':
      return [
        'Bantuan Umum:',
        '- !ping → uji nyala + latency',
        '- !status → info server (CPU/RAM/Disk/uptime)',
        '- !stiker → balas gambar/video (≤12s) jadi stiker',
        '- !ascii-list [filter] → daftar font figlet',
        '- !ascii <font> <teks> → render ASCII',
        '- !weather <lokasi>, !forecast <lokasi> [1–3] → cuaca/ramalan',
      ];
    case 'group':
    case 'grup':
      return [
        'Bantuan Grup:',
        '- !groupinfo → info grup (owner ditag)',
        '- !list → daftar anggota (mention)',
        '- !tagall → tag semua anggota',
        '- !setname <nama>, !setdesc <deskripsi>, !setpic (balas gambar)',
        '- !add <nomor...>, !kick <target>, !promote <target>, !demote <target>',
        'Catatan: aksi partisipan butuh bot sebagai admin grup.',
      ];
    case 'game':
      return [
        'Bantuan Game Tebak Angka:',
        '- !tebak → mulai sesi; tebak dengan !1.. !10',
        '- Ada klu (lebih besar/kecil), menang dan seri otomatis',
      ];
    case 'ttt':
      return [
        'Bantuan Tic-Tac-Toe:',
        '- Grup: !ttt @user untuk menantang lawan',
        '- DM: !ttt untuk melawan bot (kamu X, bot O)',
        '- Pilih kotak via daftar List yang dikirim bot',
        '- Menyerah: !ttt resign | !ttt stop',
        '- Timeout: 2 menit per giliran',
      ];
    case 'reminder':
      return [
        'Bantuan Reminder (bot-only):',
        '- !reminder <pesan> <HH:MM> → set reminder',
        '- !reminder-list → daftar reminder pending chat ini',
        '- !reminder-cancel <id|index> → batalkan reminder',
        'Catatan: reminder persisten (DB), zona waktu server.',
      ];
    case 'ai':
      return [
        'Bantuan AI (bot-only):',
        '- !ai <prompt> → jawaban AI via Groq',
        'Env: GROQ_API_KEY wajib; AI_MODEL opsional.',
      ];
    case 'spam':
      return [
        'Bantuan Spam (bot-only):',
        '- !spam <jumlah> <pesan> → kirim pesan berulang (maks 100)',
        '- Bot menyisipkan zero-width space jika pesan diawali ! agar tidak memicu command.',
      ];
    default:
      return mainHelp(isGroup);
  }
}

function mainHelp(isGroup) {
  const base = [
    'Bantuan Perintah (ringkas):',
    '• Umum → ping, status, stiker, ascii, weather/forecast',
    '• Game → tebak angka, ttt (!ttt-help)',
    ...(isGroup ? ['• Grup → groupinfo, list, tagall, setname/desc/pic, add/kick/promote/demote'] : []),
    '• Bot-only → reminder, spam, ai',
    '',
    'Gunakan menu interaktif di atas atau ketik:',
    '- !help general | !help game | !help ttt',
    ...(isGroup ? ['- !help group'] : []),
    '- !help reminder | !help ai | !help spam',
  ];
  return base;
}
