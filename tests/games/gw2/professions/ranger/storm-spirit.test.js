import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

// A committed summon resolves its child even after pet replacement; an abandoned summon produces no child.
test('Storm Spirit invokes Call Lightning independently of the active pet lifetime', () => {
  for (const cancelled of [false, true]) {
    const result = runRanger(
      [{ type: 'cast', skillId: ID.STORM_SPIRIT, ...(cancelled ? { interruptMs: 1 } : {}) }, ID.PET_SWAP, wait(6500)],
      { selectedPet: 'Tiger', selectedPet2: 'Pig', selectedTraitIds: [TRAIT.NATURES_VENGEANCE] }
    );
    assert.deepEqual(result.warnings, []);
    const strikes = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.CALL_LIGHTNING
    );
    assert.equal(strikes.length > 0, !cancelled);
    for (const strike of strikes) {
      assert.equal(strike.sourceId, ID.CALL_LIGHTNING);
      assert.equal(strike.skillName, 'Call Lightning');
      assert.equal(strike.triggeredBy, 'Storm Spirit');
      assert.equal(
        strike.activationId,
        result.events.find((event) => event.type === 'action' && event.skillId === ID.STORM_SPIRIT).activationId
      );
      assert.equal(strike.summonOwner, undefined);
      assert.ok(strike.damage > 0);
    }

    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.STORM_SPIRIT),
      false
    );
  }
});

// Isolated skill execution retains the intrinsic child slam while suppressing new trait-repeat admission.
test('Storm Spirit damage previews include Call Lightning without admitting a trait repeat', () => {
  const measure = (selectedTraitIds) =>
    evaluateSkillDamage(
      {
        config: { selectedTraitIds, boons: {}, stats: { power: 1000, precision: 1000, ferocity: 0 } },
        occurrences: [
          {
            id: 'storm',
            effect: { kind: 'skill', id: ID.STORM_SPIRIT },
            name: 'Storm Spirit',
            source: 'Skill',
            icon: '',
            unit: 'activation'
          }
        ]
      },
      rangerProfession
    ).occurrences[0];
  const base = measure([]);
  const repeated = measure([TRAIT.NATURES_VENGEANCE]);
  assert.equal(base.status, 'measured');
  assert.equal(repeated.status, 'measured');
  assert.ok(base.measurement.total > 0);
  assert.equal(repeated.measurement.total, base.measurement.total);
});

// Both slams read the canonical child profile, including removal, while the parent retains its rewards.
test('Call Lightning tuning controls Storm Spirit and its trait repeat in detailed and score runs', () => {
  for (const output of ['detailed', 'score']) {
    for (const removed of [false, true]) {
      const coefficients = [];
      const result = runRanger(
        [ID.STORM_SPIRIT, wait(6500)],
        { selectedTraitIds: [TRAIT.NATURES_VENGEANCE] },
        {
          output,
          extend(native) {
            const child = native.catalog.skillsById.get(ID.CALL_LIGHTNING);
            return {
              catalog: withSkill(native.catalog, ID.CALL_LIGHTNING, {
                effects: child.effects.flatMap((effect) =>
                  effect.type === 'strike' ? (removed ? [] : [{ ...effect, coefficient: 4 }]) : [effect]
                )
              }),
              reactions: {
                ...native.reactions,
                'damage.resolved'(runtime, event, details) {
                  native.reactions['damage.resolved']?.(runtime, event, details);
                  if (event.skillId === ID.CALL_LIGHTNING) coefficients.push(event.coefficient);
                }
              }
            };
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(coefficients, removed ? [] : [4, 2]);
      assert.ok(
        observedRuntime(result)
          .facts.ofType('buff')
          .some((event) => event.skillId === ID.STORM_SPIRIT && event.kind === 'fury')
      );
    }
  }
});
