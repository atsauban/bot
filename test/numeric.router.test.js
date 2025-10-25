import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import commandMap, { registerCommand } from '../src/core/commands.js';

// Ensure commands registry is initially clean for predictable checks

describe('numeric router', () => {
  before(async () => {
    // Import the numeric router side-effect to register !1.. !9
    await import('../src/features/game/numeric.router.js');
  });

  it('registers !1.. !9 commands', () => {
    for (let i = 1; i <= 9; i++) {
      assert.equal(typeof commandMap.get(`!${i}`), 'function', `!${i} not registered`);
    }
  });
});
