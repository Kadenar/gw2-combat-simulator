import assert from 'node:assert/strict';
import test from 'node:test';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { completeRevenantCastTraits } from '#gw2/professions/revenant/core/traits/dispatch.js';

// Facet actions and the common completion observer must share the same claim, even across detached cast objects.
test('Revenant completion paths grant one reward per activation and isolate runs', () => {
  for (let run = 0; run < 2; run += 1) {
    const paths = [];
    const result = runRevenant(
      [ID.FACET_OF_LIGHT],
      {
        specialization: 'Herald',
        selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
        startingLegend: LEGEND.DRAGON,
        selectedTraitIds: [TRAIT.BATTLE_SCARRED]
      },
      {
        catalog: (catalog) =>
          withProfile(catalog, TRAIT.BATTLE_SCARRED, {
            effects: [{ type: 'buff', name: 'battle-scars', stacks: 3, duration: 30 }]
          }),
        extend(native) {
          return {
            sideEffectHandlers: {
              ...native.sideEffectHandlers,
              'revenant.start-facet'(runtime, context) {
                paths.push('action');
                native.sideEffectHandlers['revenant.start-facet'](runtime, context);
                assert.equal(runtime.profession.core.battleScars.length, 3);
              }
            },
            onCastCommit(runtime, cast) {
              paths.push('observer');
              native.onCastCommit(runtime, cast);
              completeRevenantCastTraits(runtime, { ...cast });
            }
          };
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(paths, ['action', 'observer']);
    assert.equal(observedRuntime(result).profession.core.battleScars.length, 3);
  }
});
