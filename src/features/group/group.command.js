import { registerCommand } from '../../core/commands.js';
import {
  areJidsSameUser,
  jidNormalizedUser,
  downloadContentFromMessage,
} from '@whiskeysockets/baileys';
import config from '../../core/config.js';
import {
  ensureAllowed,
  ensureSenderAdmin,
  canBotEditGroupInfo,
  isGroupJid,
} from '../../core/guards.js';
function displayNumberFromJid(jid = '') {
  const node = jid.split('@')[0] || '';
  return node.split(':')[0] || node;
}

async function toPnJid(sock, jid = '') {
  if (typeof jid !== 'string') return jid;
  if (jid.endsWith('@s.whatsapp.net')) return jid;
  if (!jid.endsWith('@lid')) return jid;
  try {
    const base = (jid.split('@')[0] || '').split(':')[0];
    if (!base) return jid;
    const mapped = config.pnMap?.[base];
    if (mapped) return `${mapped}@s.whatsapp.net`;
    const res1 = await sock.onWhatsApp(base);
    const j1 = Array.isArray(res1) && res1[0]?.jid;
    if (typeof j1 === 'string' && j1.endsWith('@s.whatsapp.net')) return j1;
    const res2 = await sock.onWhatsApp(jid);
    const j2 = Array.isArray(res2) && res2[0]?.jid;
    if (typeof j2 === 'string' && j2.endsWith('@s.whatsapp.net')) return j2;
    const norm = jidNormalizedUser(jid);
    if (norm.endsWith('@s.whatsapp.net')) return norm;
    return jid;
  } catch {
    return jid;
  }
}

async function displayPn(sock, jid = '') {
  const mapped = await toPnJid(sock, jid);
  return displayNumberFromJid(mapped);
}

// guards dipakai dari core/guards

registerCommand('!groupinfo', async ({ sock, message, logger }) => {
  try {
    const check = await ensureAllowed(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const meta = await sock.groupMetadata(jid);
    const subject = meta?.subject || 'Tanpa nama';
    const desc = meta?.desc || '';
    const size = meta?.participants?.length || 0;
    const owner = meta?.owner || meta?.author || '';
    const created = meta?.creation ? new Date(meta.creation * 1000) : null;
    const ownerNum = owner ? await displayPn(sock, owner) : '';
    const ownerTag = ownerNum ? `@${ownerNum}` : '-';
    const lines = [
      `Info Grup: ${subject}`,
      `ID: ${jid}`,
      `Owner: ${ownerTag}`,
      `Anggota: ${size}`,
      created ? `Dibuat: ${created.toLocaleString()}` : '',
      desc ? `Deskripsi:\n${desc}` : '',
    ].filter(Boolean);
    await sock.sendMessage(
      jid,
      { text: lines.join('\n'), mentions: owner ? [owner] : [] },
      { quoted: message },
    );
  } catch (err) {
    logger?.error?.({ err }, '!groupinfo error');
  }
});

registerCommand('!list', async ({ sock, message, logger }) => {
  try {
    const check = await ensureAllowed(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const meta = await sock.groupMetadata(jid);
    const members = meta?.participants || [];
    const mentions = members.map((m) => m.id);
    const nums = await Promise.all(members.map((m) => displayPn(sock, m.id)));
    const lines = nums.map((n) => `@${n}`);
    const text = lines.join(' ');
    const chunkSize = 3500;
    if (text.length <= chunkSize) {
      await sock.sendMessage(jid, { text, mentions }, { quoted: message });
    } else {
      for (let i = 0; i < lines.length; ) {
        let chunk = '';
        const chunkMentions = [];
        while (i < lines.length && (chunk + ' ' + lines[i]).length < chunkSize) {
          chunk += (chunk ? ' ' : '') + lines[i];
          chunkMentions.push(mentions[i]);
          i++;
        }
        await sock.sendMessage(jid, { text: chunk, mentions: chunkMentions }, { quoted: message });
      }
    }
  } catch (err) {
    logger?.error?.({ err }, '!list error');
  }
});

registerCommand('!setname', async ({ sock, message, text, logger }) => {
  try {
    const check = await ensureAllowed(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const name = text.slice('!setname'.length).trim();
    if (!name) return;
    const can = await canBotEditGroupInfo(sock, jid);
    if (!can) return;
    await sock.groupUpdateSubject(jid, name);
    await sock.sendMessage(jid, { text: 'Nama grup diperbarui ✅' }, { quoted: message });
  } catch (err) {
    logger?.error?.({ err }, '!setname error');
  }
});

registerCommand('!setdesc', async ({ sock, message, text, logger }) => {
  try {
    const check = await ensureAllowed(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const desc = text.slice('!setdesc'.length).trim();
    if (!desc) return;
    const can = await canBotEditGroupInfo(sock, jid);
    if (!can) return;
    await sock.groupUpdateDescription(jid, desc);
    await sock.sendMessage(jid, { text: 'Deskripsi grup diperbarui ✅' }, { quoted: message });
  } catch (err) {
    logger?.error?.({ err }, '!setdesc error');
  }
});

registerCommand('!setpic', async ({ sock, message, logger }) => {
  try {
    const check = await ensureAllowed(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const can = await canBotEditGroupInfo(sock, jid);
    if (!can) return;
    const msg = message.message;
    const img =
      msg?.imageMessage || msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (!img) return;
    const stream = await downloadContentFromMessage(img, 'image');
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const buffer = Buffer.concat(chunks);
    await sock.updateProfilePicture(jid, buffer);
    await sock.sendMessage(jid, { text: 'Foto grup diperbarui ✅' }, { quoted: message });
  } catch (err) {
    logger?.error?.({ err }, '!setpic error');
  }
});

registerCommand('!kick', async ({ sock, message, text, logger }) => {
  try {
    const check = await ensureSenderAdmin(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const rawTargets = await collectTargets(sock, message, parseNumbers(text));
    const targets = await filterTargetsByMembership(sock, jid, rawTargets, 'remove');
    if (targets.length === 0) return;
    try {
      for (const t of targets) {
        const pn = await displayPn(sock, t);
        const text = pn ? `@${pn} selamat tinggal 👋` : 'Selamat tinggal 👋';
        await sock.sendMessage(jid, { text, mentions: [t] }, { quoted: message });
      }
    } catch (e) {
      logger?.debug?.({ e }, 'Gagal mengirim pesan perpisahan sebelum kick');
    }
    await sock.groupParticipantsUpdate(jid, targets, 'remove');
  } catch (err) {
    logger?.error?.({ err }, '!kick error');
  }
});

registerCommand('!add', async ({ sock, message, text, logger }) => {
  try {
    const check = await ensureSenderAdmin(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const nums = parseNumbers(text);
    const all = nums.map(toUserJid).filter(Boolean);
    const targets = await filterTargetsByMembership(sock, jid, all, 'add');
    if (targets.length === 0) return;
    const res = await sock.groupParticipantsUpdate(jid, targets, 'add');
    const ok = res.filter((r) => r.status === '200').map((r) => r.jid);
    if (ok.length) {
      try {
        const nums = await Promise.all(ok.map((j) => displayPn(sock, j)));
        const tags = nums.map((n) => `@${n}`).join(' ');
        await sock.sendMessage(
          jid,
          { text: `Selamat datang ${tags} 🎉`, mentions: ok },
          { quoted: message },
        );
      } catch {}
    }
  } catch (err) {
    logger?.error?.({ err }, '!add error');
  }
});

registerCommand('!promote', async ({ sock, message, text, logger }) => {
  try {
    const check = await ensureSenderAdmin(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const rawTargets = await collectTargets(sock, message, parseNumbers(text));
    const targets = await filterTargetsByMembership(sock, jid, rawTargets, 'promote');
    if (targets.length === 0) return;
    const res = await sock.groupParticipantsUpdate(jid, targets, 'promote');
    const ok = res.filter((r) => r.status === '200').map((r) => r.jid);
    if (ok.length) {
      const nums = await Promise.all(ok.map((j) => displayPn(sock, j)));
      const tags = nums.map((n) => `@${n}`).join(' ');
      await sock.sendMessage(
        jid,
        { text: `${tags} admin sekarang`, mentions: ok },
        { quoted: message },
      );
    }
  } catch (err) {
    logger?.error?.({ err }, '!promote error');
  }
});

registerCommand('!demote', async ({ sock, message, text, logger }) => {
  try {
    const check = await ensureSenderAdmin(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const rawTargets = await collectTargets(sock, message, parseNumbers(text));
    const targets = await filterTargetsByMembership(sock, jid, rawTargets, 'demote');
    if (targets.length === 0) return;
    const res = await sock.groupParticipantsUpdate(jid, targets, 'demote');
    const ok = res.filter((r) => r.status === '200').map((r) => r.jid);
    if (ok.length) {
      const nums = await Promise.all(ok.map((j) => displayPn(sock, j)));
      const tags = nums.map((n) => `@${n}`).join(' ');
      await sock.sendMessage(
        jid,
        { text: `${tags} dikick dari atmin`, mentions: ok },
        { quoted: message },
      );
    }
  } catch (err) {
    logger?.error?.({ err }, '!demote error');
  }
});

function parseNumbers(text = '') {
  const m = String(text)
    .split(/\s|,|;/)
    .map((t) => t.replace(/[^\d]/g, ''))
    .filter((t) => t.length >= 5);
  return Array.from(new Set(m));
}
function toUserJid(num) {
  if (!num) return null;
  const norm = normalizeMsisdn(num, config.defaultCountryCode || '62');
  if (!norm) return null;
  return `${norm}@s.whatsapp.net`;
}
function normalizeMsisdn(num, cc = '62') {
  let n = String(num || '').replace(/[^\d]/g, '');
  if (n.length < 5) return null;
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith(cc)) return n;
  if (n.startsWith('0')) return cc + n.slice(1);
  if (n.startsWith('8')) return cc + n;
  return n;
}

async function collectTargets(sock, message, nums = []) {
  const set = new Set();
  const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  for (const j of mentions) if (typeof j === 'string') set.add(jidNormalizedUser(j));
  const ctx =
    message.message?.extendedTextMessage?.contextInfo ||
    message.message?.imageMessage?.contextInfo ||
    message.message?.videoMessage?.contextInfo ||
    null;
  const qp = ctx?.participant;
  if (qp) set.add(jidNormalizedUser(qp));
  for (const n of nums) {
    const j = toUserJid(n);
    if (j) set.add(j);
  }
  return Array.from(set);
}
function baseKey(jidOrNum = '') {
  const s = String(jidOrNum || '');
  const node = (s.includes('@') ? s.split('@')[0] : s).split(':')[0];
  return node.replace(/[^\d]/g, '');
}

async function filterTargetsByMembership(sock, groupJid, targetJids, action) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const parts = meta?.participants || [];
    const owner = meta?.owner || meta?.author || '';
    const me = sock?.user?.id ? jidNormalizedUser(sock.user.id) : '';
    const byId = new Map(parts.map((p) => [jidNormalizedUser(p.id), p]));
    const byBase = new Map(parts.map((p) => [baseKey(p.id), p]));
    const result = [];
    for (const j of targetJids) {
      const id = jidNormalizedUser(j);
      const p = byId.get(id) || byBase.get(baseKey(id));
      if (action === 'add') {
        if (!p) result.push(id);
        continue;
      }
      if (!p) {
        if (action === 'remove') {
          if (!areJidsSameUser(id, owner) && !areJidsSameUser(id, me)) result.push(id);
        }
        continue;
      }
      const role = p.role || p.admin;
      const isAdmin = role === 'admin' || role === 'superadmin' || role === true;
      if (action === 'remove') {
        if (areJidsSameUser(id, owner) || areJidsSameUser(id, me)) continue;
        result.push(p.id);
      } else if (action === 'promote') {
        if (!isAdmin) result.push(p.id);
      } else if (action === 'demote') {
        if (role === 'admin') result.push(p.id);
      }
    }
    return result;
  } catch {
    return [];
  }
}

registerCommand('!tagall', async ({ sock, message, logger }) => {
  try {
    const check = await ensureAllowed(sock, message, logger);
    if (!check.ok) return;
    const jid = message.key.remoteJid;
    const meta = await sock.groupMetadata(jid);
    const members = meta?.participants || [];
    if (members.length === 0) return;
    const mentions = members.map((m) => m.id);
    const nums = await Promise.all(members.map((m) => displayPn(sock, m.id)));
    const lines = nums.map((n) => `@${n}`);
    const text = lines.join(' ');
    const chunkSize = 3500;
    if (text.length <= chunkSize) {
      await sock.sendMessage(jid, { text, mentions }, { quoted: message });
    } else {
      for (let i = 0; i < lines.length; ) {
        let chunk = '';
        const chunkMentions = [];
        while (i < lines.length && (chunk + ' ' + lines[i]).length < chunkSize) {
          chunk += (chunk ? ' ' : '') + lines[i];
          chunkMentions.push(mentions[i]);
          i++;
        }
        await sock.sendMessage(jid, { text: chunk, mentions: chunkMentions }, { quoted: message });
      }
    }
  } catch (err) {
    logger?.error?.({ err }, '!tagall error');
  }
});
