import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseReminderArgs, nextOccurrenceMs } from '../src/features/reminder/reminder.command.js';

describe('reminder utils', () => {
  it('parses valid args', () => {
    const r = parseReminderArgs('!reminder makan 13:45');
    assert.equal(r.body, 'makan');
    assert.equal(r.hh, 13);
    assert.equal(r.mm, 45);
  });
  it('rejects invalid format', () => {
    assert.equal(parseReminderArgs('!reminder salah'), null);
    assert.equal(parseReminderArgs('!reminder 99:99'), null);
  });
  it('next occurrence is in future (<= 24h ahead)', () => {
    const now = new Date();
    const plus = new Date(now.getTime() + 60 * 1000); // +1 menit dari sekarang
    const hh = plus.getHours();
    const mm = plus.getMinutes();
    const ms = nextOccurrenceMs(hh, mm);
    const diff = ms - Date.now();
    assert.ok(diff > 0 && diff <= 24 * 3600 * 1000);
  });
});
