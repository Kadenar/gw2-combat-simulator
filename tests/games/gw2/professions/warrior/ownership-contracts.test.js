import { warriorBuffPolicies } from '#gw2/professions/warrior/core/effect-state.js';
import { effectFields, effectPlanningState } from '#tests/helpers/effect-report.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/warrior/core/profiles.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as BLADESWORN } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { PARAGON_BALANCE_PROFILE_IDS as PARAGON } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as SPELLBREAKER } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { berserkersPower } from '#gw2/professions/warrior/core/traits/strength.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';
import { fierceAsFire as fierceAsFireTrait } from '#gw2/professions/warrior/specializations/bladesworn/traits/index.js';

const patchId = 'warrior-ownership';
const preview = (patch) =>
  withPatchPreview(warriorProfession, {
    id: patchId,
    label: 'Warrior ownership',
    professions: { warrior: patch }
  });

// Selected caps initialize before elite overrides, and the same pools supply resource presentation.
test('Warrior initialization and resource displays honor selected caps', () => {
  for (const maximum of [10, 50]) {
    const family = preview({
      balanceProfiles: {
        [CORE.resources]: { fields: { maximumStacks: maximum } },
        [BLADESWORN.resources]: { fields: { maximumStacks: 80 } },
        [PARAGON.resources]: { fields: { maximumStacks: 12 } },
        [SPELLBREAKER.resources]: { fields: { maximumStacks: 8 } }
      }
    });
    for (const [specialization, adrenalineCap] of [
      ['Core', maximum],
      ['Berserker', maximum],
      ['Paragon', maximum],
      ['Spellbreaker', 8],
      ['Bladesworn', 0]
    ]) {
      const config = { specialization, patchId, initialResource: 60 };
      const result = observeGw2Runtime({ profession: family.runtimeFor(config), config, rotation: [] });
      assert.deepEqual(result.warnings, []);
      const state = result.planningState.profession;
      assert.equal(state.maximumAdrenaline, adrenalineCap);
      assert.equal(state.adrenaline, adrenalineCap);
      const resources = family.ui.resourceViews({
        specialization,
        catalog: family.catalogFor(patchId),
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
test('Warrior displays use selected stack caps and bonuses', () => {
  const family = preview({
    balanceProfiles: {
      [TRAIT.SIGNET_MASTERY]: { fields: { maximumStacks: 3, attributeBonus: 120 } },
      [TRAIT.FURIOUS]: { fields: { maximumStacks: 7 } },
      [TRAIT.BERSERKERS_POWER]: { fields: { maximumStacks: 6, damageIncreasePerStack: 0.0625 } },
      [TRAIT.FIERCE_AS_FIRE]: { fields: { maximumStacks: 8, damageIncreasePerStack: 0.025 } },
      [TRAIT.GUNS_AND_GLORY]: { fields: { maximumStacks: 9 } }
    }
  });
  const balanceContext = family.balanceContextFor(patchId);
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
      { policies: warriorBuffPolicies(balanceContext) }
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
  assert.equal(item('signet-mastery').title, 'Signet Mastery: +360 ferocity (+120 per stack)');
  assert.equal(item('furious-surge').value, '7/7');
  assert.equal(item('berserkers-power').value, '6/6');
  assert.equal(item('bladesworn-fierce-as-fire').value, '8/8');
  assert.equal(item('peak-performance').title, 'Peak Performance active');
  assert.equal(result.effectReport.tracks.find((track) => track.kind === 'berserkers-power').countLimit, 6);
  assert.equal(result.effectReport.tracks.find((track) => track.kind === 'fierce-as-fire').countLimit, 8);
  assert.ok(
    family.ui
      .effectPresentations({ specialization: 'Bladesworn', catalog: balanceContext.catalog })
      .every((effect) => !Object.hasOwn(effect, 'maximumStacks') && !Object.hasOwn(effect, 'maximumDuration'))
  );

  // A single profile patch must change the capped damage formula and the trait's numeric tooltip together.
  const rule = berserkersPower.modifierRules.find(({ id }) => id === 'warrior.berserkers-power');
  for (const [stacks, expected] of [
    [0, 0],
    [2, 0.125],
    [30, 0.375]
  ]) {
    assert.equal(
      rule.amount({
        catalog: balanceContext.catalog,
        time: 1,
        runtime: {
          boons: new Map([
            ['berserkers-power', [{ at: 0, expiresAt: 10, stacks, resolvedAudience: { includesSelf: true } }]]
          ])
        }
      }),
      expected
    );
  }

  const tooltip = warriorTooltips.traits[TRAIT.BERSERKERS_POWER](balanceContext, { id: TRAIT.BERSERKERS_POWER });
  assert.equal(tooltip.facts.find(({ name }) => name === 'Strike damage per stack').detail, '+6.25%');
  assert.equal(tooltip.facts.find(({ name }) => name === 'Maximum stacks').detail, '6');

  const fierceAsFire = fierceAsFireTrait.modifierRules.find(({ id }) => id === 'warrior.fierce-as-fire');
  for (const [stacks, expected] of [
    [0, 0],
    [2, 0.05],
    [30, 0.2]
  ]) {
    assert.equal(
      fierceAsFire.amount({
        catalog: balanceContext.catalog,
        time: 1,
        runtime: {
          boons: new Map([
            ['fierce-as-fire', [{ at: 0, expiresAt: 10, stacks, resolvedAudience: { includesSelf: true } }]]
          ])
        }
      }),
      expected
    );
  }

  const fierceTooltip = warriorTooltips.traits[TRAIT.FIERCE_AS_FIRE](balanceContext, { id: TRAIT.FIERCE_AS_FIRE });
  assert.equal(
    fierceTooltip.facts.find(({ name }) => name === 'Strike and condition damage per stack').detail,
    '+2.5%'
  );
  assert.equal(fierceTooltip.facts.find(({ name }) => name === 'Maximum stacks').detail, '8');
});
