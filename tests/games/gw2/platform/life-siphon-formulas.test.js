import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { RANGER_TRAIT_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { THIEF_TRAIT_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Minimal activations isolate each siphon's base-plus-Power formula and attribution from its triggering attack.
for (const [name, run, rotation, config, base, coefficient] of [
  [
    'Carnivore',
    runRanger,
    ['Concussion Shot'],
    { primaryWeapon: 'Shortbow', selectedTraitIds: [RANGER.CARNIVORE] },
    3255,
    0.05
  ],
  [
    "Predator's Cunning",
    runRanger,
    ['Poison Volley'],
    { specialization: 'Soulbeast', primaryWeapon: 'Shortbow', selectedTraitIds: [RANGER.PREDATORS_CUNNING] },
    170,
    0.006
  ],
  ['Cloaked in Shadow', runThief, ['Cloak and Dagger'], { selectedTraitIds: [THIEF.CLOAKED_IN_SHADOW] }, 130, 0.04],
  [
    'Shadow Siphoning',
    runThief,
    ['Cloak and Dagger', 'Backstab'],
    { selectedTraitIds: [THIEF.SHADOW_SIPHONING] },
    412,
    0.1
  ],
  ['Vampiric Slash', runThief, ['Vampiric Slash'], { primaryWeapon: 'Spear' }, 1410, 0.2]
]) {
  test(`${name} resolves flat life siphon damage in a separate breakdown row`, () => {
    for (const [power, armor, vulnerability] of [
      [1000, 2597, 0],
      [3000, 5194, 25]
    ]) {
      const result = run(
        rotation,
        {
          ...config,
          stats: { power, precision: 4000, ferocity: 1000 },
          target: { armor, defiant: true, conditions: { Vulnerability: vulnerability } }
        },
        {
          initialize(runtime) {
            // Start at the follow-up so the lead attack cannot add Vulnerability to the plain-target case.
            if (name === 'Vampiric Slash') runtime.profession.core.spearChainStage = 1;
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const label = `Life Siphon - ${name}`;
      const packets = result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.damageBreakdownName === label
      );
      assert.ok(packets.length > 0);
      const multiplier = name === 'Vampiric Slash' && vulnerability > 0 ? 1.5 : 1;
      for (const packet of packets) {
        assert.equal(packet.damageKind, 'life-steal');
        assert.equal(packet.critEligible, false);
        assert.equal(packet.damage, Math.floor((base + coefficient * power) * multiplier));
      }

      const rows = skillBreakdownRows(result);
      assert.ok(rows.some((row) => row.name === label));
      if (name === 'Vampiric Slash') assert.ok(rows.some((row) => row.name === name));
    }
  });
}

// The lead attack's three stacks are active at impact; the follow-up grants its stack after its damage resolves.
test('Vampiric Slash combines its siphon bonus with Lead Attacks', () => {
  const result = runThief(['Unsuspecting Strike', 'Vampiric Slash'], {
    primaryWeapon: 'Spear',
    selectedTraitIds: [THIEF.LEAD_ATTACKS],
    stats: { power: 2000 }
  });
  assert.deepEqual(result.warnings, []);
  const siphon = result.resolvedEvents.find((event) => event.damageBreakdownName === 'Life Siphon - Vampiric Slash');
  assert.equal(siphon.damage, Math.floor((1410 + 0.2 * 2000) * 1.5 * 1.03));
});
