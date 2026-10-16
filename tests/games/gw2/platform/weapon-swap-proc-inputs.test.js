import assert from 'node:assert/strict';
import test from 'node:test';
import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_TRAIT_IDS } from '#gw2/professions/warrior/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_TRAIT_IDS } from '#gw2/professions/revenant/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Distinct weapon attributes and sigils expose accidental reuse of either entire weapon set during a swap proc.
function swapFixture({ family, specialization, weapons, trait, incomingForce, startingWeaponSet = 1 }) {
  const config = {
    specialization,
    startingWeaponSet,
    primaryWeapon: weapons[0][0],
    secondaryWeapon: weapons[0][1],
    weaponSet2Primary: weapons[1][0],
    weaponSet2Secondary: weapons[1][1],
    selectedTraitIds: [trait],
    attributeInputs: baseAttributeInputs(
      { power: 2000, precision: 2050, ferocity: 300 },
      { power: 1000, precision: 1000, ferocity: 600 }
    ),
    target: { armor: 1000 },
    sigilSets: [
      { names: ['Force'], strikeAdd: 0.05 },
      incomingForce
        ? { names: ['Hydromancy', 'Force'], strikeAdd: 0.05 }
        : { names: ['Hydromancy', 'Accuracy'], criticalChanceBonus: 7 }
    ]
  };

  if (startingWeaponSet === 2) config.sigilSets.reverse();

  const native = family.runtimeFor(config);
  const probe = (at) => ({
    type: 'damage',
    at,
    source: 'Fixture',
    sourceId: 'probe',
    name: 'Probe',
    actorType: 'player',
    coefficient: 1,
    weaponStrength: 1000
  });
  return observeGw2Runtime({
    config,
    damageDiagnostics: true,
    rotation: [{ type: 'wait', durationMs: 1000 }, 'Swap Weapons', { type: 'wait', durationMs: 2000 }],
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        for (const event of [probe(0), probe(2)]) runtime.effects.emit({ kind: 'packet', event });
      }
    }
  });
}

const cases = [
  {
    label: 'Sun and Moon Style',
    family: warriorProfession,
    specialization: 'Spellbreaker',
    weapons: [
      ['Dagger', 'Mace'],
      ['Sword', 'Axe']
    ],
    trait: WARRIOR_TRAIT_IDS.SUN_AND_MOON_STYLE,
    modifier: 'warrior.sun-and-moon-style',
    outgoing: 1.1,
    incoming: undefined
  },
  {
    label: 'Destructive Impulses',
    family: revenantProfession,
    specialization: 'Core',
    weapons: [
      ['Sword', 'Sword'],
      ['Hammer', '']
    ],
    trait: REVENANT_TRAIT_IDS.DESTRUCTIVE_IMPULSES,
    modifier: 'revenant.destructive-impulses',
    outgoing: 0.075,
    incoming: 0.05
  }
];

for (const scenario of cases) {
  for (const startingWeaponSet of [1, 2]) {
    for (const incomingForce of [false, true]) {
      test(`${scenario.label}: swap from set ${startingWeaponSet} retains stats and traits with incoming ${incomingForce ? 'Force' : 'Accuracy'}`, () => {
        const result = swapFixture({ ...scenario, incomingForce, startingWeaponSet });
        assert.deepEqual(result.warnings, []);
        const hydro = result.resolvedEvents.find(
          (event) => event.type === 'damage' && event.name === 'Sigil of Hydromancy'
        );
        const after = result.resolvedEvents.find(
          (event) => event.type === 'damage' && event.name === 'Probe' && event.at === 2
        );
        assert.ok(hydro, 'the destination Hydromancy must proc');
        const leavingFirst = startingWeaponSet === 1;
        const stats = (event) => [
          event.damageCalculation.power,
          event.damageCalculation.precision,
          event.damageCalculation.ferocity
        ];
        const oldStats = leavingFirst ? [2000, 2050, 300] : [1000, 1000, 600];
        const newStats = leavingFirst ? [1000, 1000, 600] : [2000, 2050, 300];
        assert.deepEqual(stats(hydro), oldStats);
        assert.deepEqual(stats(after), newStats);
        const contribution = (event, id) =>
          event.damageCalculation.outgoingContributors.find((entry) => entry.id === id)?.value;
        assert.equal(contribution(hydro, scenario.modifier), leavingFirst ? scenario.outgoing : scenario.incoming);
        assert.equal(contribution(after, scenario.modifier), leavingFirst ? scenario.incoming : scenario.outgoing);
        assert.equal(contribution(hydro, 'equipment.sigils'), incomingForce ? 0.05 : undefined);
        const expectedCrit = (leavingFirst ? 0.55 : 0.05) + (incomingForce ? 0 : 0.07);
        assert.ok(Math.abs(hydro.criticalChance - expectedCrit) < 1e-10);
        assert.equal(observedRuntime(result).activeWeaponSet, leavingFirst ? 2 : 1);
        assert.equal(after.weaponSwapFromSet, undefined, 'the outgoing set must not leak into later attacks');
      });
    }
  }
}
