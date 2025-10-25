import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tttCheckOutcome, tttFindWinningMove } from '../src/features/game/game.command.js';

describe('TTT logic', () => {
  it('detects row win', () => {
    const b = ['X', 'X', 'X', null, null, null, null, null, null];
    assert.equal(tttCheckOutcome(b), 'X');
  });
  it('detects diag win', () => {
    const b = ['O', null, null, null, 'O', null, null, null, 'O'];
    assert.equal(tttCheckOutcome(b), 'O');
  });
  it('detects draw', () => {
    const b = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    assert.equal(tttCheckOutcome(b), 'draw');
  });
  it('finds winning move', () => {
    const b = ['X', 'X', null, null, 'O', null, null, null, 'O'];
    assert.equal(tttFindWinningMove(b, 'X'), 2);
  });
});
