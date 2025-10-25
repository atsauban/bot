import { areJidsSameUser, jidNormalizedUser } from '@whiskeysockets/baileys';
import config from './config.js';

export function isGroupJid(jid = '') {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

export function botOnly(message) {
  return Boolean(message?.key?.fromMe);
}

export async function isAdmin(sock, groupJid, participantJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const p = meta?.participants?.find((x) => areJidsSameUser(x?.id, participantJid));
    if (!p) return false;
    return Boolean(p?.admin) || p?.role === 'admin' || p?.role === 'superadmin';
  } catch {
    return false;
  }
}

export async function ensureAllowed(sock, message, logger) {
  const jid = message.key.remoteJid;
  if (!isGroupJid(jid)) return { ok: false, reason: 'not-group' };
  if (message.key.fromMe) return { ok: true };
  const participant = message.key.participant || message.participant || '';
  const allowed = participant ? await isAdmin(sock, jid, participant) : false;
  if (!allowed) logger?.debug?.({ participant }, 'Group command rejected (not admin)');
  return { ok: allowed };
}

export async function ensureSenderAdmin(sock, message, logger) {
  const jid = message.key.remoteJid;
  if (!isGroupJid(jid)) return { ok: false, reason: 'not-group' };
  const participant = message.key.participant || message.participant || '';
  const allowed = participant ? await isAdmin(sock, jid, participant) : false;
  if (!allowed) logger?.debug?.({ participant }, 'Admin-only group command rejected');
  return { ok: allowed };
}

export async function isBotAdminInGroup(sock, jid) {
  try {
    const me = sock?.user?.id ? jidNormalizedUser(sock.user.id) : undefined;
    if (!me) return false;
    return await isAdmin(sock, jid, me);
  } catch {
    return false;
  }
}

export async function canBotEditGroupInfo(sock, jid) {
  try {
    const meta = await sock.groupMetadata(jid);
    const restrict = Boolean(meta?.restrict);
    if (!restrict) return true;
    return await isBotAdminInGroup(sock, jid);
  } catch {
    return false;
  }
}

export function toUserJid(num) {
  if (!num) return null;
  const norm = normalizeMsisdn(num, config.defaultCountryCode || '62');
  if (!norm) return null;
  return `${norm}@s.whatsapp.net`;
}

export function normalizeMsisdn(num, cc = '62') {
  let n = String(num || '').replace(/[^\d]/g, '');
  if (n.length < 5) return null;
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith(cc)) return n;
  if (n.startsWith('0')) return cc + n.slice(1);
  if (n.startsWith('8')) return cc + n;
  return n;
}
