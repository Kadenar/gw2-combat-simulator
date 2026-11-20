import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { effectFields, effectPlanningState } from '#tests/helpers/effect-report.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

const patchId = 'warrior-ownership';
const preview = (patch) =>
  withPatchPreview(warriorProfession, {
    id: patchId,
    label: 'Warrior ownership',
    professions: { warrior: patch }
  });

// Fixed Core capacity and trait-owned elite capacities agree with resource presentation.
test('Warrior initialization and displays share fixed Core and selected elite caps', () => {
  for (const initialResource of [10, 60]) {
    const family = preview({
      balanceProfiles: {
        [TRAIT.GUN_X_SWORD]: { fields: { maximumStacks: 80 } },
        [TRAIT.RALLY_THE_VALIANT]: { fields: { maximumStacks: 12 } },
        [TRAIT.SPELLBREAKERS_CONVICTION]: { fields: { maximumStacks: 8 } }
      }
    });
    for (const [specialization, adrenalineCap] of [
      ['Core', 30],
      ['Berserker', 30],
      ['Paragon', 30],
      ['Spellbreaker', 8],
      ['Bladesworn', 0]
    ]) {
      const config = { specialization, patchId, initialResource };
      const result = observeGw2Runtime({ profession: family.runtimeFor(config), config, rotation: [] });
      assert.deepEqual(result.warnings, []);
      const state = result.planningState.profession;
      assert.equal(state[STATE.ADRENALINE].maximum, adrenalineCap);
      assert.equal(state[STATE.ADRENALINE].value, Math.min(initialResource, adrenalineCap));
      const resources = family.ui.resourceViews({
        specialization,
        catalog: family.resolvePatch({ id: patchId }).catalog,
        professionState: state
      });

      if (specialization === 'Bladesworn') {
        assert.equal(resources[0].maximum, 80);
        assert.equal(resources[0].startMaximum, 80);
      } else {
        assert.equal(resources[0].maximum, adrenalineCap);
      }

      if (specialization === 'Paragon') assert.equal(resources.find(({ id }) => id === 'motivation').maximum, 12);
    }
  }
});

// Snapshot clamps, attribute labels, and chart caps all read the selected profiles.
test('Warrior displays use the selected stack caps', () => {
  const family = preview({
    balanceProfiles: {
      [TRAIT.SIGNET_MASTERY]: { fields: { maximumStacks: 3, attributePerStack: 120 } },
      [TRAIT.FURIOUS]: { fields: { maximumStacks: 7 } },
      [TRAIT.BERSERKERS_POWER]: { fields: { maximumStacks: 6, damageIncreasePerStack: 0.0625 } },
      [TRAIT.FIERCE_AS_FIRE]: { fields: { maximumStacks: 8, damageIncreasePerStack: 0.025 } },
      [TRAIT.GUNS_AND_GLORY]: { fields: { maximumStacks: 9 } }
    }
  });
  const balanceContext = family.resolvePatch({ id: patchId }).balanceContext;
  const result = {
    events: [],
    ...effectFields(
      ['signet-mastery', 'furious-surge', 'berserkers-power', 'peak-performance', 'fierce-as-fire'].map((kind) => ({
        type: 'buff',
        kind,
        at: 0,
        duration: 10,
        stacks: 30,
        resolvedAudience: {
          includesSelf: true,
          includesSummons: false,
          companionIds: [],
          alliedPlayerCount: 0,
          recipientCount: 1
        }
      })),
      120,
      {
        policies: family
          .runtimeFor({ specialization: 'Bladesworn', patchId })
          .buffPolicies({ helpers: balanceContext.catalog })
      }
    )
  };
  const items = family.ui.rotationStateSnapshot({
    specialization: 'Bladesworn',
    balanceContext,
    result,
    planningState: effectPlanningState(result, 1),
    atSeconds: 1,
    build: { specializations: [{ name: 'Arms', traits: '2-1-1' }] }
  });
  const item = (id) => items.find((value) => value.id === id);
  assert.equal(item('signet-mastery').value, '3/3');
  assert.equal(item('furious-surge').value, '7/7');
  assert.equal(item('berserkers-power').value, '6/6');
  assert.equal(item('bladesworn-fierce-as-fire').value, '8/8');
  assert.equal(result.effectReport.tracks.find((track) => track.kind === 'berserkers-power').countLimit, 6);
  assert.equal(result.effectReport.tracks.find((track) => track.kind === 'fierce-as-fire').countLimit, 8);
  assert.ok(
    family.ui
      .effectPresentations({ specialization: 'Bladesworn', catalog: balanceContext.catalog })
      .every((effect) => !Object.hasOwn(effect, 'maximumStacks') && !Object.hasOwn(effect, 'maximumDuration'))
  );
});
