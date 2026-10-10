import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { attunementsCounted } from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise authored thresholds with both callers' progress gains; bound emissions so regressions cannot hang the suite.
for (const { threshold, progress, grants } of [
  { threshold: 0, progress: [0, 0, 0, 0], grants: [0, 0, 0, 0] },
  { threshold: -1, progress: [0, 0, 0, 0], grants: [0, 0, 0, 0] },
  { threshold: 1.5, progress: [1, 0, 0, 1], grants: [0, 1, 2, 2] },
  { threshold: 5, progress: [1, 3, 0, 1], grants: [0, 0, 1, 1] }
]) {
  test(`Bountiful Power threshold ${threshold} preserves progress and grant semantics`, () => {
    const catalog = applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: { [TRAIT.BOUNTIFUL_POWER]: { fields: { threshold: { from: 5, to: threshold } } } }
    });
    const core = { bountifulPowerProgress: 0 };
    const events = [];
    const context = {
      helpers: catalog,
      time: 4,
      config: {},
      query: { statsAt: () => ({}) },
      traits: new Set([TRAIT.BOUNTIFUL_POWER]),
      profession: { core },
      effects: captureEffectEmissions({
        submit(event) {
          assert.ok(events.length < 8, 'Bountiful Power exceeded expected grant bound');
          events.push(event);
          return event;
        }
      }).effects
    };

    bindTriggerPoints(context, elementalistProfession);
    for (const [index, stacks] of [1, 2, 2, 1].entries()) {
      context.fireTrigger(attunementsCounted, { at: index, stacks: stacks, sourceId: ID.AIR_ATTUNEMENT });
      assert.equal(core.bountifulPowerProgress, progress[index]);
      for (const kind of ['quickness', 'bountiful-power-active']) {
        assert.equal(events.filter((event) => event.kind === kind).length, grants[index]);
      }
    }
  });
}
