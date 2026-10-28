import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { applyRuntimeSigils, applyRuntimeSigilStrike } from '#gw2/platform/equipment/sigils/runtime.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { enteredCombat } from '#tests/helpers/engagement.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

function liveFixture(name) {
  const config = {
    attributeInputs: baseAttributeInputs({ power: 1500, conditionDamage: 1000 }),
    target: { armor: 2597, health: 0 },
    sigilSets: [{ names: [name] }]
  };
  const captured = captureEffectEmissions();
  return {
    config,
    captured,
    runtime: {
      ...createGw2ResolverRuntimeState({ config }),
      engagement: enteredCombat(),
      activeWeaponSet: 1,
      effects: captured.effects
    }
  };
}

// Doom's payload is earned by an eligible player hit, never by arming it or by a companion hit.
test('Doom remains armed through ineligible hits and is consumed only once', () => {
  const { runtime, captured } = liveFixture('Doom');
  applyRuntimeSigils(runtime, 'swap', { type: 'weapon_set', at: 0, weaponSet: 1 });
  assert.equal(runtime.sigil.doomPending, true);
  assert.deepEqual(captured.events, []);
  assert.equal(runtime.procs.deadline(`sigil.${SIGIL_IDS.DOOM}`), 9);
  const hit = { type: 'damage', at: 1, actorType: 'player', coefficient: 1, skillName: 'Trigger' };
  applyRuntimeSigilStrike(runtime, { ...hit, actorType: 'summon' });
  applyRuntimeSigilStrike(runtime, { ...hit, coefficient: 0 });
  assert.equal(runtime.sigil.doomPending, true);
  assert.deepEqual(captured.events, []);
  applyRuntimeSigilStrike(runtime, hit);
  assert.equal(runtime.sigil.doomPending, false);
  assert.ok(captured.events.some((event) => event.condition === 'Poisoned' && event.ownerActorType === 'player'));
  const consumed = [...captured.events];
  applyRuntimeSigilStrike(runtime, { ...hit, at: 2 });
  assert.deepEqual(captured.events, consumed, 'an unarmed hit cannot repeat the earned payload');
});

// Both execution modes resolve the same owned formula inputs after live eligibility has been satisfied.
for (const name of ['Geomancy', 'Hydromancy', 'Doom']) {
  test(`${name} isolated damage matches an earned live payload`, () => {
    const { runtime, config, captured } = liveFixture(name);
    const profession = defineTestProfession({ id: 'sigil-payload-fixture', name: 'Sigil payload fixture' });
    applyRuntimeSigils(runtime, 'swap', { type: 'weapon_set', at: 0, weaponSet: 1 });

    if (name === 'Doom')
      applyRuntimeSigilStrike(runtime, { type: 'damage', at: 0, actorType: 'player', coefficient: 1 });

    const live = resolveTestGw2Events({ profession, config, events: captured.events, endTime: 10 });
    const {
      occurrences: [isolated]
    } = evaluateSkillDamage(
      {
        config,
        occurrences: [
          {
            id: `sigil.${SIGIL_IDS[name.toUpperCase()]}`,
            effect: { kind: 'sigil', id: SIGIL_IDS[name.toUpperCase()] },
            name: `Sigil of ${name}`,
            source: 'Sigil',
            icon: '',
            unit: 'occurrence'
          }
        ]
      },
      profession
    );
    assert.equal(isolated.status, 'measured');
    assert.ok(live.totalDamage > 0);
    assert.equal(isolated.measurement.strike, live.strikeDamage);
    assert.equal(isolated.measurement.conditionDamage, live.conditionDamage);
  });
}
