import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { triggerBountifulPower } from '#gw2/professions/elementalist/core/traits/arcane.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

// Exercise authored thresholds with both callers' progress gains; bound emissions so regressions cannot hang the suite.
for (const { threshold, progress, grants } of [
  { threshold: 0, progress: [0, 0, 0, 0], grants: [0, 0, 0, 0] },
  { threshold: -1, progress: [0, 0, 0, 0], grants: [0, 0, 0, 0] },
  { threshold: 1.5, progress: [1, 0, 0.5, 0], grants: [0, 2, 3, 4] },
  { threshold: 5, progress: [1, 3, 0, 1], grants: [0, 0, 1, 1] }
]) {
  test(`Bountiful Power threshold ${threshold} preserves progress and grant semantics`, () => {
    const catalog = applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: { [PROFILE.bountifulPower]: { fields: { threshold: { from: 5, to: threshold } } } }
    });
    const core = { bountifulPowerProgress: 0 };
    const events = [];
    const context = {
      catalog,
      traits: new Set(['Bountiful Power']),
      state: { profession: { core } },
      emit(event) {
        assert.ok(events.length < 8, 'Bountiful Power exceeded the expected grant bound');
        events.push(event);
        return event;
      }
    };

    for (const [index, stacks] of [1, 2, 2, 1].entries()) {
      triggerBountifulPower(context, index, stacks, ID.AIR_ATTUNEMENT);
      assert.equal(core.bountifulPowerProgress, progress[index]);
      for (const kind of ['quickness', 'bountiful power active']) {
        assert.equal(events.filter((event) => event.kind === kind).length, grants[index]);
      }
    }
  });
}
