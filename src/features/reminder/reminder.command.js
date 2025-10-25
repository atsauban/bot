import { registerCommand } from '../../core/commands.js';
import { botOnly } from '../../core/guards.js';
import {
  addReminder,
  listPending,
  listPendingByChat,
  markSent,
  cancelReminder as dbCancel,
  getById,
} from '../../db/reminders.js';

let gSock = null;
let gLogger = console;
const timers = new Map();

export async function bindReminderScheduler(sock, logger = console) {
  gSock = sock;
  gLogger = logger || console;
  try {
    const all = await listPending();
    for (const doc of all) scheduleReminder(doc);
  } catch (e) {
    gLogger.error?.({ e }, 'bindReminderScheduler failed');
  }
}

registerCommand('!reminder', async ({ sock, message, text, logger }) => {
  try {
    if (!botOnly(message)) return;
    const chatId = message.key.remoteJid;
    const args = text.trim();
    const parsed = parseReminderArgs(args);
    if (!parsed) return;
    const { body, hh, mm } = parsed;
    const at = nextOccurrenceMs(hh, mm);
    const doc = await addReminder(chatId, body, at);
    scheduleReminder(doc, sock, logger);
    const hhStr = String(hh).padStart(2, '0');
    const mmStr = String(mm).padStart(2, '0');
    await sock.sendMessage(
      chatId,
      { text: `Reminder disetel: ${body}\nJam ${hhStr}:${mmStr}` },
      { quoted: message },
    );
  } catch (err) {
    logger?.error?.({ err }, '!reminder error');
  }
});

registerCommand('!reminder-list', async ({ sock, message, logger }) => {
  try {
    if (!botOnly(message)) return;
    const chatId = message.key.remoteJid;
    const rows = await listPendingByChat(chatId);
    if (!rows.length) return;
    const lines = ['Reminder pending:'];
    let idx = 1;
    for (const r of rows.slice(0, 20)) {
      const t = new Date(r.atMs);
      const hh = String(t.getHours()).padStart(2, '0');
      const mm = String(t.getMinutes()).padStart(2, '0');
      const d = String(t.getDate()).padStart(2, '0');
      const m = String(t.getMonth() + 1).padStart(2, '0');
      lines.push(`${idx}. [${d}/${m} ${hh}:${mm}] ${r.body} (id: ${r._id})`);
      idx++;
    }
    if (rows.length > 20) lines.push(`(+${rows.length - 20} lagi)`);
    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
  } catch (err) {
    logger?.error?.({ err }, '!reminder-list error');
  }
});

registerCommand('!reminder-cancel', async ({ sock, message, text, logger }) => {
  try {
    if (!botOnly(message)) return;
    const chatId = message.key.remoteJid;
    const arg = text.trim().split(/\s+/)[1];
    if (!arg) return;
    let targetId = arg;
    if (/^\d+$/.test(arg)) {
      const rows = await listPendingByChat(chatId);
      const idx = parseInt(arg, 10);
      if (idx >= 1 && idx <= rows.length) targetId = rows[idx - 1]._id;
      else return;
    }
    const doc = await getById(targetId);
    if (!doc || doc.chatJid !== chatId || doc.status !== 'pending') return;
    await dbCancel(targetId);
    cancelScheduled(targetId);
    await sock.sendMessage(
      chatId,
      { text: `Reminder dibatalkan: ${doc.body}` },
      { quoted: message },
    );
  } catch (err) {
    logger?.error?.({ err }, '!reminder-cancel error');
  }
});

function scheduleReminder(doc, sock, logger) {
  const useSock = sock || gSock;
  const useLogger = logger || gLogger;
  if (!useSock) return;
  const id = doc._id;
  if (timers.has(id)) return;
  const delay = Math.max(0, doc.atMs - Date.now());
  const timer = setTimeout(async () => {
    try {
      await useSock.sendMessage(doc.chatJid, { text: `Reminder: ${doc.body}` });
      await markSent(id);
    } catch (e) {
      useLogger?.error?.({ e }, 'reminder send failed');
    } finally {
      clearTimeout(timer);
      timers.delete(id);
    }
  }, delay);
  timers.set(id, timer);
}

function cancelScheduled(id) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

export function parseReminderArgs(fullText) {
  const parts = fullText.split(/\s+/);
  if (parts.length < 3) return null;
  if (parts[0].toLowerCase() !== '!reminder') return null;
  const timeToken = parts[parts.length - 1];
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeToken);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!(hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)) return null;
  const body = parts.slice(1, -1).join(' ').trim();
  if (!body) return null;
  return { body, hh, mm };
}

export function nextOccurrenceMs(hh, mm) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
}
