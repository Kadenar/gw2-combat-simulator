import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Exercise the registered family with one live Core and specialization owner.
function run(rotation, overrides = {}, source = warriorProfession, output = 'detailed') {
  const config = {
    specialization: 'Spellbreaker',
    primaryWeapon: 'Dagger',
    initialResource: 30,
    selectedTraitIds: [],
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597 },
    ...overrides
  };
  return observeGw2Runtime({ profession: source.runtimeFor(config), config, rotation, output });
}

const wait = (durationMs) => ({ type: 'wait', durationMs });
const state = (result) => observedRuntime(result).profession.specialization.state;

test('Spellbreaker caps at two bars and each burst spends one bar, including a canceled activation', () => {
  const result = run(['Breaching Strike']);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.maximumAdrenaline, 20);
  assert.equal(result.planningState.profession.adrenaline, 11);
  const hit = result.resolvedEvents.find((event) => event.type === 'damage');
  assert.equal(hit.metadata.warriorAdrenalineSpent, 10);
  assert.equal(hit.metadata.warriorBurstTier, 1);
  const canceled = run([{ name: 'Breaching Strike', interruptAfterMs: 1 }]);
  assert.equal(canceled.planningState.profession.adrenaline, 10);
  assert.equal(
    canceled.resolvedEvents.some((event) => event.type === 'damage'),
    false
  );
});

test('Full Counter spends its bar without an incoming attack or successful burst rewards', () => {
  const result = run(['Full Counter'], { selectedTraitIds: [TRAIT.BURST_MASTERY, TRAIT.MAGEBANE_TETHER] });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.adrenaline, 10);
  assert.equal(result.totalDamage, 0);
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === TRAIT.BURST_MASTERY),
    false
  );
  assert.equal(state(result).magebaneTetherUntil, 0);
});

test('accepted controls grant Insight once and each group expires at its own deadline', () => {
  const result = run(['Kick', "Bull's Charge", wait(14200)], {
    selectedSkills: ['Kick', "Bull's Charge"],
    selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT],
    target: { armor: 2597, defiant: true }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).attackerInsightExpiries.length, 1);
  const expired = run(['Kick', wait(16000)], { selectedSkills: ['Kick'], selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT] });
  assert.deepEqual(state(expired).attackerInsightExpiries, []);
  const missed = run([{ name: 'Kick', offTarget: true }], {
    selectedSkills: ['Kick'],
    selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT]
  });
  assert.deepEqual(state(missed).attackerInsightExpiries, []);
});

test('No Escape retains effect ownership and boon-removal-only attacks cannot manufacture Insight', () => {
  const config = {
    selectedTraitIds: [TRAIT.NO_ESCAPE, TRAIT.ATTACKERS_INSIGHT],
    selectedSkills: ['Break Enchantments']
  };
  const control = run(['Disrupting Stab'], config);
  assert.deepEqual(control.warnings, []);
  assert.equal(state(control).attackerInsightExpiries.length, 1);
  const immobilize = control.resolvedEvents.find((event) => event.sourceId === TRAIT.NO_ESCAPE);
  assert.equal(immobilize.condition, 'Immobilized');
  assert.equal(immobilize.actorType, 'effect');
  const removal = run(['Break Enchantments'], config);
  assert.deepEqual(removal.warnings, []);
  assert.deepEqual(state(removal).attackerInsightExpiries, []);
});

test('Magebane starts at impact after its triggering damage and expires without another cast', () => {
  const result = run([{ name: 'Breaching Strike', impactDelayMs: 1000 }, wait(10000)], {
    selectedTraitIds: [TRAIT.MAGEBANE_TETHER]
  });
  const baseline = run([{ name: 'Breaching Strike', impactDelayMs: 1000 }, wait(10000)]);
  assert.deepEqual(result.warnings, []);
  const hit = result.resolvedEvents.find((event) => event.type === 'damage');
  assert.equal(hit.damage, baseline.resolvedEvents.find((event) => event.type === 'damage').damage);
  assert.equal(result.procSteps.find((proc) => proc.skill === 'Magebane Tether').start, Math.round(hit.at * 1000));
  assert.equal(state(result).magebaneTetherUntil, 0);
  const missed = run([{ name: 'Breaching Strike', offTarget: true }], { selectedTraitIds: [TRAIT.MAGEBANE_TETHER] });
  assert.equal(state(missed).magebaneTetherRecharge, null);
});

test('Magebane recharge integrates actual temporary Alacrity and admits the next action tick', () => {
  for (const at of [0, 2]) {
    const source = {
      runtimeFor(config) {
        const native = warriorProfession.runtimeFor(config);
        return {
          ...native,
          initialize(runtime) {
            native.initialize(runtime);
            runtime.emit({
              type: 'buff',
              at,
              source: 'Fixture',
              sourceId: 'alacrity',
              actorType: 'player',
              kind: 'alacrity',
              stacks: 1,
              duration: 4.08
            });
            for (const at of [0, 10.99, 11])
              runtime.emit({
                type: 'damage',
                at,
                source: 'Warrior',
                sourceId: ID.BREACHING_STRIKE,
                actorType: 'player',
                skillId: ID.BREACHING_STRIKE,
                skillName: 'Breaching Strike',
                skillWeapon: 'Dagger',
                coefficient: 1
              });
          }
        };
      }
    };
    const result = run([wait(12000)], { selectedTraitIds: [TRAIT.MAGEBANE_TETHER] }, source);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      result.procSteps.filter((proc) => proc.skill === 'Magebane Tether').map((proc) => proc.start),
      [0, 11000]
    );
    assert.equal(state(result).magebaneTetherUntil, 19);
  }
});

test('removed Insight and Tether packets cannot create their state or proc windows', () => {
  const patched = withPatchPreview(warriorProfession, {
    id: 'spellbreaker-removed',
    label: 'Spellbreaker removed',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.attackersInsight]: { removeEffects: [{ type: 'buff' }] },
          [PROFILE.magebaneTether]: { removeEffects: [{ type: 'buff' }] }
        }
      }
    }
  });
  const result = run(
    ['Disrupting Stab', 'Breaching Strike'],
    {
      patchId: 'spellbreaker-removed',
      selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT, TRAIT.MAGEBANE_TETHER]
    },
    patched
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(state(result).attackerInsightExpiries, []);
  assert.equal(state(result).magebaneTetherUntil, 0);
  assert.equal(state(result).magebaneTetherRecharge, null);
});

test('Insight and Tether use the same live owner in detailed and score execution', () => {
  const config = { selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT, TRAIT.MAGEBANE_TETHER, TRAIT.NO_ESCAPE] };
  const rotation = ['Disrupting Stab', 'Breaching Strike', 'Precise Cut'];
  const detailed = run(rotation, config);
  const score = run(rotation, config, warriorProfession, 'score');
  assert.deepEqual(detailed.warnings, []);
  assert.equal(score.totalDamage, detailed.totalDamage);
  assert.deepEqual(state(score).attackerInsightExpiries, state(detailed).attackerInsightExpiries);
  assert.equal(state(score).magebaneTetherUntil, state(detailed).magebaneTetherUntil);
});
