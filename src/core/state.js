import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'storage', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

let state = {
  globalEnabled: true,
  chatDisabled: [], // array of chat JIDs disabled
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  try {
    ensureDir(DATA_DIR);
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state = {
        globalEnabled: Boolean(parsed.globalEnabled ?? true),
        chatDisabled: Array.isArray(parsed.chatDisabled) ? parsed.chatDisabled : [],
      };
    }
  } catch {
    // ignore
  }
}

function save() {
  try {
    ensureDir(DATA_DIR);
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // ignore persistence errors
  }
}

load();

export function isGlobalEnabled() {
  return !!state.globalEnabled;
}

export function setGlobalEnabled(enabled) {
  state.globalEnabled = !!enabled;
  save();
}

export function isChatEnabled(chatId) {
  return !state.chatDisabled.includes(chatId);
}

export function setChatEnabled(chatId, enabled) {
  const idx = state.chatDisabled.indexOf(chatId);
  if (enabled) {
    if (idx >= 0) state.chatDisabled.splice(idx, 1);
  } else if (idx < 0) {
    state.chatDisabled.push(chatId);
  }
  save();
}

export function isWhitelistedCommand(text) {
  const key = String(text || '')
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase();
  return key === '!bot';
}

export function shouldProcess(text, chatId) {
  if (isWhitelistedCommand(text)) return true;
  return isGlobalEnabled() && isChatEnabled(chatId);
}

export default {
  isGlobalEnabled,
  setGlobalEnabled,
  isChatEnabled,
  setChatEnabled,
  isWhitelistedCommand,
  shouldProcess,
};
