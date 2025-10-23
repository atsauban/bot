const commandMap = new Map();

export function registerCommand(name, handler) {
  commandMap.set(String(name || '').toLowerCase(), handler);
}

export function findCommand(text = '') {
  const key = String(text).trim().split(/\s+/)[0]?.toLowerCase();
  return commandMap.get(key);
}

export default commandMap;

