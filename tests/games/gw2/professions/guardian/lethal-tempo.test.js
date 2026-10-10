import { lethalTempo } from '#gw2/professions/guardian/specializations/willbender/traits/index.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import {
  activeLethalTempo,
  lethalTempoParameters
} from '#gw2/professions/guardian/specializations/willbender/traits/behavior.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('Lethal Tempo uses patched caps and trait windows without sharing phase state', () => {
  // Minimal trait profiles still cross the same construction boundary as selected catalogs.
  const catalog = createCanonicalCatalog({
    balanceProfiles: [
      {
        id: TRAIT.LETHAL_TEMPO,
        name: 'Lethal Tempo',
        profileKind: 'trait',
        maximumStacks: 5,
        effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', stacks: 2, duration: 9 }]
      },
      {
        id: TRAIT.TYRANTS_MOMENTUM,
        name: "Tyrant's Momentum",
        profileKind: 'trait',
        effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', stacks: 3, duration: 3 }]
      }
    ]
  });
  for (const [traits, duration, stacks] of [
    [[], 9, 2],
    [[TRAIT.TYRANTS_MOMENTUM], 3, 3]
  ]) {
    const parameters = lethalTempoParameters({ catalog, traits: new Set(traits) });
    assert.deepEqual(parameters, { maximumStacks: 5, duration, stacks });
    const scheduler = { lethalTempo: { stacks: 0, expiresAt: 0 } };
    const resolver = { ...scheduler };
    // Grants refresh at the cap through expiry; only a later grant starts a new stack window.
    assert.equal(grantTempo(scheduler, 0, parameters), stacks);
    assert.equal(grantTempo(scheduler, 1, parameters), Math.min(5, stacks * 2));
    assert.equal(grantTempo(scheduler, 2, parameters), 5);
    assert.equal(activeLethalTempo(scheduler, 2 + duration), 5);
    assert.equal(grantTempo(scheduler, 2 + duration, parameters), 5);
    assert.equal(grantTempo(scheduler, 2 + 2 * duration + 0.000001, parameters), stacks);
    assert.equal(grantTempo(resolver, 1, parameters), stacks);
    assert.equal(resolver.lethalTempo.expiresAt, 1 + duration);
  }
});

test('Lethal Tempo refreshes existing stacks through its rounded expiry tick', () => {
  const parameters = { maximumStacks: 5, duration: 6, stacks: 1 };
  for (const at of [6.001, 6.02, 6.039999, 6.04, 6.040001]) {
    const state = { lethalTempo: { stacks: 0, expiresAt: 0 } };
    assert.equal(activeLethalTempo(state, 0), 0);
    grantTempo(state, 0.001, parameters);
    grantTempo(state, 0.001, parameters);
    assert.equal(state.lethalTempo.expiresAt, 6.04);
    assert.equal(activeLethalTempo(state, at), at <= 6.04 ? 2 : 0);
    assert.equal(grantTempo(state, at, parameters), at <= 6.04 ? 3 : 1);
  }
});

/** Exercise the public trait boundary so stack lifetime tests do not require exporting its private reaction. */
function grantTempo(state, at, parameters) {
  const catalog = createCanonicalCatalog({
    balanceProfiles: [
      {
        id: TRAIT.LETHAL_TEMPO,
        name: 'Lethal Tempo',
        profileKind: 'trait',
        maximumStacks: parameters.maximumStacks,
        effects: [
          {
            type: 'buff',
            name: 'lethal-tempo',
            kind: 'lethal-tempo',
            stacks: parameters.stacks,
            duration: parameters.duration
          }
        ]
      }
    ]
  });
  const runtime = {
    time: at,
    catalog,
    traits: new Set(),
    profession: { specialization: { kind: 'Willbender', state } },
    effects: { emit() {} }
  };
  lethalTempo.triggers
    .find((trigger) => trigger.on.id === 'guardian.willbender-virtue-opened')
    .run(runtime, { cause: { at, skillName: 'Fixture' } });
  return state.lethalTempo.stacks;
}

// Supplied state is an absolute count even when ordinary triggers grant multiple stacks.
test('Lethal Tempo initialization does not multiply imported stacks by the selected grant', () => {
  const catalog = createCanonicalCatalog({
    balanceProfiles: [
      {
        id: TRAIT.LETHAL_TEMPO,
        name: 'Lethal Tempo',
        profileKind: 'trait',
        maximumStacks: 5,
        effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', duration: 6, stacks: 3 }]
      }
    ]
  });
  const state = { lethalTempo: { stacks: 0, expiresAt: 0 } };
  lethalTempo.hooks.initialize({
    time: 0,
    catalog,
    traits: new Set(),
    config: { initialBuffs: [{ kind: 'lethal-tempo', stacks: 2, duration: 20 }] },
    profession: { specialization: { kind: 'Willbender', state } }
  });
  assert.deepEqual(state.lethalTempo, { stacks: 2, expiresAt: 20 });
});
