import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { evokerHooks } from '#gw2/professions/elementalist/specializations/evoker/hooks.js';
import {
  consumeElectricEnchantment,
  grantElectricEnchantments
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { applyGalvanicEnchantment } from '#gw2/professions/elementalist/specializations/evoker/traits/index.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

const config = { specialization: 'Evoker', selectedTraitIds: [] };
const native = elementalistProfession.runtimeFor(config);

/** Capture real packet expansion while isolating the charge owner and selected balance catalog. */
function fixture(catalog = native.catalog) {
  const state = evokerState.create();
  const capture = captureEffectEmissions();
  let activation = 0;
  return {
    ...capture,
    state,
    context: {
      time: 2,
      helpers: catalog,
      traits: new Set(),
      profession: { specialization: { kind: 'Evoker', state } },
      effects: capture.effects,
      combat: { allocateEffectActivation: () => `enchantment:${activation++}` }
    }
  };
}

test('skill and trait providers share grant announcements while retaining patched lifetimes and attribution', () => {
  const catalog = applyBalanceProfilePatch(native.catalog, {
    balanceProfiles: {
      [PROFILE.haresAgility]: {
        fields: { playerStacks: 2 },
        effects: [{ type: 'buff', name: 'Hare Enchantment', duration: 9 }]
      },
      [PROFILE.lightningBlitz]: {
        fields: { resourceGain: 1 },
        effects: [{ type: 'buff', name: 'Lightning Blitz Enchantment', duration: 3 }]
      },
      [TRAIT.GALVANIC_ENCHANTMENT]: { fields: { playerStacks: 4, durationMultiplier: 6 } }
    }
  });
  const { context, state, announcements } = fixture(catalog);
  const providers = [
    [ID.HARES_AGILITY, 'elementalist.evoker.hares-agility', 2, 11, 'skill'],
    [ID.LIGHTNING_BLITZ, 'elementalist.evoker.lightning-blitz', 1, 5, 'skill'],
    [ID.IGNITE, null, 4, 8, 'trait']
  ];
  for (const [id, task] of providers) {
    const skill = catalog.skillsById.get(id);
    const cast = { id: `grant:${id}`, effectiveEnd: 2, skill };
    if (task) evokerHooks.tasks[task](context, { cast });
    else {
      context.traits.add(TRAIT.GALVANIC_ENCHANTMENT);
      applyGalvanicEnchantment(context, cast, skill);
    }
  }

  assert.deepEqual(
    state.electricEnchantmentGrants.map(({ charges, expiresAt }) => [charges, expiresAt]),
    [
      [1, 5],
      [4, 8],
      [2, 11]
    ]
  );
  const preview = damageOccurrences({ ...native, catalog }, config).find(
    (entry) => entry.id === 'profession:electric-enchantment'
  );
  assert.ok(preview.icon);
  for (const [index, [id, , stacks, , procType]] of providers.entries()) {
    const announcement = announcements[index].announcement;
    assert.equal(announcement.name, preview.name);
    assert.equal(announcement.icon, preview.icon);
    assert.equal(announcements[index].attribution.sourceId, id);
    assert.equal(announcement.sourceSkill, catalog.skillsById.get(id).name);
    assert.equal(announcement.type, procType);
    assert.equal(announcement.detail, `+${stacks} ${stacks === 1 ? 'stack' : 'stacks'}`);
  }
});

test('combat and preview share patched payloads while only combat spends a charge', () => {
  // Removed profile effects must disappear in both paths without changing the preview's charge state.
  for (const removed of [[], ['strike'], ['condition'], ['strike', 'condition']]) {
    const catalog = applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: {
        [TRAIT.GALVANIC_ENCHANTMENT]: {
          effects: [
            { type: 'strike', name: 'Galvanic Enchantment', coefficient: 1.25 },
            { type: 'condition', name: 'Burning', stacks: 3, duration: 7 }
          ],
          removeEffects: removed.map((type) => ({
            type,
            name: type === 'strike' ? 'Galvanic Enchantment' : 'Burning'
          }))
        }
      }
    });
    const combat = fixture(catalog);
    const skill = { id: ID.FIRE_STRIKE, name: 'Triggering skill' };
    grantElectricEnchantments(combat.context, { at: 2, stacks: 1, duration: 5, skill, procType: 'skill' });
    consumeElectricEnchantment(combat.context, {
      type: 'damage',
      at: 2,
      actorType: 'player',
      skillId: skill.id,
      sourceId: skill.id,
      skillName: skill.name
    });
    assert.equal(combat.state.electricEnchantmentGrants[0].charges, 0);
    const declared = native.damageEffects.find((entry) => entry.id === 'electric-enchantment');
    for (const hasCharges of [false, true]) {
      const preview = fixture(catalog);
      if (hasCharges)
        grantElectricEnchantments(preview.context, { at: 2, stacks: 2, duration: 5, skill, procType: 'skill' });
      const grants = structuredClone(preview.state.electricEnchantmentGrants);
      declared.emit(preview.context, {});
      assert.deepEqual(preview.state.electricEnchantmentGrants, grants);
      const payload = (events) =>
        events.map(({ type, coefficient, condition, stacks, duration, sourceId, icon }) => ({
          type,
          coefficient,
          condition,
          stacks,
          duration,
          sourceId,
          icon
        }));
      assert.deepEqual(payload(preview.events), payload(combat.events));
    }

    assert.equal(
      combat.events.some((event) => event.type === 'damage'),
      !removed.includes('strike')
    );
    assert.equal(
      combat.events.some((event) => event.type === 'condition'),
      !removed.includes('condition')
    );
    for (const event of combat.events) {
      assert.equal(event.sourceId, 'elementalist.electric-enchantment');
      assert.equal(event.skillId, skill.id);
      assert.equal(event.icon, declared.icon);
      assert.equal(event.skillName, declared.name);
      if (event.type === 'damage') assert.equal(event.coefficient, 1.25);
      if (event.type === 'condition') {
        assert.equal(event.stacks, 3);
        assert.equal(event.duration, 7);
      }
    }

    const consumption = combat.announcements.slice(1);
    assert.equal(consumption.length, removed.length === 2 ? 0 : 1);
    if (consumption.length) {
      assert.equal(consumption[0].attribution.sourceId, skill.id);
      assert.equal(consumption[0].announcement.sourceSkill, skill.name);
    }
  }
});
