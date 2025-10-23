import config from '../config.js';
import { registerCommand } from './registry.js';

registerCommand('!ai', async ({ sock, message, text, logger }) => {
  try {
    // Bot-only untuk menghindari penyalahgunaan
    if (!message.key?.fromMe) return;
    if (!config.groqApiKey) return;

    const prompt = text.replace(/^!ai\s*/i, '').trim();
    if (!prompt) return;

    const model = config.aiModel || 'llama-3.1-8b-instant';
    const body = {
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger?.error?.({ status: res.status, data }, '!ai request failed');
      return;
    }
    const content = data?.choices?.[0]?.message?.content || '';
    if (!content) return;

    const chunks = chunkText(content, 3500);
    for (let i = 0; i < chunks.length; i++) {
      const part = chunks[i];
      await sock.sendMessage(message.key.remoteJid, { text: part }, { quoted: message });
      await delay(100);
    }
  } catch (err) {
    logger?.error?.({ err }, '!ai error');
  }
});

function chunkText(s, size) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    out.push(s.slice(i, i + size));
    i += size;
  }
  return out;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

