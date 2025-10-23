import fs from 'node:fs';
import path from 'node:path';
import Datastore from 'nedb-promises';

const DATA_DIR = path.resolve(process.cwd(), 'storage', 'data');
const DB_FILE = path.join(DATA_DIR, 'reminders.db');

ensureDir(DATA_DIR);

const db = Datastore.create({ filename: DB_FILE, autoload: true });
db.ensureIndex({ fieldName: 'status' });
db.ensureIndex({ fieldName: 'atMs' });
db.ensureIndex({ fieldName: 'chatJid' });

export async function addReminder(chatJid, body, atMs) {
  const doc = {
    chatJid,
    body,
    atMs,
    status: 'pending',
    createdAt: Date.now(),
    sentAt: null,
  };
  const res = await db.insert(doc);
  return res; // contains _id
}

export async function listPending() {
  return db.find({ status: 'pending' });
}

export async function listPendingByChat(chatJid) {
  const rows = await db.find({ status: 'pending', chatJid });
  return rows.sort((a, b) => a.atMs - b.atMs);
}

export async function listPendingDue(now = Date.now()) {
  return db.find({ status: 'pending', atMs: { $lte: now } });
}

export async function listPendingFuture(now = Date.now()) {
  return db.find({ status: 'pending', atMs: { $gt: now } });
}

export async function markSent(id) {
  return db.update({ _id: id }, { $set: { status: 'sent', sentAt: Date.now() } }, {});
}

export async function cancelReminder(id) {
  return db.update({ _id: id }, { $set: { status: 'cancelled' } }, {});
}

export async function getById(id) {
  return db.findOne({ _id: id });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export default {
  addReminder,
  listPending,
  listPendingByChat,
  listPendingDue,
  listPendingFuture,
  markSent,
  cancelReminder,
  getById,
};
