import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { necromancerStrike } from '#gw2/professions/necromancer/core/mechanics/trigger-points.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { darkBarrageEffects } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/dark-barrage.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

const BARRAGE = ID.DARK_BARRAGE;

/** Apply the selected patch to the simulated profession. */
function preview(edits) {
  return withPatchPreview(necromancerProfession, {
    id: 'proc-payloads',
    label: 'Proc payloads',
    professions: { necromancer: edits }
  });
}

function simulate(profession, patchId, specialization, rotation, selectedTraitIds = []) {
  const result = createObservedProfessionSimulator(profession, {
    attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, conditionDamage: 1000, expertise: 0 }),
    target: { armor: 2597, health: 1_000_000 }
  })(specialization, rotation, { patchId, initialResource: 100, selectedTraitIds });
  assert.deepEqual(result.warnings, []);
  return result;
}

// Independently removed packets and an empty profile must not fall back to a base volley or an untimed effect.
test('Dark Barrage preserves strike and condition removal and an empty selected volley', () => {
  for (const mode of ['strike', 'condition', 'empty']) {
    const profession = preview({
      skills: {
        [BARRAGE]:
          mode === 'empty'
            ? {
                removeEffects: [
                  { type: 'strike', name: 'Doom Approaches Strike' },
                  { type: 'condition', name: 'Doom Approaches Torment' }
                ]
              }
            : {
                removeEffects: [
                  { type: mode, name: mode === 'strike' ? 'Doom Approaches Strike' : 'Doom Approaches Torment' }
                ]
              }
      }
    });
    const result = simulate(
      profession,
      'proc-payloads',
      'Harbinger',
      ['Harbinger Shroud', 'Dark Barrage', { type: 'wait', durationMs: 1000 }],
      [TRAIT.DOOM_APPROACHES]
    );
    const packets = result.events.filter((event) => event.skillId === ID.DARK_BARRAGE);
    assert.equal(
      packets.some(({ type }) => type === 'damage'),
      mode === 'condition'
    );
    assert.equal(
      packets.some(({ type, condition }) => type === 'condition' && condition === 'Torment'),
      mode === 'strike'
    );
  }
});

// Removing Burning skips Dhuumfire even when the profile retains another condition.
test('Removing Dhuumfire Burning leaves its cooldown unclaimed', () => {
  const profession = preview({
    balanceProfiles: {
      [TRAIT.DHUUMFIRE]: {
        removeEffects: [{ type: 'condition', name: 'Burning' }],
        addEffects: [{ type: 'condition', name: 'Unused Poison', condition: 'Poisoned', stacks: 9, duration: 7 }]
      }
    }
  });
  const context = profession.resolvePatch({ id: 'proc-payloads' }).balanceContext;
  const emitted = captureEffectEmissions();
  let claims = 0;
  const runtime = {
    helpers: context.catalog,
    config: { selectedTraitIds: [TRAIT.DHUUMFIRE] },
    effects: emitted.effects,
    procs: {
      claimCooldown() {
        claims++;
        return true;
      }
    }
  };
  dhuumfireOpportunity(
    runtime,
    { type: 'damage', at: 0, skillName: 'Fixture', metadata: { dhuumfireDuration: 4, dhuumfireInterval: 2 } },
    5,
    true
  );
  assert.equal(claims, 0);
  assert.deepEqual(emitted.events, []);
});

// Metadata wins over the skill and trait; a zero cooldown permits independent same-time reactions.
test('Dhuumfire uses packet duration first and allows independent zero-cooldown hits', () => {
  const context = preview({
    balanceProfiles: { [TRAIT.DHUUMFIRE]: { effects: [{ type: 'condition', name: 'Burning', duration: 7 }] } }
  }).resolvePatch({ id: 'proc-payloads' }).balanceContext;
  const emitted = captureEffectEmissions();
  const runtime = {
    helpers: context.catalog,
    config: { selectedTraitIds: [TRAIT.DHUUMFIRE] },
    effects: emitted.effects,
    procs: {
      claimCooldown() {
        assert.fail('Zero interval must not claim a cooldown');
      }
    }
  };
  for (const [metadata, skillDuration] of [
    [{ dhuumfireDuration: 4, dhuumfireInterval: 0 }, 5],
    [undefined, 5],
    [undefined, undefined]
  ]) {
    dhuumfireOpportunity(runtime, { type: 'damage', at: 0, skillName: 'Fixture', metadata }, skillDuration, true);
  }

  assert.deepEqual(
    emitted.events.map(({ duration }) => duration),
    [4, 5, 7]
  );
});

// A disabled alternative cannot fall through to an untimed application.
test('Dark Barrage empty selected volley emits no default packet', () => {
  const context = preview({}).resolvePatch({ id: 'current' }).balanceContext;
  const skill = context.catalog.skillsById.get(BARRAGE);
  assert.deepEqual(darkBarrageEffects({ ...skill, doomApproachesPulseCount: 0 }, skill.effects), []);
});

test('Removing autonomous attacks leaves the spirit and its command active', () => {
  const profession = preview({
    skills: {
      ['necromancer.ritualist.wanderlust.autoattack']: {
        effects: [{ type: 'strike', name: 'Wanderlust Autoattack', coefficient: 0 }]
      }
    }
  });
  for (const patchId of ['current', 'proc-payloads']) {
    const patched = patchId === 'proc-payloads';
    const result = simulate(profession, patchId, 'Ritualist', [
      "Ritualist's Shroud",
      'Wanderlust',
      { type: 'wait', durationMs: 2000 },
      'Summon Spirits',
      { type: 'wait', durationMs: 10000 }
    ]);
    const attacks = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.metadata?.spiritAttackType === 'summon-spirits'
    );
    assert.ok(attacks.length > 0);
    assert.ok(result.planningState.profession[STATE.ACTIVE_SPIRITS].wanderlust);
    assert.equal(
      result.resolvedEvents.some((event) => event.metadata?.spiritAttackType === 'autoattack'),
      !patched
    );
  }
});

/** Dispatch the hit through the selected trait's registered listener. */
function dhuumfireOpportunity(runtime, event, dhuumfireDuration, shroudSkillOne) {
  bindTriggerPoints(runtime, necromancerProfession, runtime.config);
  runtime.fireTrigger(necromancerStrike, {
    event: { coefficient: 1, ...event },
    details: {},
    firstHit: true,
    dhuumfireDuration,
    shroudSkillOne
  });
}
