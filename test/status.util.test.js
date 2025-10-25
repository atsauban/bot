import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bar10 } from '../src/features/system/status.command.js';

describe('status util bar10', () => {
  it('caps at 0%', () => {
    assert.equal(bar10(-5), '[░░░░░░░░░░]');
  });
  it('caps at 100%', () => {
    assert.equal(bar10(150), '[██████████]');
  });
  it('rounds reasonably', () => {
    // 35% ~ 4 filled (rounded)
    assert.equal(bar10(35), '[████░░░░░░]');
  });
});
