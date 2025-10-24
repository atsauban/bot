import { registerCommand } from './registry.js';
import { areJidsSameUser, jidNormalizedUser } from '@whiskeysockets/baileys';

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

// ======================
// Tic-Tac-Toe (gabung di file ini)
// ======================
const tttSessions = new Map(); // chatJid -> session
const TURN_TIMEOUT_MS = 2 * 60 * 1000; // 2 menit per giliran

registerCommand('!ttt', async ({ sock, message, text, logger }) => {
  try {
    const chatId = message.key.remoteJid;
    const sub = text.trim().split(/\s+/)[1]?.toLowerCase() || '';
    if (sub === 'resign' || sub === 'stop') {
      const sess = tttSessions.get(chatId);
      if (!sess) return;
      const sender = senderJid(message);
      if (!tttIsPlayer(sess, sender)) return;
      tttEndSession(sock, chatId, `Permainan berakhir. ${mentionOne(sender)} menyerah.`);
      return;
    }

    if (tttSessions.has(chatId)) {
      const sess = tttSessions.get(chatId);
      await tttSendBoardText(sock, chatId, sess, message);
      return;
    }

    const p1 = senderJid(message);
    if (isGroupJid(chatId)) {
      const mentioned = getMentioned(message);
      if (!mentioned.length) return;
      const p2 = jidNormalizedUser(mentioned[0]);
      if (!p1 || !p2 || areJidsSameUser(p1, p2)) return;
      const sess = tttCreateSession(p1, p2, { isDM: false });
      tttSessions.set(chatId, sess);
      tttInstallTurnTimer(sock, chatId, sess, logger);
      const intro = `Tic-Tac-Toe dimulai!\nX: ${mentionOne(sess.players.X)} | O: ${mentionOne(sess.players.O)}\nGiliran: ${mentionOne(sess.turn)}\nPilih kotak:`;
      await tttSendBoardText(sock, chatId, sess, message, intro);
    } else {
      // DM vs bot
      const bot = botJid(sock);
      if (!bot || !p1) return;
      const sess = tttCreateSession(p1, bot, { isDM: true, humanStarts: true });
      tttSessions.set(chatId, sess);
      tttInstallTurnTimer(sock, chatId, sess, logger);
      const intro = `Tic-Tac-Toe vs Bot dimulai!\nKamu: ${mentionOne(sess.players.X)} (X) | Bot: ${mentionOne(sess.players.O)} (O)\nGiliran: ${mentionOne(sess.turn)}\nPilih kotak:`;
      await tttSendBoardText(sock, chatId, sess, message, intro);
    }
  } catch (err) {
    logger?.error?.({ err }, '!ttt error');
  }
});

registerCommand('!ttt-help', async ({ sock, message }) => {
  const lines = [
    'Tic-Tac-Toe Bantuan:',
    '- Grup: !ttt @user untuk menantang lawan.',
    '- DM: !ttt untuk bermain melawan bot.',
    '- Pilih kotak dengan !1 s/d !9.',
    '- Menyerah: !ttt resign (atau !ttt stop).',
    '- Giliran otomatis time-out dalam 2 menit.',
  ];
  await sock.sendMessage(message.key.remoteJid, { text: lines.join('\n') }, { quoted: message });
});

export async function tttHandleNumeric(sock, message, num, logger) {
  try {
    const chatId = message.key.remoteJid;
    const sess = tttSessions.get(chatId);
    if (!sess || sess.status !== 'in_progress') return false;
    const sender = senderJid(message);
    if (!areJidsSameUser(sender, sess.turn)) return false;
    if (!(num >= 1 && num <= 9)) return false;
    const idx = num - 1;
    if (sess.board[idx] !== null) {
      await tttSendBoardText(sock, chatId, sess, message);
      return true;
    }
    const symbol = sess.turnSymbol;
    sess.board[idx] = symbol;
    const outcome = tttCheckOutcome(sess.board);
    if (outcome === 'X' || outcome === 'O') {
      const winner = sess.players[outcome];
      await tttEndSession(sock, chatId, `Menang: ${mentionOne(winner)} (${outcome})\n${tttRenderBoard(sess.board)}`);
      return true;
    }
    if (outcome === 'draw') {
      await tttEndSession(sock, chatId, `Seri!\n${tttRenderBoard(sess.board)}`);
      return true;
    }
    // next turn
    sess.turn = areJidsSameUser(sess.turn, sess.players.X) ? sess.players.O : sess.players.X;
    sess.turnSymbol = symbol === 'X' ? 'O' : 'X';
    tttResetTurnTimer(sock, chatId, sess);
    if (sess.isDM && areJidsSameUser(sess.turn, sess.players.O)) {
      await tttBotAutoMove(sock, chatId, sess, message);
      return true;
    }
    const msg = `Giliran: ${mentionOne(sess.turn)} (${sess.turnSymbol})`;
    await tttSendBoardText(sock, chatId, sess, message, msg);
    return true;
  } catch (err) {
    logger?.error?.({ err }, 'tttHandleNumeric error');
    return false;
  }
}

export function tttHasSession(chatId) {
  return tttSessions.has(chatId);
}

function tttCreateSession(p1, p2, opts = {}) {
  const humanStarts = !!opts.humanStarts;
  const isDM = !!opts.isDM;
  const xFirst = isDM ? humanStarts : Math.random() < 0.5;
  const players = { X: xFirst ? p1 : p2, O: xFirst ? p2 : p1 };
  return {
    createdAt: Date.now(),
    players,
    board: Array(9).fill(null),
    turn: players.X,
    turnSymbol: 'X',
    status: 'in_progress',
    timer: null,
    isDM,
  };
}

async function tttEndSession(sock, chatId, text) {
  const sess = tttSessions.get(chatId);
  if (sess?.timer) clearTimeout(sess.timer);
  tttSessions.delete(chatId);
  await sock.sendMessage(chatId, { text, mentions: tttSessionMentions(sess) });
}

function tttSessionMentions(sess) {
  if (!sess) return [];
  return [sess.players.X, sess.players.O];
}

async function tttSendBoardText(sock, chatId, sess, quotedMsg, header = '') {
  const boardStr = tttRenderBoard(sess.board);
  const hint = `Pilih kotak dengan mengetik: !1 s/d !9 (Giliran ${sess.turnSymbol})\nAtau klik tombol di bawah.`;
  const text = [header, boardStr, hint].filter(Boolean).join('\n');
  await sock.sendMessage(
    chatId,
    { text, mentions: tttSessionMentions(sess) },
    quotedMsg ? { quoted: quotedMsg } : {},
  );
}


function tttRenderBoard(b) {
  const cell = (i) => (b[i] ? b[i] : String(i + 1));
  const line = (a, b, c) => ` ${cell(a)} | ${cell(b)} | ${cell(c)} `;
  const sep = '---+---+---';
  return ['```', line(0, 1, 2), sep, line(3, 4, 5), sep, line(6, 7, 8), '```'].join('\n');
}

function tttAvailableMoves(b) {
  const out = [];
  for (let i = 0; i < 9; i++) if (!b[i]) out.push(i + 1);
  return out;
}

function tttCheckOutcome(b) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b1, c] of lines) {
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
  }
  if (b.every((x) => x)) return 'draw';
  return null;
}

function getMentioned(message) {
  return (
    message.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  ).map((j) => jidNormalizedUser(j));
}

function senderJid(message) {
  return jidNormalizedUser(message.key.participant || message.key.remoteJid);
}

function tttIsPlayer(sess, j) {
  return areJidsSameUser(j, sess.players.X) || areJidsSameUser(j, sess.players.O);
}

function mentionOne(j) {
  const node = (j || '').split('@')[0];
  return `@${node.split(':')[0]}`;
}

function isGroupJid(jid = '') {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function tttInstallTurnTimer(sock, chatId, sess, logger) {
  if (sess.timer) clearTimeout(sess.timer);
  sess.timer = setTimeout(() => {
    try {
      const loser = sess.turn;
      const winner = areJidsSameUser(loser, sess.players.X)
        ? sess.players.O
        : sess.players.X;
      tttEndSession(sock, chatId, `Waktu habis! Pemenang: ${mentionOne(winner)}\n${tttRenderBoard(sess.board)}`);
    } catch (e) {
      logger?.error?.({ e }, 'ttt timer error');
    }
  }, TURN_TIMEOUT_MS);
}

function tttResetTurnTimer(sock, chatId, sess) {
  if (sess.timer) clearTimeout(sess.timer);
  tttInstallTurnTimer(sock, chatId, sess);
}

function botJid(sock) {
  try {
    return jidNormalizedUser(sock?.user?.id);
  } catch {
    return '';
  }
}

async function tttBotAutoMove(sock, chatId, sess, quotedMsg) {
  const b = sess.board;
  const pick =
    tttFindWinningMove(b, 'O') ??
    tttFindWinningMove(b, 'X') ??
    (b[4] ? null : 4) ??
    [0, 2, 6, 8].find((i) => !b[i]) ??
    b.findIndex((x) => !x);

  if (pick == null || pick < 0) {
    await tttSendBoardText(sock, chatId, sess, quotedMsg);
    return;
  }

  sess.board[pick] = 'O';
  const outcome = tttCheckOutcome(sess.board);
  if (outcome === 'O') {
    await tttEndSession(sock, chatId, `Bot menang (O)!\n${tttRenderBoard(sess.board)}`);
    return;
  }
  if (outcome === 'draw') {
    await tttEndSession(sock, chatId, `Seri!\n${tttRenderBoard(sess.board)}`);
    return;
  }
  // kembalikan giliran ke manusia (X)
  sess.turn = sess.players.X;
  sess.turnSymbol = 'X';
  tttResetTurnTimer(sock, chatId, sess);
  await tttSendBoardText(sock, chatId, sess, quotedMsg, `Giliran: ${mentionOne(sess.turn)} (${sess.turnSymbol})`);
}

function tttFindWinningMove(b, symbol) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b1, c] of lines) {
    const line = [a, b1, c];
    const values = line.map((i) => b[i]);
    const countSym = values.filter((v) => v === symbol).length;
    const empties = line.filter((i) => !b[i]);
    if (countSym === 2 && empties.length === 1) return empties[0];
  }
  return null;
}
