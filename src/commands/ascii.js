import figlet from 'figlet';
import { registerCommand } from './registry.js';

const figletFonts = {
  list: () => new Promise((resolve, reject) => figlet.fonts((e, f) => (e ? reject(e) : resolve(f)))),
  text: (str, opts) => new Promise((resolve, reject) => figlet.text(str, opts, (e, data) => (e ? reject(e) : resolve(data)))),
};

registerCommand('!ascii-list', async ({ sock, message, text, logger }) => {
  try {
    const filter = text.slice('!ascii-list'.length).trim().toLowerCase();
    const fonts = await figletFonts.list();
    const filtered = filter ? fonts.filter((f) => f.toLowerCase().includes(filter)) : fonts;

    const header = `Fonts (${filtered.length})${filter ? ` — filter: ${filter}` : ''}`;

    // Kirim semua font; pecah menjadi beberapa pesan jika terlalu panjang
    const joined = filtered.join(', ');
    const chunkSize = 3500;
    if (!joined) {
      await sock.sendMessage(message.key.remoteJid, { text: header + '\n(tidak ada yang cocok)' }, { quoted: message });
      return;
    }
    for (let i = 0; i < joined.length; i += chunkSize) {
      const prefix = i === 0 ? header + '\n' : '';
      const piece = joined.slice(i, i + chunkSize);
      await sock.sendMessage(message.key.remoteJid, { text: prefix + piece }, { quoted: message });
    }
  } catch (err) {
    logger?.error?.({ err }, '!ascii-list error');
  }
});

registerCommand('!ascii', async ({ sock, message, text, logger }) => {
  try {
    const args = text.trim().split(/\s+/).slice(1); // buang '!ascii'
    if (args.length < 2) return; // butuh minimal <font> <teks>

    const fonts = await figletFonts.list();
    const fontName = resolveFontFromArgs(args, fonts);
    if (!fontName) return; // silent jika font tidak ditemukan

    const usedTokens = fontName.split(/\s+/).length;
    const content = args.slice(usedTokens).join(' ').trim();
    if (!content) return;

    // batasi panjang input agar output tidak meledak
    const safeContent = content.slice(0, 48);
    const rendered = await figletFonts.text(safeContent, { font: fontName, horizontalLayout: 'default' });

    // batasi panjang pesan
    const maxChars = 3500;
    const out = rendered.length > maxChars ? rendered.slice(0, maxChars) : rendered;
    const monospaced = '```\n' + out + '\n```';
    await sock.sendMessage(message.key.remoteJid, { text: monospaced }, { quoted: message });
  } catch (err) {
    logger?.error?.({ err }, '!ascii error');
  }
});

function resolveFontFromArgs(args, fonts) {
  const lowerSet = new Set(fonts.map((f) => f.toLowerCase()));
  // cari prefix terpanjang yang match nama font (case-insensitive)
  for (let i = Math.min(args.length - 1, 4); i >= 1; i--) {
    const candidate = args.slice(0, i).join(' ');
    if (lowerSet.has(candidate.toLowerCase())) {
      // kembalikan nama font dengan kapitalisasi asli
      return fonts.find((f) => f.toLowerCase() === candidate.toLowerCase());
    }
  }
  // fallback: token pertama jika cocok persis
  const first = args[0];
  if (lowerSet.has(first.toLowerCase())) {
    return fonts.find((f) => f.toLowerCase() === first.toLowerCase());
  }
  return null;
}
