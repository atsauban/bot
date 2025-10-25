import os from 'node:os';
import { execFile } from 'node:child_process';
import { registerCommand } from '../../core/commands.js';

registerCommand('!status', async ({ sock, message, logger }) => {
  try {
    const text = await buildStatusText();
    await sock.sendMessage(message.key.remoteJid, { text }, { quoted: message });
  } catch (err) {
    logger?.error?.({ err }, 'Gagal menyiapkan status server');
  }
});

async function buildStatusText() {
  const [cpuPct, totalMem, freeMem, load, host, platform, arch, disk] = await Promise.all([
    cpuUsagePercent(250),
    Promise.resolve(os.totalmem()),
    Promise.resolve(os.freemem()),
    Promise.resolve(os.loadavg()),
    Promise.resolve(os.hostname()),
    Promise.resolve(process.platform),
    Promise.resolve(process.arch),
    getDiskUsage('/'),
  ]);

  const usedMem = totalMem - freeMem;
  const usedPct = (usedMem / totalMem) * 100;
  const serverUp = os.uptime();
  const procUp = process.uptime();

  const cpuBar = bar10(cpuPct);
  const ramBar = bar10(usedPct);
  const diskLine = disk
    ? `🗄️ Disk: ${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)} (${disk.percent.toFixed(1)}%) ${bar10(disk.percent)}`
    : '🗄️ Disk: n/a';

  const lines = [
    `📊 Status Server — ${host}`,
    `🖥️ OS: ${platform}/${arch} | Node ${process.versions.node}`,
    `⏱️ Uptime: ${formatDuration(serverUp)} (server) | ${formatDuration(procUp)} (bot)`,
    `🧠 CPU: ${cpuPct.toFixed(1)}% ${cpuBar} | Load: ${load.map((v) => v.toFixed(2)).join(' / ')}`,
    `💾 RAM: ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${usedPct.toFixed(1)}%) ${ramBar}`,
    diskLine,
  ];
  return lines.join('\n');
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[i]}`;
}

function formatDuration(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h || parts.length) parts.push(`${h}h`);
  if (m || parts.length) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function cpuTimesSum() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.irq + times.idle;
  }
  return { idle, total };
}

async function cpuUsagePercent(sampleMs = 200) {
  const start = cpuTimesSum();
  await new Promise((r) => setTimeout(r, sampleMs));
  const end = cpuTimesSum();
  const idle = end.idle - start.idle;
  const total = end.total - start.total;
  if (total <= 0) return 0;
  return (1 - idle / total) * 100;
}

export function bar10(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((p / 100) * 10);
  const on = '█'.repeat(filled);
  const off = '░'.repeat(10 - filled);
  return `[${on}${off}]`;
}

function execFileAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

async function getDiskUsage(mountPoint = '/') {
  try {
    const { stdout } = await execFileAsync('df', ['-kP', mountPoint]);
    const lines = stdout.trim().split(/\n/);
    if (lines.length < 2) return null;
    const cols = lines[1].trim().split(/\s+/);
    const totalK = parseInt(cols[1], 10);
    const usedK = parseInt(cols[2], 10);
    if (!isFinite(totalK) || !isFinite(usedK)) return null;
    const totalBytes = totalK * 1024;
    const usedBytes = usedK * 1024;
    const percent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
    return { totalBytes, usedBytes, percent };
  } catch {
    return null;
  }
}
