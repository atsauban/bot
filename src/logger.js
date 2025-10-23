import pino from 'pino';

// Logger lebih ringkas: pretty-print bila di terminal, dan
// sembunyikan field yang tidak penting agar log penting lebih terlihat.
export default function createLogger(level = 'info') {
  const isTTY = process.stdout.isTTY;

  if (isTTY) {
    // Gunakan pino-pretty untuk output yang mudah dibaca saat interaktif
    const transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    });
    return pino({ level }, transport);
  }

  // Fallback JSON (mis. saat dijalankan via PM2 tanpa TTY)
  return pino({
    level,
    base: undefined,
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    messageKey: 'msg',
  });
}
