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
        maximumStacks: 2,
        effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', duration: 9 }]
      },
      {
        id: TRAIT.TYRANTS_MOMENTUM,
        name: "Tyrant's Momentum",
        profileKind: 'trait',
        effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', duration: 3 }]
      }
    ]
  });
  for (const [traits, duration] of [
    [[], 9],
    [[TRAIT.TYRANTS_MOMENTUM], 3]
  ]) {
    const parameters = lethalTempoParameters({ catalog, traits: new Set(traits) });
    assert.deepEqual(parameters, { maximumStacks: 2, duration });
    const scheduler = { lethalTempo: { stacks: 0, expiresAt: 0 } };
    const resolver = { ...scheduler };
    // Grants refresh at the cap through expiry; only a later grant starts a new stack window.
    assert.equal(grantTempo(scheduler, 0, parameters), 1);
    assert.equal(grantTempo(scheduler, 1, parameters), 2);
    assert.equal(grantTempo(scheduler, 2, parameters), 2);
    assert.equal(activeLethalTempo(scheduler, 2 + duration), 2);
    assert.equal(grantTempo(scheduler, 2 + duration, parameters), 2);
    assert.equal(grantTempo(scheduler, 2 + 2 * duration + 0.000001, parameters), 1);
    assert.equal(grantTempo(resolver, 1, parameters), 1);
    assert.equal(resolver.lethalTempo.expiresAt, 1 + duration);
  }
});

test('Lethal Tempo refreshes existing stacks through its rounded expiry tick', () => {
  const parameters = { maximumStacks: 5, duration: 6 };
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
        effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', duration: parameters.duration }]
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
