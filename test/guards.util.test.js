import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMsisdn, toUserJid } from '../src/core/guards.js';

describe('guards msisdn util', () => {
  it('normalizes Indonesian numbers', () => {
    assert.equal(normalizeMsisdn('08123456789'), '628123456789');
    assert.equal(normalizeMsisdn('8123456789'), '628123456789');
    assert.equal(normalizeMsisdn('628123456789'), '628123456789');
  });
  it('removes 00 international prefix', () => {
    assert.equal(normalizeMsisdn('0044123456789'), '44123456789');
  });
  it('toUserJid builds @s.whatsapp.net', () => {
    assert.equal(toUserJid('08123456789'), '628123456789@s.whatsapp.net');
  });
});
