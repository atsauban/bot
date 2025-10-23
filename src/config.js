import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultAuthFolder = path.resolve(__dirname, '..', 'storage', 'auth');
const authFolder = process.env.AUTH_FOLDER
  ? path.resolve(process.cwd(), process.env.AUTH_FOLDER)
  : defaultAuthFolder;

if (!fs.existsSync(authFolder)) {
  fs.mkdirSync(authFolder, { recursive: true });
}

const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

// Opsi pairing via nomor telepon (Link with phone number)
const rawPair = process.env.PAIR_PHONE_NUMBER || '';
const pairPhoneNumber = rawPair.replace(/[^\d]/g, '') || null; // hanya digit
const preferPairing = (
  process.env.PAIR_ON_START || (pairPhoneNumber ? 'true' : 'false')
).toLowerCase() === 'true';

// Metode otentikasi: 'auto' | 'pairing' | 'qr'
const authMethodEnv = (process.env.AUTH_METHOD || '').toLowerCase();
let authMethod = 'auto';
if (['pairing', 'qr', 'auto'].includes(authMethodEnv)) {
  authMethod = authMethodEnv;
} else if (preferPairing) {
  authMethod = 'pairing';
}

// Optional: peta LID -> PN untuk tampilan nomor (mis. "98385486971076=6287770929129,abcd@lid=62xxxx")
function parsePnMap(raw = '') {
  const out = Object.create(null);
  if (!raw) return out;
  try {
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      const key = normalizeKey(String(k));
      const val = String(v).replace(/[^\d]/g, '');
      if (key && val) out[key] = val;
    }
    return out;
  } catch {
    // format: a=b,c=d
    const pairs = raw.split(',');
    for (const p of pairs) {
      const [k, v] = p.split('=').map((s) => (s ?? '').trim());
      const key = normalizeKey(k);
      const val = (v || '').replace(/[^\d]/g, '');
      if (key && val) out[key] = val;
    }
    return out;
  }
}

function normalizeKey(jidOrNum = '') {
  const s = String(jidOrNum);
  if (!s) return '';
  if (/^\d+$/.test(s)) return s; // langsung angka
  const at = s.indexOf('@');
  const node = at > 0 ? s.slice(0, at) : s;
  return node.split(':')[0];
}

const pnMap = parsePnMap(process.env.PN_MAP || '');
const defaultCountryCode = (process.env.DEFAULT_COUNTRY_CODE || '62').replace(/[^\d]/g, '') || '62';
const groqApiKey = process.env.GROQ_API_KEY || '';
const aiModel = process.env.AI_MODEL || 'llama-3.1-8b-instant';

export default {
  authFolder,
  logLevel,
  pairPhoneNumber,
  preferPairing,
  authMethod,
  weatherApiKey: process.env.WEATHER_API_KEY || '',
  pnMap,
  defaultCountryCode,
  groqApiKey,
  aiModel,
};
