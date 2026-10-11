import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

/** Empty initialized runs expose live capabilities without adding combat ticks or unrelated trait rewards. */
function initialized(specialization) {
  const config = { specialization, initialResource: 0 };
  const profession = warriorProfession.runtimeFor(config);
  const result = observeGw2Runtime({ profession, config, rotation: [] });
  assert.deepEqual(result.warnings, []);
  return { profession, context: observedRuntime(result).mechanics };
}

test('selected resource policies isolate authored rewards, hit gains, and caps between Warrior runs', () => {
  const runs = ['Core', 'Bladesworn', 'Spellbreaker', 'Berserker', 'Paragon'].map(initialized);
  for (const { context, profession } of runs) {
    const bladesworn = context.profession.specialization.kind === 'Bladesworn';
    const pool = () =>
      bladesworn ? context.profession.specialization.state.flow.value : context.profession.core.adrenaline.value;
    const maximum = bladesworn
      ? context.profession.specialization.state.flow.maximum
      : context.profession.core.adrenaline.maximum;
    // Exercise the accepted-hit boundary so Bladesworn exclusion stays part of the real runtime contract.
    profession.reactions['damage.resolved'](
      context,
      { actorType: 'player', coefficient: 1, hits: 3, critical: false },
      { hitContext: { critEligible: false, critical: { chance: 0, didCrit: false } } }
    );
    assert.equal(pool(), bladesworn ? 0 : 3);
    grantWarriorResource(context, 7);
    assert.equal(pool(), bladesworn ? 7 : 10);
    grantWarriorResource(context, maximum * 2);
    assert.equal(pool(), maximum);
    if (bladesworn) assert.equal(context.profession.core.adrenaline.value, 0);
    for (const invalid of [-1, Infinity, NaN]) assert.throws(() => grantWarriorResource(context, invalid), RangeError);
  }
});

test('the composed runtime installs only the selected elite policies and observations exactly once', () => {
  const eliteKinds = {
    Bladesworn: [
      'tactical-reload',
      'overcharged-cartridges',
      'supercharged-cartridges',
      'guns-and-glory',
      'positive-flow',
      'fierce-as-fire'
    ],
    Berserker: ['berserk', 'fire-aura'],
    Spellbreaker: ['attackers-insight', 'magebane-tether']
  };
  for (const specialization of ['Core', ...Object.keys(eliteKinds), 'Paragon']) {
    const { profession, context } = initialized(specialization);
    const policies = profession.buffPolicies(context).map(({ kind }) => kind);
    const observations = profession.observeEffects(context.queries).map(({ kind }) => kind);
    assert.equal(new Set(policies).size, policies.length);
    assert.equal(new Set(observations).size, observations.length);
    for (const [owner, kinds] of Object.entries(eliteKinds)) {
      for (const kind of kinds) {
        assert.equal(policies.includes(kind), owner === specialization, `${specialization}: ${kind}`);
        if (owner !== specialization) assert.ok(!observations.includes(kind), `${specialization}: ${kind}`);
      }
    }
  }
});

// Simultaneous accepted hits must claim Signet Mastery once, after the triggering hit resolves.
test('Signet Mastery target-health eligibility and same-time cooldown reservation survive line ownership', () => {
  for (const startingHealthFraction of [0.6, 0.4]) {
    const config = {
      specialization: 'Core',
      selectedTraitIds: [TRAIT.SIGNET_MASTERY],
      target: { health: 1000000000, startingHealthFraction, armor: 2597 },
      attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000 })
    };
    const result = observeGw2Runtime({
      profession: warriorProfession.runtimeFor(config),
      config,
      rotation: [{ type: 'wait', durationMs: 1000 }],
      engineInitialize(runtime) {
        for (const activationId of ['first', 'second'])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at: 0.5,
              actorType: 'player',
              source: 'warrior',
              sourceId: ID.CHOP,
              skillId: ID.CHOP,
              skillName: 'Chop',
              activationId,
              coefficient: 1,
              weaponStrengthProfileId: 'weapon.axe'
            }
          });
      }
    });
    assert.deepEqual(result.warnings, []);
    const context = observedRuntime(result).mechanics;
    assert.equal(context.combat.activeBuffStacks('signet-mastery', context.time), startingHealthFraction < 0.5 ? 1 : 0);
    assert.equal(context.procs.deadline(TRAIT.SIGNET_MASTERY) > 0, startingHealthFraction < 0.5);
  }
});
