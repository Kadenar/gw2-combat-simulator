import assert from 'node:assert/strict';
import test from 'node:test';

import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { pilferArtifacts } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// A cast spends its accepted pool; a pilfer during execution belongs to the next artifact use.
test('artifact commitment preserves inventory pilfered after acceptance and rewards the spent family', () => {
  let replaced = false;
  const result = runThief(
    [ID.MISTBURN_MORTAR],
    { specialization: 'Antiquary', initialPreSteal: 1, selectedTraitIds: [TRAIT.POSSESSIVE_HOARDER] },
    {
      extend(native) {
        return {
          onCastStart(runtime, cast) {
            native.onCastStart?.(runtime, cast);

            if (cast.skill.id === ID.MISTBURN_MORTAR)
              runtime.schedule('test.replace-artifacts', (cast.start + cast.effectiveEnd) / 2);
          },
          tasks: {
            ...native.tasks,
            'test.replace-artifacts'(runtime) {
              const state = runtime.profession.specialization.state;
              assert.equal(state.artifactUsesRemaining, 0);
              assert.ok(!state.artifactSlots.some((slot) => slot.skillId === ID.MISTBURN_MORTAR));
              pilferArtifacts(runtime, 'initiative');
              replaced = true;
            }
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(replaced, true);
  assert.equal(result.planningState.profession[STATE.ARTIFACT_USES_REMAINING], 1);
  assert.equal(result.planningState.availability[ID.MISTBURN_MORTAR].ready, true);
  assert.ok(result.events.some((event) => event.name === 'Possessive Hoarder' && event.kind === 'might'));
});

// Reshuffle restores choices without restoring spent uses, clearing progress, or firing live pilfer rewards.
test('Reshuffle preserves remaining uses and spending without granting pilfer rewards', () => {
  const result = runThief(
    [ID.MISTBURN_MORTAR, ID.RESHUFFLE],
    {
      specialization: 'Antiquary',
      initialPreSteal: 1,
      selectedTraitIds: [TRAIT.CARD_SWAP, TRAIT.IMPROVISATION, TRAIT.PROLIFIC_PLUNDERER, TRAIT.COMBAT_HIGH]
    },
    {
      initialize(runtime) {
        runtime.profession.specialization.state.initiativeSpentSincePilfer = 7;
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const state = result.planningState.profession;
  assert.equal(state[STATE.ARTIFACT_USES_REMAINING], 2);
  // Preserve the banked seven points plus Reshuffle's own two-point initiative cost.
  assert.equal(state[STATE.INITIATIVE_SPENT_SINCE_PILFER], 9);
  assert.equal(result.planningState.availability[ID.MISTBURN_MORTAR].ready, true);
  assert.deepEqual(state[STATE.COMBAT_HIGH_EXPIRATIONS], []);
  assert.equal(state[STATE.SCOUNDRELS_LUCK], 0);
});
