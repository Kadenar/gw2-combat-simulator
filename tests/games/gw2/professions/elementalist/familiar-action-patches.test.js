import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { acceptIgniteEffects } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

/** Apply familiar action edits to the simulated profession. */
function preview(edits = {}) {
  return withPatchPreview(elementalistProfession, {
    id: 'familiar-actions',
    label: 'Familiar actions',
    professions: { elementalist: edits }
  });
}

function simulate(profession, patchId, skillId, config = {}) {
  const result = runElementalist(
    [
      { type: 'cast', skillId },
      { type: 'wait', durationMs: 6000 }
    ],
    { specialization: 'Evoker', patchId, selectedTraitIds: [], initialEvokerCharges: 6, ...config },
    { profession }
  );
  assert.deepEqual(result.warnings, []);
  return result;
}

test('Toad resistance action patches preserve the Earth gate, party cap, and meditation ordering', () => {
  for (const removed of [false, true]) {
    const profession = preview({
      skills: {
        [ID.TOADS_FORTITUDE]: {
          sideEffects: {
            'earth-resistance': removed
              ? { removeEffects: [{ type: 'boon', name: 'Toad Resistance' }] }
              : {
                  effects: [{ type: 'boon', name: 'Toad Resistance', duration: 9, audience: { maximumRecipients: 3 } }]
                }
          }
        }
      }
    });
    for (const element of ['Earth', 'Fire']) {
      const result = simulate(profession, 'familiar-actions', ID.TOADS_FORTITUDE, {
        evokerElement: element,
        selectedSkillIds: [ID.TOADS_FORTITUDE],
        selectedTraitIds: [TRAIT.ALTRUISTIC_ASPECT],
        allies: { count: 4 }
      });
      const buffs = result.resolvedEvents.filter((event) => event.type === 'buff');
      const grants = buffs.filter((event) => event.kind === 'resistance');
      const stability = buffs.find((event) => event.kind === 'stability');
      assert.ok(stability, 'Removing the intrinsic reward must preserve Altruistic Aspect');
      assert.equal(grants.length, !removed && element === 'Earth' ? 1 : 0);

      for (const grant of grants) {
        assert.equal(grant.resolvedAudience.includesSelf, true);
        assert.equal(grant.resolvedAudience.alliedPlayerCount, 2);
        // The skill reward settles before the trait reward at the same completion boundary.
        assert.equal(grant.at, stability.at);
        assert.ok(grant.eventOrder < stability.eventOrder);
        assert.equal(grant.activationId, stability.activationId);
      }
    }
  }
});

// Named boons retain their element groups when the first effect is removed or the profile order changes.
test('Familiar blessing grants follow the element after effect removal or reordering', () => {
  for (const reordered of [false, true]) {
    const profession = preview({
      balanceProfiles: {
        [TRAIT.FAMILIARS_BLESSING]: {
          removeEffects: reordered ? [{ type: 'boon', all: true }] : [{ type: 'boon', name: 'quickness' }],
          ...(reordered
            ? {
                addEffects: [
                  { type: 'boon', name: 'alacrity', boon: 'alacrity', stacks: 1, duration: 7 },
                  { type: 'boon', name: 'quickness', boon: 'quickness', stacks: 1, duration: 3 }
                ]
              }
            : {})
        }
      }
    });
    for (const patchId of ['current', 'familiar-actions']) {
      const hasQuickness = reordered || patchId === 'current';
      for (const [element, skillId, boon] of [
        ['Fire', ID.IGNITE, 'quickness'],
        ['Air', ID.ZAP, 'quickness'],
        ['Water', ID.SPLASH, 'alacrity'],
        ['Earth', ID.CALCIFY, 'alacrity']
      ]) {
        const result = simulate(profession, patchId, skillId, {
          evokerElement: element,
          selectedTraitIds: [TRAIT.FAMILIARS_BLESSING]
        });
        const grants = result.resolvedEvents.filter(
          (event) => event.type === 'buff' && event.sourceId === TRAIT.FAMILIARS_BLESSING
        );
        assert.equal(grants.length, boon === 'quickness' && !hasQuickness ? 0 : 1);
        for (const grant of grants) assert.equal(grant.kind, boon);
      }
    }
  }
});

// Removing Burning from the skill affects all tiers. Removing it from one tier affects only that cast.
test('Removing one Ignite tier preserves Burning on the other tiers', () => {
  for (const nativeRemoved of [true, false]) {
    const profession = preview(
      nativeRemoved
        ? { skills: { [ID.IGNITE]: { removeEffects: [{ type: 'condition', condition: 'Burning' }] } } }
        : {
            skills: {
              [ID.IGNITE]: {
                sideEffects: { 'burning-tiers': { removeEffects: [{ type: 'condition', name: 'Tier 2' }] } }
              }
            }
          }
    );
    const context = profession.resolvePatch({ id: 'familiar-actions' }).balanceContext;
    const state = evokerState.create();
    const runtime = { helpers: context.catalog, profession: { specialization: { kind: 'Evoker', state } } };
    for (let tier = 0; tier < 4; tier++) {
      const cast = { id: `ignite-${tier}`, start: tier, skill: context.catalog.skillsById.get(ID.IGNITE) };
      const effects = acceptIgniteEffects(runtime, cast, cast.skill.effects ?? []);
      const expectedBurning = !nativeRemoved && tier !== 1;
      assert.equal(
        effects.some((effect) => effect.type === 'condition' && effect.condition === 'Burning'),
        expectedBurning
      );
    }

    if (nativeRemoved) {
      const result = simulate(profession, 'familiar-actions', ID.IGNITE);
      assert.equal(
        result.events.some(
          (event) => event.type === 'condition' && event.condition === 'Burning' && event.skillId === ID.IGNITE
        ),
        false
      );
    }
  }
});
