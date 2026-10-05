import assert from 'node:assert/strict';
import test from 'node:test';
import { blightbringer } from '#gw2/platform/equipment/relics/rules/blightbringer.js';
import { visionary } from '#gw2/platform/equipment/relics/rules/visionary.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

// The payload cooldown gates consumption, not accumulation; its own effect-owned Poison cannot reenter progress.
test('Blightbringer counts distinct activations, banks at cap during ICD and resets before reward reactions', () => {
  const state = blightbringer.createState();
  const observations = [];
  const ctx = {
    effects: captureEffectEmissions({
      submit(event) {
        observations.push([state.count, state.readyAt]);
        blightbringer.condition(ctx, state, event, {});
        return event;
      }
    }).effects
  };
  const apply = (at, activationId, overrides = {}) =>
    blightbringer.condition(
      ctx,
      state,
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 10,
        at,
        activationId,
        actorType: 'player',
        ...overrides
      },
      {}
    );
  apply(0, 'excluded', { actorType: 'summon' });
  assert.equal(state.count, 0);
  apply(0, 'first');
  apply(0, 'first');
  assert.equal(state.count, 1);
  for (let i = 1; i <= 5; i++) apply(i, `first-cycle-${i}`);
  assert.equal(state.count, 0);
  assert.equal(state.readyAt, 13);
  assert.ok(observations.every(([count, readyAt]) => count === 0 && readyAt === 13));
  for (let i = 0; i < 8; i++) apply(6, `banked-${i}`);
  assert.equal(state.count, 6);
  apply(13, 'boundary');
  assert.equal(state.count, 6);
  apply(14, 'banked-0');
  assert.equal(state.count, 6, 'An already counted activation cannot release a banked reward');
  apply(14, 'release');
  assert.equal(state.count, 0);
  assert.equal(state.readyAt, 22);
  assert.deepEqual(observations.at(-1), [0, 22]);
});

// Buildup consumption must be visible before the new damage window, and historical queries retain the old window.
test('Visionary publishes its consumed counter before its reward and resumes buildup at expiry', () => {
  const state = visionary.createState();
  state.stacks = 7;
  const observations = [];
  const ctx = {
    effects: captureEffectEmissions({
      announce(request) {
        observations.push([request.announcement.name, state.stacks, state.windows.length]);
      }
    }).effects
  };
  const combo = { at: 1, actorType: 'player', finisherType: 'Blast' };
  visionary.combo(ctx, state, combo);
  assert.deepEqual(observations, [
    ['Relic of the Visionary', 0, 0],
    ["Vloxx's Vision", 0, 1]
  ]);
  const until = state.windows[0].until;
  visionary.combo(ctx, state, { ...combo, at: until - 0.001 });
  assert.equal(state.stacks, 0);
  visionary.combo(ctx, state, { ...combo, at: until });
  assert.equal(state.stacks, 1);
  assert.equal(visionary.outgoingDamageBonus(ctx, state, 'condition', 2), 0.1);
  assert.equal(visionary.outgoingDamageBonus(ctx, state, 'condition', until + 1), 0);
});
