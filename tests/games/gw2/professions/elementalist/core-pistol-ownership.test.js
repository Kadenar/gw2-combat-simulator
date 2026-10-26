import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Exercise selected skill patches through real casts so ownership includes both runtime and presentation.
function preview(skills) {
  return withPatchPreview(elementalistProfession, {
    id: 'core-pistol-ownership',
    label: 'Core pistol ownership',
    professions: { elementalist: { skills } }
  });
}

function run(profession, attunement, rotation, options = {}) {
  return runElementalist(
    rotation,
    {
      patchId: 'core-pistol-ownership',
      specialization: 'Core',
      primaryWeapon: 'Pistol',
      startAttunement: attunement,
      selectedTraitIds: [],
      pistolBullets: { [attunement]: true }
    },
    { profession, ...options }
  );
}

function tooltip(profession, id) {
  const context = profession.resolvePatch({ id: 'core-pistol-ownership' }).balanceContext;
  return describeSimulationSkill(context, context.catalog.skillsById.get(id), elementalistTooltips);
}

test('Core Fire bullet payload edits and removal preserve native effects and bullet consumption', () => {
  for (const [id, type, reward] of [
    [ID.RAGING_RICOCHET, 'boon', 'Might'],
    [ID.SEARING_SALVO, 'aura', 'Fire Aura']
  ]) {
    for (const removed of [false, true]) {
      const profession = preview({
        [id]: {
          sideEffects: {
            'fire-bullet': removed
              ? { removeEffects: [{ type, name: 'Fire' }] }
              : { effects: [{ type, name: 'Fire', duration: 17 }] }
          }
        }
      });
      const result = run(profession, 'Fire', [
        { type: 'cast', skillId: id },
        { type: 'wait', durationMs: 2000 }
      ]);
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.events.some(
          (event) => (event.kind === reward.toLowerCase() || event.aura === reward) && event.duration === 17
        ),
        !removed
      );
      assert.ok(result.events.some((event) => event.type === 'condition' && event.condition === 'Burning'));
      assert.equal(observedRuntime(result).profession.core.pistolBullets.Fire, false);
      assert.equal(
        tooltip(profession, id).facts.some(
          (fact) => fact.detail.includes('17s') && fact.detail.includes('Fire bullet')
        ),
        !removed
      );
    }
  }
});

test('Frozen Fusillade patches delay conditional rewards and remove each payload independently', () => {
  for (const removedType of [null, 'strike', 'condition']) {
    const profession = preview({
      [ID.FROZEN_FUSILLADE]: {
        fields: { detonationDelay: 2 },
        sideEffects: {
          'water-bullet': {
            effects: [
              { type: 'strike', name: 'Water Bullet', coefficient: 1.23 },
              { type: 'condition', name: 'Water Bullet', duration: 17 }
            ],
            ...(removedType ? { removeEffects: [{ type: removedType, name: 'Water Bullet' }] } : {})
          }
        }
      }
    });
    const result = run(profession, 'Water', [
      { type: 'cast', skillId: ID.FROZEN_FUSILLADE },
      { type: 'cast', skillId: ID.SOOTHING_SPLASH },
      { type: 'wait', durationMs: 3000 }
    ]);
    assert.deepEqual(result.warnings, []);
    // Only resolved rewards count: the selected delay must place them inside this observation window.
    const strike = result.resolvedEvents.find(
      (event) => event.sourceId === ID.FROZEN_FUSILLADE && event.coefficient === 1.23
    );
    const bleed = result.resolvedEvents.find((event) => event.condition === 'Bleeding' && event.duration === 17);
    assert.equal(Boolean(strike), removedType !== 'strike');
    assert.equal(Boolean(bleed), removedType !== 'condition');
    const laterCast = result.events.find((event) => event.type === 'action' && event.skillId === ID.SOOTHING_SPLASH);
    for (const reward of [strike, bleed].filter(Boolean)) {
      assert.ok(reward.at > laterCast.endsAt, 'enhancement remains deferred beyond intervening actions');
      assert.equal(reward.skillId, ID.FROZEN_FUSILLADE);
    }

    assert.equal(observedRuntime(result).profession.core.pistolBullets.Water, false);
  }
});

test('Dazing Discharge selected recharge benefit survives autos and expires without altering its own recharge', () => {
  const profession = preview({ [ID.DAZING_DISCHARGE]: { fields: { duration: 2, nextSkillRechargeMultiplier: 0.25 } } });
  for (const expired of [false, true]) {
    const result = run(profession, 'Air', [
      { type: 'cast', skillId: ID.DAZING_DISCHARGE },
      { type: 'cast', skillId: ID.ELECTRIC_EXPOSURE },
      ...(expired ? [{ type: 'wait', durationMs: 2500 }] : []),
      { type: 'cast', skillId: ID.AERIAL_AGILITY }
    ]);
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.cooldownController.rechargeFor(ID.DAZING_DISCHARGE).work, 8);
    assert.equal(runtime.cooldownController.rechargeFor(ID.AERIAL_AGILITY).work, expired ? 12 : 3);
  }

  assert.ok(tooltip(profession, ID.DAZING_DISCHARGE).facts.some((fact) => fact.detail === '-75%'));
});

test('Shattering Stone selected charges expire and consume even when their bleeding reward is removed', () => {
  for (const removed of [false, true]) {
    const profession = preview({
      [ID.SHATTERING_STONE]: {
        fields: { maximumStacks: 2, duration: 2 },
        sideEffects: {
          'earth-bullet': removed
            ? { removeEffects: [{ type: 'condition', name: 'Triggered Bleeding' }] }
            : { effects: [{ type: 'condition', name: 'Triggered Bleeding', duration: 17 }] }
        }
      }
    });
    const armed = run(profession, 'Earth', [{ type: 'cast', skillId: ID.SHATTERING_STONE }]);
    assert.equal(observedRuntime(armed).profession.core.shatteringStone.charges, 2);
    assert.ok(!armed.events.some((event) => event.condition === 'Bleeding' && event.duration === 17));
    for (const expired of [false, true]) {
      const result = run(profession, 'Earth', [
        { type: 'cast', skillId: ID.SHATTERING_STONE },
        ...(expired ? [{ type: 'wait', durationMs: 2500 }] : []),
        { type: 'cast', skillId: ID.PIERCING_PEBBLE }
      ]);
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.resolvedEvents.some((event) => event.condition === 'Bleeding' && event.duration === 17),
        !removed && !expired
      );
      assert.equal(observedRuntime(result).profession.core.shatteringStone.charges, expired ? 2 : 1);
      assert.equal(observedRuntime(result).profession.core.pistolBullets.Earth, false);
    }
  }
});
