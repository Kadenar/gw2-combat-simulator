import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { WARRIOR_MAXIMUM_ADRENALINE } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { signetAttributeEffects } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Change the live pool after the shared reservation but before variant selection to expose accidental resampling.
test('tier variants use the captured spend after the live adrenaline pool changes', () => {
  for (const [id, primaryWeapon] of [
    [ID.ARCING_SLICE, 'Greatsword'],
    [ID.KILL_SHOT, 'Rifle'],
    [ID.BLOODTHIRSTER, 'Sword'],
    [ID.COMBUSTIVE_SHOT, 'Longbow']
  ]) {
    for (const initialResource of [10, 20, 30]) {
      const payloads = [];
      for (const replacePool of [false, true]) {
        const config = { specialization: 'Core', primaryWeapon, initialResource, selectedTraitIds: [] };
        const native = warriorProfession.runtimeFor(config);
        const result = observeGw2Runtime({
          config,
          profession: {
            ...native,
            onCastStart(runtime, cast) {
              native.onCastStart(runtime, cast);

              if (replacePool) runtime.resourceController.replace('adrenaline', initialResource === 30 ? 0 : 30);
            },
            modifyEffects(runtime, cast, effects) {
              payloads.push(effects);
              return native.modifyEffects(runtime, cast, effects);
            }
          },
          rotation: [id]
        });
        assert.deepEqual(result.warnings, []);
      }

      assert.ok(payloads[0].length > 0);
      assert.deepEqual(payloads[1], payloads[0], `${id}: ${initialResource}`);
    }
  }
});

// Skill-owned mode duration and Rage extensions must compose without changing sibling skills or the base catalog.
test('Berserk and individual Rage skills own independently selected mode durations', () => {
  const originalExtension = warriorProfession.catalog.skillsById.get(ID.OUTRAGE).durationExtension;
  const patchId = 'warrior-mode-owners';
  const family = withPatchPreview(warriorProfession, {
    id: patchId,
    label: 'Mode owners',
    professions: {
      warrior: {
        skills: {
          [ID.BERSERK]: {
            sideEffects: { berserk: { effects: [{ type: 'buff', name: 'berserk', duration: { from: 20, to: 4 } }] } }
          },
          [ID.OUTRAGE]: { fields: { durationExtension: { from: 3, to: 2 } } },
          [ID.SHATTERING_BLOW]: { fields: { durationExtension: { from: 3, to: 0 } } }
        }
      }
    }
  });
  for (const [skill, active] of [
    [ID.OUTRAGE, true],
    [ID.SHATTERING_BLOW, false]
  ]) {
    const config = {
      specialization: 'Berserker',
      patchId,
      initialResource: 30,
      selectedTraitIds: [],
      selectedSkillIds: [skill]
    };
    const result = observeGw2Runtime({
      profession: family.runtimeFor(config),
      config,
      rotation: [ID.BERSERK, skill, { type: 'wait', durationMs: 4000 }]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession[STATE.BERSERK_UNTIL] != null, active);
    assert.equal(
      result.planningState.profession[STATE.ADRENALINE].maximum,
      active
        ? warriorProfession.catalog.balanceProfilesById.get(TRAIT.PRIMAL_RAGE).maximumStacks
        : WARRIOR_MAXIMUM_ADRENALINE
    );
  }

  assert.equal(warriorProfession.catalog.skillsById.get(ID.OUTRAGE).durationExtension, originalExtension);
});

// Removing a magazine payload never refunds its captured ammunition or synthesizes another strike.
test('Dragon Roar packet removal preserves magazine spending and recharge', () => {
  const patchId = 'warrior-magazine-owner';
  const family = withPatchPreview(warriorProfession, {
    id: patchId,
    label: 'Magazine owner',
    professions: {
      warrior: {
        skills: {
          [ID.DRAGONS_ROAR]: { removeEffects: [{ type: 'strike', name: 'Strike' }] }
        }
      }
    }
  });
  const config = { specialization: 'Core', patchId, primaryWeapon: 'Axe', secondaryWeapon: 'Pistol' };
  const result = observeGw2Runtime({ profession: family.runtimeFor(config), config, rotation: [ID.DRAGONS_ROAR] });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'damage'),
    false
  );
  assert.equal(observedRuntime(result).cooldownController.readAmmo(ID.DRAGONS_ROAR).charges, 0);
  assert.ok(observedRuntime(result).cooldownController.readyAt(ID.DRAGONS_ROAR) > 0);
});

// Ready signets expose their own selected attributes, preserving readiness and independent sibling tuning.
test('signet passive attributes use selected skill fields and native readiness', () => {
  const patchId = 'warrior-signet-owner';
  const family = withPatchPreview(warriorProfession, {
    id: patchId,
    label: 'Signet owner',
    professions: {
      warrior: {
        skills: {
          [ID.SIGNET_OF_MIGHT]: { fields: { 'attributeBonuses.power': { from: 180, to: 240 } } }
        }
      }
    }
  });
  const balanceContext = family.resolvePatch({ id: patchId }).balanceContext;
  const context = { balanceContext, time: 0, config: { selectedSkillIds: [ID.SIGNET_OF_MIGHT, ID.SIGNET_OF_FURY] } };
  const effects = signetAttributeEffects(context);
  assert.deepEqual(
    effects.map(({ to, amount, enabled }) => ({ to, amount, enabled })),
    [
      { to: 'Power', amount: 240, enabled: true },
      { to: 'Precision', amount: 180, enabled: true }
    ]
  );
  const cooling = signetAttributeEffects({
    ...context,
    timeline: { skillOnCooldownAt: (id) => id === ID.SIGNET_OF_MIGHT }
  });
  assert.equal(cooling.find((effect) => effect.to === 'Power').enabled, false);
  assert.equal(cooling.find((effect) => effect.to === 'Precision').enabled, true);
  assert.deepEqual(signetAttributeEffects({ ...context, config: { selectedSkillIds: [] } }), []);
});
