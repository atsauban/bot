import { registerCommand } from '../../core/commands.js';
import config from '../../core/config.js';

// Sesi Akinator per chat
const akiSessions = new Map(); // chatId -> { aki, lang }

const ANSWERS = [
  { n: 1, label: 'Ya', idx: 0 },
  { n: 2, label: 'Tidak', idx: 1 },
  { n: 3, label: 'Tidak tahu', idx: 2 },
  { n: 4, label: 'Mungkin', idx: 3 },
  { n: 5, label: 'Mungkin tidak', idx: 4 },
];

function normalizeLang(token) {
  const t = (token || '').toLowerCase();
  const allowed = new Set([
    'en',
    'ar',
    'cn',
    'de',
    'es',
    'fr',
    'il',
    'it',
    'jp',
    'kr',
    'nl',
    'pl',
    'pt',
    'ru',
    'tr',
    'id',
  ]);
  if (allowed.has(t)) return t;
  return config.akiDefaultRegion || 'en';
}

async function loadAki() {
  const mod = await import('aki-api').catch(() => null);
  if (!mod) throw new Error('aki-api not installed');
  const m = mod.default || mod;
  const Aki = m.Aki || m; // some versions export class as default
  if (!Aki) throw new Error('Aki class not found');
  return Aki;
}

registerCommand('!akinator', async ({ sock, message, text, logger }) => {
  try {
    const chatId = message.key.remoteJid;
    const arg = text.trim().split(/\s+/)[1] || '';
    const sub = arg.toLowerCase();

    if (sub === 'stop' || sub === 'end' || sub === 'quit') {
      if (akiSessions.has(chatId)) akiSessions.delete(chatId);
      // feedback singkat, agar user tahu sesi berakhir
      await sock.sendMessage(chatId, { text: 'Akinator dihentikan.' }, { quoted: message });
      return;
    }

    if (sub === 'back') {
      const sess = akiSessions.get(chatId);
      if (!sess) return;
      try {
        if (sess.aki.back) await sess.aki.back();
        else if (sess.aki.undoStep) await sess.aki.undoStep();
      } catch {}
      await sendQuestion(sock, chatId, sess, message);
      return;
    }

    if (akiSessions.has(chatId)) {
      // sudah ada sesi — tampilkan pertanyaan saat ini
      const sess = akiSessions.get(chatId);
      await sendQuestion(sock, chatId, sess, message);
      return;
    }

    const initialRegion = normalizeLang(arg || config.akiDefaultRegion);
    const Aki = await loadAki();
    const tried = new Set();
    const order = [initialRegion, 'id', 'es', 'fr', 'de', 'pt', 'tr', 'ru', 'nl'];
    let sess = null;
    for (const r of order) {
      if (tried.has(r)) continue;
      tried.add(r);
      try {
        const s = await startAkiSession(Aki, r, logger);
        sess = s;
        break;
      } catch (e) {
        // coba region lain jika 403 atau error jaringan
        if (e?.response?.status !== 403 && e?.status !== 403) {
          // untuk error selain 403, tidak ada gunanya mencoba region lain
          throw e;
        }
        logger?.warn?.(
          { region: r },
          'Akinator start blocked for this region (403). Trying next...',
        );
      }
    }
    if (!sess) throw new Error('Akinator blocked (403) for all fallback regions');
    akiSessions.set(chatId, sess);
    await sendQuestion(sock, chatId, sess, message, 'Akinator dimulai!');
  } catch (err) {
    logger?.error?.({ err }, '!akinator error');
  }
});

async function startAkiSession(Aki, region, logger) {
  // Buat instance tanpa proxy internal (agar bisa dukung SOCKS juga)
  const aki = new Aki({ region, childMode: false });
  const origin = `https://${region}.akinator.com`;
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: origin + '/game',
    Origin: origin,
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
  };
  aki.config = { ...(aki.config || {}), headers };
  const proxyUrl = config.akiProxy;
  if (proxyUrl) {
    try {
      const agent = await buildProxyAgent(proxyUrl);
      aki.config = { ...(aki.config || {}), httpsAgent: agent, proxy: false, headers };
    } catch (e) {
      logger?.warn?.({ e }, 'Gagal membangun proxy agent untuk Akinator');
    }
  }
  await aki.start();
  return { aki, lang: region };
}

async function buildProxyAgent(proxyUrl) {
  const u = new URL(proxyUrl);
  if (u.protocol.startsWith('socks')) {
    const mod = await import('socks-proxy-agent');
    const SocksProxyAgent = mod.SocksProxyAgent || mod.default || mod;
    return new SocksProxyAgent(proxyUrl);
  }
  const mod = await import('https-proxy-agent');
  const HttpsProxyAgent = mod.HttpsProxyAgent || mod.default || mod;
  return new HttpsProxyAgent(proxyUrl);
}

async function sendQuestion(sock, chatId, sess, quoted, header = '') {
  const q = sess.aki.question || '(pertanyaan tidak tersedia)';
  const step = sess.aki.currentStep || 0;
  const prog = Math.round(sess.aki.progress || 0);
  const lines = [
    header,
    `Pertanyaan #${step + 1} — Progres ${prog}%`,
    `Q: ${q}`,
    '',
    'Jawab dengan:',
    ANSWERS.map((a) => `!${a.n} = ${a.label}`).join(' | '),
    '',
    'Perintah: !akinator back | !akinator stop',
  ].filter(Boolean);
  await sock.sendMessage(chatId, { text: lines.join('\n') }, quoted ? { quoted } : {});
}

export async function akinatorHandleNumeric(sock, message, n, logger) {
  try {
    const chatId = message.key.remoteJid;
    const sess = akiSessions.get(chatId);
    if (!sess) return false;
    const ans = ANSWERS.find((a) => a.n === n);
    if (!ans) return true;
    await sess.aki.step(ans.idx);
    // cek apakah cukup untuk menebak
    const prog = Number(sess.aki.progress || 0);
    if (prog >= 90 || (sess.aki.currentStep || 0) > 60) {
      try {
        const g = await sess.aki.win();
        akiSessions.delete(chatId);
        const first = g?.answers?.[0];
        if (first?.absolute_picture_path) {
          await sock.sendMessage(
            chatId,
            {
              image: { url: first.absolute_picture_path },
              caption: `Jawabanku: ${first.name}\n${first.description || ''}`.trim(),
            },
            { quoted: message },
          );
        } else {
          await sock.sendMessage(
            chatId,
            {
              text: `Jawabanku: ${first?.name || 'Tidak diketahui'}\n${first?.description || ''}`.trim(),
            },
            { quoted: message },
          );
        }
      } catch (e) {
        logger?.error?.({ e }, 'akinator win() failed');
        akiSessions.delete(chatId);
      }
      return true;
    }
    await sendQuestion(sock, chatId, sess, message);
    return true;
  } catch (err) {
    logger?.error?.({ err }, 'akinatorHandleNumeric error');
    return false;
  }
}

export function akinatorHasSession(chatId) {
  return akiSessions.has(chatId);
}
