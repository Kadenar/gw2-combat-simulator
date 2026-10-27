import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { ATTRIBUTE_NAMES, baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { skillNumber, skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { skillPatchableNumericFields } from '#gw2/integrations/patches/authoring/fields.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { combineFields } from '#gw2/platform/skills/field-specs.js';
import { ELEMENTALIST_CORE_SKILL_FIELDS } from '#gw2/professions/elementalist/core/catalog-fields.js';
import { EVOKER_SKILL_FIELDS } from '#gw2/professions/elementalist/specializations/evoker/catalog-fields.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { authoringNumericFieldLabel } from '#gw2/integrations/patches/app/model.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistSkillAttributes } from '#gw2/professions/elementalist/core/skills/attributes.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { armArcaneEcho, completeArcaneEcho } from '#gw2/professions/elementalist/core/mechanics/arcane-echo.js';
import { elementalistRockBarrierLifecycle } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { elementalistRechargeWork } from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { WEAVE_SELF_ATTUNEMENT_RECHARGE_SECONDS } from '#gw2/professions/elementalist/specializations/weaver/mechanics/attunements.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { weaveSelfAvailability } from '#gw2/professions/elementalist/specializations/weaver/mechanics/weave-self.js';
import { evaluateAttributeDeclarations } from '#tests/helpers/attribute-declarations.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Each preview edits the canonical skill, exercising the same selection used by runtime and presentation.
function preview(edits) {
  return withPatchPreview(elementalistProfession, {
    id: 'skill-tuning',
    label: 'Skill tuning',
    professions: {
      elementalist: { skills: Object.fromEntries(Object.entries(edits).map(([id, fields]) => [id, { fields }])) }
    }
  });
}

function facts(context, id) {
  const model = describeSimulationSkill(context, context.catalog.skillsById.get(id), elementalistTooltips);
  assert.ok(!model.incomplete);
  return Object.fromEntries(model.facts.map(({ name, detail }) => [name, detail]));
}

test('skill patches own signet and conjure attributes in preview, runtime, and pickup tooltips', () => {
  // Distinct patched grants; unpatched expectations come from the canonical skills rather than pinned balance.
  const patchedBonuses = {
    [ID.SIGNET_OF_FIRE]: { precision: 41 },
    [ID.CONJURE_LIGHTNING_HAMMER]: { ferocity: 23, precision: 37 },
    [ID.CONJURE_FIERY_GREATSWORD]: { conditionDamage: 29, power: 43 }
  };
  const profession = preview(
    Object.fromEntries(
      Object.entries(patchedBonuses).map(([id, bonuses]) => [
        id,
        Object.fromEntries(
          Object.entries(bonuses).map(([attribute, amount]) => [`attributeBonuses.${attribute}`, amount])
        )
      ])
    )
  );
  // Returning to current must restore the original source, without leaking preview tuning.
  for (const patchId of ['current', 'skill-tuning', 'current']) {
    const context = profession.resolvePatch({ id: patchId }).balanceContext;
    const bonuses = (id) =>
      patchId === 'skill-tuning' ? patchedBonuses[id] : elementalistCatalog.skillsById.get(id).attributeBonuses;
    const signet = bonuses(ID.SIGNET_OF_FIRE).precision;
    const config = { patchId, selectedSkillIds: [ID.SIGNET_OF_FIRE], selectedTraitIds: [] };
    const initial = { power: 1000, precision: 1000, conditionDamage: 0, ferocity: 0 };
    const core = createElementalistCoreState();
    const query = { catalog: context.catalog, config, time: 1, runtime: { profession: { core } } };
    assert.equal(evaluateAttributeDeclarations(query, initial, elementalistSkillAttributes).precision, 1000 + signet);
    assert.equal(facts(context, ID.SIGNET_OF_FIRE)['Passive precision'], String(signet));
    for (const [weapon, id, pickup, first, second, firstName, secondName] of [
      [
        'Lightning Hammer',
        ID.CONJURE_LIGHTNING_HAMMER,
        ID.PICK_UP_LIGHTNING_HAMMER,
        'precision',
        'ferocity',
        'Precision while wielded',
        'Ferocity while wielded'
      ],
      [
        'Fiery Greatsword',
        ID.CONJURE_FIERY_GREATSWORD,
        ID.PICK_UP_FIERY_GREATSWORD,
        'power',
        'conditionDamage',
        'Power while wielded',
        'Condition damage while wielded'
      ]
    ]) {
      const firstValue = bonuses(id)[first];
      const secondValue = bonuses(id)[second];
      Object.assign(core, { conjureEquipped: weapon, conjureExpiresAt: 2 });
      const attributes = evaluateAttributeDeclarations(query, initial, elementalistSkillAttributes);
      assert.equal(attributes[first], initial[first] + firstValue + (first === 'precision' ? signet : 0));
      assert.equal(attributes[second], initial[second] + secondValue);
      for (const skillId of [id, pickup]) {
        assert.equal(facts(context, skillId)[firstName], String(firstValue));
        assert.equal(facts(context, skillId)[secondName], String(secondValue));
      }

      // The bonus ends with the held bundle, even though its source skill still exists.
      const expired = evaluateAttributeDeclarations({ ...query, time: 2 }, initial, elementalistSkillAttributes);
      assert.equal(expired[first], initial[first] + (first === 'precision' ? signet : 0));
    }

    const samples = [];
    const result = runElementalist(
      [{ type: 'wait', durationMs: 1000 }],
      {
        ...config,
        attributeInputs: baseAttributeInputs(initial)
      },
      {
        profession,
        timeline: [
          { at: 0.5, run: (runtime) => samples.push(runtime.combat.statsAt(runtime.time, null, runtime).precision) }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(samples, [1000 + signet]);
  }
});

test('skill-owned Rock Barrier expiry releases held recharge at the patched deadline', () => {
  const profession = preview({ [ID.ROCK_BARRIER]: { flipDuration: 2 } });
  const context = profession.resolvePatch({ id: 'skill-tuning' }).balanceContext;
  const hurl = context.catalog.skillsById.get(ID.HURL);
  assert.equal(facts(context, ID.ROCK_BARRIER)['Hurl window'], '2s');
  // Opening at a known instant isolates lifetime ownership from cast and packet schedules.
  const result = runElementalist(
    [{ type: 'wait', durationMs: 4000 }],
    {
      patchId: 'skill-tuning',
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      startAttunement: 'Earth',
      selectedTraitIds: []
    },
    {
      profession,
      timeline: [
        { at: 1, run: elementalistRockBarrierLifecycle.tasks['elementalist.core.open-rock-barrier'] },
        { at: 2.9, run: (runtime) => assert.equal(elementalistCoreAvailability(runtime, hurl).ready, true) },
        {
          at: 3.1,
          run(runtime) {
            assert.equal(elementalistCoreAvailability(runtime, hurl).ready, false);
            assert.equal(runtime.cooldownController.rechargeFor(ID.ROCK_BARRIER).startedAt, 3);
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
});

test('Arcane Echo window and Ride the Lightning recharge factor read the selected skills', () => {
  const profession = preview({
    [ID.ARCANE_ECHO]: { duration: 4 },
    [ID.RIDE_THE_LIGHTNING]: { rechargeMultiplier: 0.25 }
  });
  const context = profession.resolvePatch({ id: 'skill-tuning' }).balanceContext;
  assert.equal(facts(context, ID.ARCANE_ECHO).Window, '4s');
  const result = runElementalist(
    [{ type: 'wait', durationMs: 3000 }],
    {
      patchId: 'skill-tuning',
      selectedTraitIds: []
    },
    {
      profession,
      timeline: [
        {
          at: 1,
          run(runtime) {
            const echo = runtime.helpers.skillsById.get(ID.ARCANE_ECHO);
            const weapon = runtime.helpers.skillsById.get(ID.RIDE_THE_LIGHTNING);
            assert.equal(elementalistRechargeWork(runtime, weapon, 40), 10);
            armArcaneEcho(runtime, { skill: echo, effectiveEnd: runtime.time });
            assert.equal(runtime.profession.core.arcaneEchoUntil, 5);
            completeArcaneEcho(runtime, { start: 1 }, weapon);
            // The surcharge remains original recharge, independently of the intrinsic on-hit reduction.
            assert.equal(runtime.cooldownController.rechargeFor(echo.id).work, weapon.cooldown);
            assert.equal(runtime.profession.core.arcaneEchoUntil, 0);
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
});

test('Weave Self owns its form and Perfect Weave windows and starts recharge at activation', () => {
  const profession = preview({ [ID.WEAVE_SELF]: { duration: 30, flipDuration: 7 } });
  const context = profession.resolvePatch({ id: 'skill-tuning' }).balanceContext;
  assert.equal(facts(context, ID.WEAVE_SELF)['Weave Self window'], '30s');
  assert.equal(facts(context, ID.WEAVE_SELF)['Perfect Weave window'], '7s');
  const result = runElementalist(
    [
      { type: 'combat-start' },
      ...[ID.WEAVE_SELF, ID.AIR_ATTUNEMENT, ID.WATER_ATTUNEMENT, ID.EARTH_ATTUNEMENT].map((skillId) => ({
        type: 'cast',
        skillId
      }))
    ],
    { patchId: 'skill-tuning', specialization: 'Weaver', startAttunement: 'Fire', selectedTraitIds: [] },
    { profession }
  );
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  const state = weaverState.from(runtime);
  const firstBuff = result.events.find((event) => event.type === 'buff' && event.kind === 'weave self fire');
  assert.equal(firstBuff.duration, 30);
  // The form and its recharge share the skill's partial-cast boundary.
  assert.ok(Math.abs(runtime.cooldownController.rechargeFor(ID.WEAVE_SELF).startedAt - firstBuff.at) < 1e-9);
  const swaps = result.events.filter((event) => event.type === 'elementalist.attunement');
  const lastSwap = swaps.at(-1);
  assert.equal(lastSwap.to, 'Earth');
  assert.equal(state.weaveSelfUntil, 0);
  assert.equal(state.perfectWeaveUntil, gw2EffectExpiresAt(lastSwap.at, 7));
  assert.ok(
    Math.abs(
      runtime.cooldownController.rechargeFor(ID.EARTH_ATTUNEMENT).work - WEAVE_SELF_ATTUNEMENT_RECHARGE_SECONDS
    ) < 1e-9
  );
  const victory = context.catalog.skillsById.get(ID.TAILORED_VICTORY);
  runtime.time = state.perfectWeaveUntil;
  assert.equal(weaveSelfAvailability(runtime, victory).ready, false);
});

test('skill-owned recharge factors and attribute grants reject invalid patches and keep explicit zero', () => {
  for (const [id, field, withValue] of [
    [ID.RIDE_THE_LIGHTNING, 'rechargeMultiplier', (skill, value) => ({ ...skill, rechargeMultiplier: value })],
    [
      ID.SIGNET_OF_FIRE,
      'attributeBonuses.precision',
      (skill, value) => ({ ...skill, attributeBonuses: { precision: value } })
    ]
  ]) {
    assert.equal(
      typeof skillPatchableNumericFields(elementalistCatalog.skillsById.get(id), elementalistCatalog.skillFields)[
        field
      ],
      'number'
    );
    for (const value of [-1, NaN, Infinity, null, '3']) {
      assert.throws(() => applySkillPatch(elementalistCatalog, { skills: { [id]: { fields: { [field]: value } } } }));
    }

    const catalog = applySkillPatch(elementalistCatalog, { skills: { [id]: { fields: { [field]: 0 } } } });
    assert.equal(skillNumberFromContext({ catalog }, id, field), 0);
    for (const value of [undefined, null, NaN, Infinity, '3']) {
      assert.throws(
        () => skillNumber(withValue(catalog.skillsById.get(id), value), field),
        new RegExp(`field=${field}`)
      );
    }
  }

  assert.throws(
    () =>
      skillNumberFromContext(
        { catalog: { skillsById: new Map() }, helpers: elementalistCatalog },
        ID.WEAVE_SELF,
        'duration'
      ),
    /missing required skill/
  );
});

test('attribute grants and recharge factors validate their shape at the catalog boundary', () => {
  // Attribute keys are closed, so a misspelled grant fails instead of silently granting nothing.
  // Fixture catalogs declare the Elementalist Core fields, as the real Core module does.
  const make = (fields) =>
    createCanonicalCatalog({
      skillFields: ELEMENTALIST_CORE_SKILL_FIELDS,
      generated: [{ id: 1, name: 'Skill tuning', ...fields }]
    });
  for (const attributeBonuses of [null, [], 3, { typo: 1 }]) {
    assert.throws(() => make({ attributeBonuses }), /attributeBonuses/);
  }

  for (const value of [-1, NaN, Infinity, '3', null]) {
    assert.throws(() => make({ attributeBonuses: { precision: value } }), /attributeBonuses.precision/);
    assert.throws(() => make({ rechargeMultiplier: value }), /rechargeMultiplier/);
  }

  // Every canonical attribute is a valid grant.
  const attributes = Object.fromEntries(Object.keys(ATTRIBUTE_NAMES).map((attribute) => [attribute, 1]));
  assert.deepEqual(make({ attributeBonuses: attributes }).skillsById.get(1).attributeBonuses, attributes);
});

test('nested attribute edits preserve sibling grants and isolate the base catalog', () => {
  // Editing one named attribute must neither replace the group nor mutate a different selected patch.
  const id = ID.CONJURE_LIGHTNING_HAMMER;
  const field = 'attributeBonuses.precision';
  const base = structuredClone(elementalistCatalog.skillsById.get(id).attributeBonuses);
  const first = applySkillPatch(elementalistCatalog, { skills: { [id]: { fields: { [field]: { add: 20 } } } } });
  const second = applySkillPatch(first, { skills: { [id]: { fields: { [field]: 0 } } } });
  assert.deepEqual(elementalistCatalog.skillsById.get(id).attributeBonuses, base);
  assert.deepEqual(first.skillsById.get(id).attributeBonuses, { ...base, precision: base.precision + 20 });
  assert.deepEqual(second.skillsById.get(id).attributeBonuses, { ...base, precision: 0 });
  assert.ok(Object.isFrozen(second.skillsById.get(id).attributeBonuses));
  assert.equal(authoringNumericFieldLabel(field), 'Precision bonus (points)');
  // Only attributes the skill actually grants are editable.
  assert.throws(
    () =>
      applySkillPatch(elementalistCatalog, {
        skills: { [id]: { fields: { 'attributeBonuses.power': 100 } } }
      }),
    /does not expose/
  );
  assert.throws(
    () => applySkillPatch(elementalistCatalog, { skills: { [id]: { fields: { 'attributeBonuses.typo': 1 } } } }),
    /unsupported patch field/
  );
});

// The Elementalist modules' own declarations, combined as profession assembly combines them.
const ELEMENTALIST_FIELDS = combineFields([
  { owner: 'Core', fields: ELEMENTALIST_CORE_SKILL_FIELDS },
  { owner: 'Evoker', fields: EVOKER_SKILL_FIELDS }
]);

// Selected mechanic tuning must reject malformed data before runtime uses it.
test('skill-owned mechanic tuning validates explicit zero and numeric bounds', () => {
  for (const [id, field] of [
    [ID.SHATTERING_ICE, 'internalCooldown'],
    [ID.CALCIFY, 'internalCooldown'],
    [ID.FOXS_FURY, 'mightTierThreshold'],
    [ID.IGNITE, 'empoweredUnlockDelay'],
    [ID.IGNITE, 'tierResetDuration'],
    [ID.FROZEN_FUSILLADE, 'detonationDelay'],
    [ID.GLYPH_OF_ELEMENTALS, 'rechargeAfterExpiry'],
    [ID.GLYPH_OF_ELEMENTALS, 'summonStartupDelay'],
    [ID.SEETHE, 'nextSkillDamageMultiplier'],
    [ID.RIPPLE, 'nextSkillRechargeMultiplier'],
    [ID.ETCHING_VOLCANO, 'etchingCompletionThreshold']
  ]) {
    const zero = applySkillPatch(elementalistCatalog, { skills: { [id]: { fields: { [field]: 0 } } } });
    assert.equal(zero.skillsById.get(id)[field], 0);
    for (const value of [-1, Infinity, NaN])
      assert.throws(
        () => applySkillPatch(elementalistCatalog, { skills: { [id]: { fields: { [field]: value } } } }),
        /finite|nonnegative|number|numeric/
      );
    assert.throws(
      () =>
        createCanonicalCatalog({
          skillFields: ELEMENTALIST_FIELDS,
          generated: [{ id: 1, name: 'Invalid tuning', [field]: '1' }]
        }),
      /finite|nonnegative|number|numeric/
    );
  }
});
