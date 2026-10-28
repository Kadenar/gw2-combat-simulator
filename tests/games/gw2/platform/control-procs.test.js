import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTOR, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { ELEMENTALIST_TRAIT_IDS as ELEMENTALIST_TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { NECROMANCER_TRAIT_IDS as NECROMANCER_TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const wait = { type: 'wait', durationMs: 3000 };
const config = { relic: 'Claw', target: { defiant: true, armor: 2597, conditions: {} } };
const clawProcs = (result) => result.procSteps.filter((step) => step.skill === 'Relic of the Claw');
const controls = (result) => result.events.filter((event) => event.type === 'control');
const lightningRod = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.source === 'Lightning Rod');
const runGuardian = createObservedProfessionSimulator(guardianProfession, config);
const runNecromancer = createObservedProfessionSimulator(necromancerProfession, {
  ...config,
  selectedTraitIds: [NECROMANCER_TRAIT.INSIDIOUS_DISRUPTION]
});
const runElementalist = createProfessionSimulator(elementalistProfession, () => ({
  ...config,
  selectedTraitIds: [ELEMENTALIST_TRAIT.LIGHTNING_ROD]
}));

// Removing a self stun-break's false control must preserve the separate follow-up's actual daze and proc.
test('Roiling Light does not activate Claw; Quick Retribution retains its daze', () => {
  const setup = runGuardian('Willbender', ['Roiling Light', wait]);
  assert.deepEqual(setup.warnings, []);
  assert.equal(controls(setup).length, 0);
  assert.equal(clawProcs(setup).length, 0);
  const followup = runGuardian('Willbender', ['Roiling Light', 'Quick Retribution', wait]);
  assert.deepEqual(followup.warnings, []);
  assert.deepEqual(
    controls(followup).map((event) => [event.skillName, event.controlKind]),
    [['Quick Retribution', CONTROL.DAZE]]
  );
  assert.equal(clawProcs(followup).length, 1);
});

test('Lucent Thrust blinds without refreshing Claw', () => {
  const result = runGuardian('Luminary', ['Enter Radiant Forge', 'Gleaming Blade', 'Lucent Thrust', wait]);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Lucent Thrust'));
  assert.equal(controls(result).length, 0);
  assert.equal(clawProcs(result).length, 0);
});

test('Reaper stun-break does not proc disables; Chilled to the Bone still triggers Claw and Insidious Disruption', () => {
  for (const [skill, expected] of [
    ['"You Are All Weaklings!"', 0],
    ['"Chilled to the Bone!"', 1]
  ]) {
    const result = runNecromancer('Reaper', [skill, wait]);
    assert.deepEqual(result.warnings, []);
    assert.equal(clawProcs(result).length, expected, skill);
    const torment = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.sourceId === NECROMANCER_TRAIT.INSIDIOUS_DISRUPTION
    );
    assert.equal(torment.length, expected, skill);

    if (expected) assert.equal(controls(result)[0].controlKind, CONTROL.STUN);
  }
});

// Staff controls use the normal disable pipeline on both ordinary and defiant targets.
for (const [skill, startAttunement, controlKind] of [
  ['Static Field', 'Air', CONTROL.STUN],
  ['Unsteady Ground', 'Earth', CONTROL.KNOCKBACK]
]) {
  test(`${skill} triggers Claw and Lightning Rod only when aimed at the target`, () => {
    for (const [defiant, offTarget] of [
      [true, false],
      [false, false],
      [true, true]
    ]) {
      const result = runElementalist(
        [
          {
            type: 'cast',
            skillId: elementalistCatalog.skills.find((candidate) => candidate.name === skill).id,
            offTarget
          },
          wait
        ],
        {
          primaryWeapon: WEAPON.STAFF,
          startAttunement,
          target: { ...config.target, defiant }
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(clawProcs(result).length, offTarget ? 0 : 1);
      assert.equal(lightningRod(result).length, offTarget ? 0 : 1);

      if (!offTarget)
        assert.deepEqual(
          controls(result).map((event) => [event.controlKind, event.actorType]),
          [[controlKind, ACTOR.PLAYER]]
        );
    }
  });
}

test('Gale Strike triggers disable procs once for its lift, not for each cyclone hit', () => {
  const result = runElementalist(['Gale Strike', wait], {
    specialization: 'Weaver',
    primaryWeapon: WEAPON.SWORD,
    startAttunement: 'Air',
    secondaryAttunement: 'Earth'
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(controls(result)[0]?.controlKind, CONTROL.FLOAT);
  assert.equal(clawProcs(result).length, 1);
  assert.equal(lightningRod(result).length, 1);
});

test('Harden defers its daze until the next spear attack and consumes it once', () => {
  const options = { primaryWeapon: WEAPON.SPEAR, startAttunement: 'Earth' };
  const setup = runElementalist(['Harden', wait], options);
  assert.deepEqual(setup.warnings, []);
  assert.equal(clawProcs(setup).length, 0);
  const result = runElementalist(['Harden', 'Earthen Spear', 'Earthen Spear', wait], options);
  assert.deepEqual(result.warnings, []);
  assert.equal(controls(result)[0]?.controlKind, CONTROL.DAZE);
  assert.equal(clawProcs(result).length, 1);
  assert.equal(lightningRod(result).length, 1);
});

test('Enervating Earth requires and consumes an air bullet for its daze', () => {
  for (const loaded of [true, false]) {
    const result = runElementalist(
      ['Enervating Earth', wait],
      {
        specialization: 'Weaver',
        primaryWeapon: WEAPON.PISTOL,
        startAttunement: 'Air',
        secondaryAttunement: 'Earth'
      },
      {
        initialize(runtime) {
          runtime.profession.core.pistolBullets.Air = loaded;
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(clawProcs(result).length, loaded ? 1 : 0);
    assert.equal(lightningRod(result).length, loaded ? 1 : 0);
    assert.equal(observedRuntime(result).profession.core.pistolBullets.Air, !loaded);

    if (loaded) assert.equal(controls(result)[0]?.controlKind, CONTROL.DAZE);
  }
});
