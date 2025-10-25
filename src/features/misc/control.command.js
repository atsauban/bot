import { registerCommand } from '../../core/commands.js';
import { botOnly } from '../../core/guards.js';
import {
  isGlobalEnabled,
  setGlobalEnabled,
  isChatEnabled,
  setChatEnabled,
} from '../../core/state.js';

registerCommand('!bot', async ({ sock, message, text }) => {
  if (!botOnly(message)) return; // hanya nomor bot sendiri
  const chatId = message.key.remoteJid;
  const args = String(text || '')
    .trim()
    .split(/\s+/)
    .slice(1);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'on') {
    setGlobalEnabled(true);
    await sock.sendMessage(chatId, { text: 'Bot global: ON ✅' }, { quoted: message });
    return;
  }
  if (sub === 'off') {
    setGlobalEnabled(false);
    await sock.sendMessage(chatId, { text: 'Bot global: OFF ⛔' }, { quoted: message });
    return;
  }
  if (sub === 'onhere' || sub === 'on-here') {
    setChatEnabled(chatId, true);
    await sock.sendMessage(chatId, { text: 'Bot di chat ini: ON ✅' }, { quoted: message });
    return;
  }
  if (sub === 'offhere' || sub === 'off-here') {
    setChatEnabled(chatId, false);
    await sock.sendMessage(chatId, { text: 'Bot di chat ini: OFF ⛔' }, { quoted: message });
    return;
  }
  // status (default)
  const g = isGlobalEnabled() ? 'ON ✅' : 'OFF ⛔';
  const c = isChatEnabled(chatId) ? 'ON ✅' : 'OFF ⛔';
  const lines = [
    'Status bot:',
    `• Global: ${g}`,
    `• Chat ini: ${c}`,
    '',
    'Perintah:',
    '- !bot on | !bot off',
    '- !bot onhere | !bot offhere',
  ];
  await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
});
