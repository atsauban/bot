import config from '../config.js';
import { registerCommand } from './registry.js';

registerCommand('!weather', async ({ sock, message, text, logger }) => {
  try {
    const query = text.slice('!weather'.length).trim();
    if (!query) return; // silent jika tidak ada lokasi
    if (!config.weatherApiKey) {
      logger?.error?.('WEATHER_API_KEY belum diset. Abaikan !weather');
      return;
    }

    const url = new URL('https://api.weatherapi.com/v1/current.json');
    url.searchParams.set('key', config.weatherApiKey);
    url.searchParams.set('q', query);
    url.searchParams.set('aqi', 'no');
    url.searchParams.set('lang', 'id');

    const data = await fetchJSON(url.toString());
    if (!data?.location || !data?.current) return;

    const loc = data.location;
    const cur = data.current;
    const cond = cur.condition?.text ?? 'N/A';
    const emoji = weatherEmoji(cond, cur.is_day);
    const maps = (loc.lat != null && loc.lon != null)
      ? `https://maps.google.com/?q=${loc.lat},${loc.lon}`
      : '';
    const lines = [
      `${emoji} Cuaca — ${loc.name}${loc.region ? ', ' + loc.region : ''}, ${loc.country}`,
      `• Kondisi: ${cond}`,
      `• 🌡️ Suhu: ${fmtNum(cur.temp_c)}°C (Terasa: ${fmtNum(cur.feelslike_c)}°C)`,
      `• 💧 Kelembapan: ${fmtNum(cur.humidity)}%`,
      `• 🌬️ Angin: ${fmtNum(cur.wind_kph)} kph ${cur.wind_dir ?? ''}`,
      `• 🕒 Update: ${loc.localtime ?? cur.last_updated ?? ''}`,
      maps ? `• 📍 Lokasi: ${maps}` : '',
    ].filter(Boolean);

    await sock.sendMessage(message.key.remoteJid, { text: lines.join('\n') }, { quoted: message });
  } catch (err) {
    // Silent ke user, log internal saja
console?.error?.('!weather error', err);
  }
});

// Gabungkan juga command !forecast di file ini
registerCommand('!forecast', async ({ sock, message, text, logger }) => {
  try {
    let q = text.slice('!forecast'.length).trim();
    if (!q) return; // silent jika kosong

    // cek token terakhir angka untuk jumlah hari
    let days = 3;
    const parts = q.split(/\s+/);
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) {
      days = Math.min(3, Math.max(1, parseInt(last, 10)));
      parts.pop();
      q = parts.join(' ').trim();
    }
    if (!q) return; // lokasi wajib

    if (!config.weatherApiKey) {
      logger?.error?.('WEATHER_API_KEY belum diset. Abaikan !forecast');
      return;
    }

    const url = new URL('https://api.weatherapi.com/v1/forecast.json');
    url.searchParams.set('key', config.weatherApiKey);
    url.searchParams.set('q', q);
    url.searchParams.set('days', String(days));
    url.searchParams.set('aqi', 'no');
    url.searchParams.set('alerts', 'no');
    url.searchParams.set('lang', 'id');

    const data = await fetchJSON(url.toString());
    if (!data?.location || !data?.forecast?.forecastday) return;

    const loc = data.location;
    const list = data.forecast.forecastday;
    const title = `📅 Prakiraan ${list.length} Hari — ${loc.name}${loc.region ? ', ' + loc.region : ''}, ${loc.country}`;
    const lines = [title];
    for (const day of list) {
      const d = new Date(day.date);
      const dateStr = `${weekdayID(d.getDay())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
      const dd = day.day || {};
      const cond = dd.condition?.text ?? 'N/A';
      const icon = weatherEmoji(cond, 1);
      const tmax = fmtNum(dd.maxtemp_c);
      const tmin = fmtNum(dd.mintemp_c);
      const rain = Number(dd.daily_chance_of_rain ?? 0);
      const precip = fmtNum(dd.totalprecip_mm ?? 0);
      lines.push(`${icon} ${dateStr} — ${cond} | 🌡️ ${tmax}/${tmin}°C | 🌧️ ${rain}% (${precip} mm)`);
    }

    await sock.sendMessage(message.key.remoteJid, { text: lines.join('\n') }, { quoted: message });
  } catch (err) {
    console?.error?.('!forecast error', err);
  }
});

function fmtNum(n) {
  return Number.isFinite(Number(n)) ? Number(n).toFixed(1).replace(/\.0$/, '') : 'N/A';
}

function pad2(n) { return String(n).padStart(2, '0'); }
function weekdayID(i) {
  return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][i] ?? '';
}

function weatherEmoji(cond = '', isDay = 1) {
  const c = cond.toLowerCase();
  if (/thunder|petir|badai|storm/.test(c)) return '⛈️';
  if (/rain|hujan|drizzle|shower/.test(c)) return '🌧️';
  if (/snow|salju|sleet|blizzard/.test(c)) return '❄️';
  if (/fog|kabut|mist|haze|smoke/.test(c)) return '🌫️';
  if (/overcast|mendung/.test(c)) return '☁️';
  if (/cloud|berawan/.test(c)) return '⛅';
  if (/clear|cerah|sunny/.test(c)) return isDay ? '☀️' : '🌙';
  return isDay ? '🌤️' : '🌙';
}

async function fetchJSON(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'bot/1.0 (+weather)' },
      signal: controller.signal,
      ...opts,
    });
    const text = await res.text();
    if (!res.ok) {
      try {
        const j = JSON.parse(text);
        const msg = j?.error?.message || text || `HTTP ${res.status}`;
        throw new Error(`HTTP ${res.status}: ${msg}`);
      } catch {
        throw new Error(`HTTP ${res.status}: ${text || 'Unknown error'}`);
      }
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}
