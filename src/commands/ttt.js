import { registerCommand } from './registry.js';
import { areJidsSameUser, jidNormalizedUser } from '@whiskeysockets/baileys';

// Sesi Tic-Tac-Toe per chat
const sessions = new Map(); // chatJid -> session
const TURN_TIMEOUT_MS = 2 * 60 * 1000; // 2 menit per giliran

registerCommand('!ttt', async ({ sock, message, text, logger }) => {
  try {
    const chatId = message.key.remoteJid;

    const sub = text.trim().split(/\s+/)[1]?.toLowerCase() || '';
    if (sub === 'resign' || sub === 'stop') {
      const sess = sessions.get(chatId);
      if (!sess) return;
      const sender = senderJid(message);
      if (!isPlayer(sess, sender)) return;
      endSession(sock, chatId, `Permainan berakhir. ${mentionOne(sender)} menyerah.`);
      return;
    }

    if (sessions.has(chatId)) {
      // Sudah ada game berjalan, tampilkan papan lagi
      const sess = sessions.get(chatId);
      await sendBoardText(sock, chatId, sess, message);
      return;
    }

    const p1 = senderJid(message);

    if (isGroupJid(chatId)) {
      // Mulai permainan baru di grup: butuh 1 mention sebagai lawan
      const mentioned = getMentioned(message);
      if (!mentioned.length) return; // silent jika tidak ada mention
      const p2 = jidNormalizedUser(mentioned[0]);
      if (!p1 || !p2 || areJidsSameUser(p1, p2)) return;

      const sess = createSession(p1, p2, { isDM: false });
      sessions.set(chatId, sess);
      installTurnTimer(sock, chatId, sess, logger);
      const intro = `Tic-Tac-Toe dimulai!\nX: ${mentionOne(sess.players.X)} | O: ${mentionOne(sess.players.O)}\nGiliran: ${mentionOne(sess.turn)}\nPilih kotak:`;
      await sendBoardText(sock, chatId, sess, message, intro);
    } else {
      // DM: main vs bot
      const bot = botJid(sock);
      if (!bot || !p1) return;
      // biarkan pemain sebagai X, bot sebagai O agar pemain mulai dulu
      const sess = createSession(p1, bot, { isDM: true, humanStarts: true });
      sessions.set(chatId, sess);
      installTurnTimer(sock, chatId, sess, logger);
      const intro = `Tic-Tac-Toe vs Bot dimulai!\nKamu: ${mentionOne(sess.players.X)} (X) | Bot: ${mentionOne(sess.players.O)} (O)\nGiliran: ${mentionOne(sess.turn)}\nPilih kotak:`;
      await sendBoardText(sock, chatId, sess, message, intro);
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
    '- Pilih kotak lewat daftar (List) yang dikirim bot.',
    '- Menyerah: !ttt resign (atau !ttt stop).',
    '- Giliran otomatis time-out dalam 2 menit.',
  ];
  await sock.sendMessage(message.key.remoteJid, { text: lines.join('\n') }, { quoted: message });
});

// Handler list selection: rowId = "!ttt-move <n>"
export async function tttHandleNumeric(sock, message, num, logger) {
  try {
    const chatId = message.key.remoteJid;
    const sess = sessions.get(chatId);
    if (!sess || sess.status !== 'in_progress') return false;
    const sender = senderJid(message);
    if (!areJidsSameUser(sender, sess.turn)) return false; // bukan gilirannya
    if (!(num >= 1 && num <= 9)) return false;
    const idx = num - 1;
    if (sess.board[idx] !== null) {
      await sendBoardText(sock, chatId, sess, message);
      return true;
    }
    const symbol = sess.turnSymbol; // 'X' atau 'O'
    sess.board[idx] = symbol;
    const outcome = checkOutcome(sess.board);
    if (outcome === 'X' || outcome === 'O') {
      const winner = sess.players[outcome];
      await endSession(sock, chatId, `Menang: ${mentionOne(winner)} (${outcome})\n${renderBoard(sess.board)}`);
      return true;
    }
    if (outcome === 'draw') {
      await endSession(sock, chatId, `Seri!\n${renderBoard(sess.board)}`);
      return true;
    }
    // Ganti giliran
    sess.turn = areJidsSameUser(sess.turn, sess.players.X) ? sess.players.O : sess.players.X;
    sess.turnSymbol = symbol === 'X' ? 'O' : 'X';
    resetTurnTimer(sock, chatId, sess);
    // Jika DM dan giliran bot, lakukan langkah bot otomatis
    if (sess.isDM && areJidsSameUser(sess.turn, sess.players.O)) {
      await botAutoMove(sock, chatId, sess, message);
      return true;
    }
    const msg = `Giliran: ${mentionOne(sess.turn)} (${sess.turnSymbol})`;
    await sendBoardText(sock, chatId, sess, message, msg);
    return true;
  } catch (err) {
    logger?.error?.({ err }, 'tttHandleNumeric error');
    return false;
  }
}

function createSession(p1, p2, opts = {}) {
  // Jika DM dan humanStarts = true, p1 jadi X
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

function endSession(sock, chatId, text) {
  const sess = sessions.get(chatId);
  if (sess?.timer) clearTimeout(sess.timer);
  sessions.delete(chatId);
  return sock.sendMessage(chatId, { text, mentions: sessionMentions(sess) });
}

export function tttHasSession(chatId) {
  return sessions.has(chatId);
}

function sessionMentions(sess) {
  if (!sess) return [];
  return [sess.players.X, sess.players.O];
}

function sendBoardText(sock, chatId, sess, quotedMsg, header = '') {
  const boardStr = renderBoard(sess.board);
  const hint = `Pilih kotak dengan mengetik: !1 s/d !9 (Giliran ${sess.turnSymbol})`;
  const text = [header, boardStr, hint].filter(Boolean).join('\n');
  return sock.sendMessage(
    chatId,
    { text, mentions: sessionMentions(sess) },
    quotedMsg ? { quoted: quotedMsg } : {},
  );
}

function renderBoard(b) {
  const cell = (i) => (b[i] ? b[i] : String(i + 1));
  const line = (a, b, c) => ` ${cell(a)} | ${cell(b)} | ${cell(c)} `;
  const sep = '---+---+---';
  return ['```', line(0, 1, 2), sep, line(3, 4, 5), sep, line(6, 7, 8), '```'].join('\n');
}

function availableMoves(b) {
  const out = [];
  for (let i = 0; i < 9; i++) if (!b[i]) out.push(i + 1);
  return out;
}

function checkOutcome(b) {
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
  // Di grup: participant; di DM: remoteJid
  return jidNormalizedUser(message.key.participant || message.key.remoteJid);
}

function isPlayer(sess, j) {
  return areJidsSameUser(j, sess.players.X) || areJidsSameUser(j, sess.players.O);
}

function mentionOne(j) {
  // tampilkan @<nomor>
  const node = (j || '').split('@')[0];
  return `@${node.split(':')[0]}`;
}

function isGroupJid(jid = '') {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function installTurnTimer(sock, chatId, sess, logger) {
  if (sess.timer) clearTimeout(sess.timer);
  sess.timer = setTimeout(() => {
    try {
      const loser = sess.turn;
      const winner = areJidsSameUser(loser, sess.players.X)
        ? sess.players.O
        : sess.players.X;
      endSession(sock, chatId, `Waktu habis! Pemenang: ${mentionOne(winner)}\n${renderBoard(sess.board)}`);
    } catch (e) {
      logger?.error?.({ e }, 'ttt timer error');
    }
  }, TURN_TIMEOUT_MS);
}

function resetTurnTimer(sock, chatId, sess) {
  if (sess.timer) clearTimeout(sess.timer);
  installTurnTimer(sock, chatId, sess);
}

function botJid(sock) {
  try {
    return jidNormalizedUser(sock?.user?.id);
  } catch {
    return '';
  }
}

async function botAutoMove(sock, chatId, sess, quotedMsg) {
  // Bot (O) memilih langkah: win > block > center > corner > first
  const b = sess.board;
  const pick =
    findWinningMove(b, 'O') ??
    findWinningMove(b, 'X') ??
    (b[4] ? null : 4) ??
    [0, 2, 6, 8].find((i) => !b[i]) ??
    b.findIndex((x) => !x);

  if (pick == null || pick < 0) {
    // tidak ada langkah?
    await sendBoardText(sock, chatId, sess, quotedMsg);
    return;
  }

  sess.board[pick] = 'O';
  const outcome = checkOutcome(sess.board);
  if (outcome === 'O') {
    endSession(sock, chatId, `Bot menang (O)!\n${renderBoard(sess.board)}`);
    return;
  }
  if (outcome === 'draw') {
    endSession(sock, chatId, `Seri!\n${renderBoard(sess.board)}`);
    return;
  }
  // kembalikan giliran ke manusia (X)
  sess.turn = sess.players.X;
  sess.turnSymbol = 'X';
  resetTurnTimer(sock, chatId, sess);
  await sendBoardText(sock, chatId, sess, quotedMsg, `Giliran: ${mentionOne(sess.turn)} (${sess.turnSymbol})`);
}

function findWinningMove(b, symbol) {
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
