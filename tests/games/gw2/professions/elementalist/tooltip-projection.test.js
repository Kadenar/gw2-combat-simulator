import { describeSimulationSkill, describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import {
  captureIgniteTier,
  selectIgniteEffects
} from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const IGNITE_PROFILE = 'elementalist.evoker.ignite';

/** Keep preview selection explicit so every edited tooltip can be compared with live tuning and combat. */
function preview(edits = {}) {
  return withPatchPreview(elementalistProfession, {
    id: 'tooltip-projection',
    label: 'Tooltip projection',
    professions: { elementalist: edits }
  });
}

function skillTooltip(context, id) {
  const model = describeSimulationSkill(context, context.catalog.skillsById.get(id), elementalistTooltips);
  assert.ok(!model.incomplete);
  return model;
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

test('skill-owned Evoker utility profiles project edits and removals into tooltips and combat', () => {
  // Each skill owns its conditional reward; editing one profile must leave the other owners untouched.
  const cases = [
    [PROFILE.foxsFury, ID.FOXS_FURY, 'boon', 'Fox Fury', 'fury', 'Fire'],
    [PROFILE.toadsFortitude, ID.TOADS_FORTITUDE, 'boon', 'Toad Resistance', 'resistance', 'Earth'],
    [PROFILE.haresAgility, ID.HARES_AGILITY, 'buff', 'Hare Enchantment', 'hare enchantment', 'Air'],
    [PROFILE.zap, ID.ZAP, 'buff', 'Zap Window', 'zap buff', 'Air'],
    [
      PROFILE.lightningBlitz,
      ID.LIGHTNING_BLITZ,
      'buff',
      'Lightning Blitz Enchantment',
      'lightning blitz enchantment',
      'Air'
    ]
  ];
  for (const [profileId, skillId, type, name, factName, element] of cases) {
    for (const removed of [false, true]) {
      const profession = preview({
        balanceProfiles: {
          [profileId]: removed ? { removeEffects: [{ type, name }] } : { effects: [{ type, name, duration: 9 }] }
        }
      });
      const context = profession.balanceContextFor('tooltip-projection');
      assert.equal(context.catalog.balanceProfilesById.get(profileId).parentId, skillId);
      for (const [otherProfile] of cases) {
        if (otherProfile === profileId) continue;
        assert.deepEqual(
          context.catalog.balanceProfilesById.get(otherProfile).effects,
          profession.balanceContextFor('current').catalog.balanceProfilesById.get(otherProfile).effects
        );
      }

      const facts = skillTooltip(context, skillId).facts.filter((fact) => fact.name.toLowerCase() === factName);
      assert.equal(facts.length, removed ? 0 : 1);
      if (!removed) assert.match(facts[0].detail, /^9s/);
      const result = simulate(profession, 'tooltip-projection', skillId, {
        evokerElement: element,
        startAttunement: element,
        initialEvokerEmpowered: skillId === ID.LIGHTNING_BLITZ ? 3 : 0,
        selectedSkillIds: [skillId]
      });
      if (skillId === ID.HARES_AGILITY || skillId === ID.LIGHTNING_BLITZ) {
        assert.equal(
          result.events.some(
            (event) => event.type === 'proc' && event.name === 'Electric Enchantment' && event.detail?.startsWith('+')
          ),
          !removed
        );
      } else {
        const grants = result.resolvedEvents.filter(
          (event) => event.type === 'buff' && event.skillId === skillId && event.kind === factName
        );
        assert.equal(grants.length, removed ? 0 : 1);
        if (!removed) assert.equal(grants[0].duration, 9);
      }
    }
  }
});

// Named boons retain their element groups when the first effect is removed or the profile order changes.
test('Familiar blessing previews preserve the runtime element choice after removal and reordering', () => {
  for (const reordered of [false, true]) {
    const profession = preview({
      balanceProfiles: {
        [TRAIT.FAMILIARS_BLESSING]: {
          removeEffects: reordered ? [{ type: 'boon', all: true }] : [{ type: 'boon', name: 'Quickness' }],
          ...(reordered
            ? {
                addEffects: [
                  { type: 'boon', name: 'Alacrity', boon: 'alacrity', stacks: 1, duration: 7 },
                  { type: 'boon', name: 'Quickness', boon: 'quickness', stacks: 1, duration: 3 }
                ]
              }
            : {})
        }
      }
    });
    for (const patchId of ['current', 'tooltip-projection']) {
      const context = profession.balanceContextFor(patchId);
      const model = describeSimulationTrait(
        context,
        context.catalog.traits.find(({ id }) => id === TRAIT.FAMILIARS_BLESSING),
        elementalistTooltips,
        'Evoker'
      );
      const alacrity = model.facts.find(({ name }) => name === 'Alacrity');
      assert.match(alacrity.detail, /Water \/ Earth familiar/);
      const quickness = model.facts.find(({ name }) => name === 'Quickness');
      const hasQuickness = reordered || patchId === 'current';
      assert.equal(Boolean(quickness), hasQuickness);
      if (quickness) assert.match(quickness.detail, /Fire \/ Air familiar/);
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
        if (grants.length) {
          assert.equal(grants[0].kind, boon);
          const expectedDuration =
            patchId === 'tooltip-projection' && reordered
              ? boon === 'quickness'
                ? 3
                : 7
              : boon === 'quickness'
                ? 1.75
                : 4;
          assert.equal(grants[0].duration, expectedDuration);
        }
      }
    }
  }
});

// Tier profiles supply duration only; the native skill continues to own stack counts and additional conditions.
test('Ignite tier facts and combat preserve native stacks and non-Burning conditions', () => {
  const profession = preview({
    skills: {
      [ID.IGNITE]: {
        effects: [{ type: 'condition', condition: 'Burning', stacks: 3 }],
        addEffects: [{ type: 'condition', condition: 'Poisoned', stacks: 2, duration: 4 }]
      }
    },
    balanceProfiles: { [IGNITE_PROFILE]: { effects: [{ type: 'condition', name: 'Tier 1', duration: 7, stacks: 9 }] } }
  });
  for (const patchId of ['current', 'tooltip-projection']) {
    const context = profession.balanceContextFor(patchId);
    const facts = skillTooltip(context, ID.IGNITE).factTabs.find(({ label }) => label === 'Tier 1').facts;
    const burning = facts.find(({ name }) => name === 'Burning');
    const patched = patchId === 'tooltip-projection';
    assert.equal(burning.stacks, patched ? 3 : 1);
    assert.equal(burning.detail, patched ? '7s' : '2s');
    assert.equal(
      facts.some(({ name }) => name === 'Poisoned'),
      patched
    );
    const result = simulate(profession, patchId, ID.IGNITE);
    const packets = result.events.filter((event) => event.type === 'condition' && event.skillId === ID.IGNITE);
    const application = packets.find(({ condition }) => condition === 'Burning');
    assert.equal(application.stacks, burning.stacks);
    assert.equal(application.duration, patched ? 7 : 2);
    assert.equal(
      packets.some(({ condition }) => condition === 'Poisoned'),
      patched
    );
  }
});

// Native packet removal and tier removal are independent: neither can be reconstructed by presentation.
test('Ignite removal preserves tier identity and suppresses Burning in both consumers', () => {
  for (const nativeRemoved of [true, false]) {
    const profession = preview(
      nativeRemoved
        ? { skills: { [ID.IGNITE]: { removeEffects: [{ type: 'condition', condition: 'Burning' }] } } }
        : { balanceProfiles: { [IGNITE_PROFILE]: { removeEffects: [{ type: 'condition', name: 'Tier 2' }] } } }
    );
    const context = profession.balanceContextFor('tooltip-projection');
    const model = skillTooltip(context, ID.IGNITE);
    const state = evokerState.create();
    const runtime = { helpers: context.catalog, profession: { specialization: { kind: 'Evoker', state } } };
    for (let tier = 0; tier < 4; tier++) {
      const cast = { id: `ignite-${tier}`, start: tier, skill: context.catalog.skillsById.get(ID.IGNITE) };
      captureIgniteTier(runtime, cast);
      const expectedBurning = !nativeRemoved && tier !== 1;
      assert.equal(
        selectIgniteEffects(cast).some((effect) => effect.type === 'condition' && effect.condition === 'Burning'),
        expectedBurning
      );
      const tab = model.factTabs.find(({ label }) => label === `Tier ${tier + 1}`);
      assert.equal(
        tab.facts.some(({ name }) => name === 'Burning'),
        expectedBurning
      );
      assert.ok(tab.facts.some(({ name }) => name === 'Strike damage'));
    }

    assert.ok(
      skillTooltip(profession.balanceContextFor('current'), ID.IGNITE).factTabs.every(({ facts }) =>
        facts.some(({ name }) => name === 'Burning')
      )
    );
    if (nativeRemoved) {
      const result = simulate(profession, 'tooltip-projection', ID.IGNITE);
      assert.equal(
        result.events.some(
          (event) => event.type === 'condition' && event.condition === 'Burning' && event.skillId === ID.IGNITE
        ),
        false
      );
    }
  }
});

// Mixed tick sequences retain unrelated conditions even when the accepted Burning tier is absent.
test('Ignite mixed condition timelines share tier removal semantics with tooltip alternatives', () => {
  const profession = preview({
    skills: {
      [ID.IGNITE]: {
        removeEffects: [{ type: 'condition', condition: 'Burning' }],
        addEffects: [
          {
            type: 'condition',
            ticks: [
              { atMs: 100, condition: 'Burning', stacks: 3, duration: 99 },
              { atMs: 200, condition: 'Poisoned', stacks: 2, duration: 4 }
            ]
          }
        ]
      }
    },
    balanceProfiles: { [IGNITE_PROFILE]: { removeEffects: [{ type: 'condition', name: 'Tier 1' }] } }
  });
  const context = profession.balanceContextFor('tooltip-projection');
  const facts = skillTooltip(context, ID.IGNITE).factTabs[0].facts;
  assert.equal(
    facts.some(({ name }) => name === 'Burning'),
    false
  );
  assert.equal(facts.find(({ name }) => name === 'Poisoned').stacks, 2);
  const result = simulate(profession, 'tooltip-projection', ID.IGNITE);
  const conditions = result.events.filter((event) => event.type === 'condition' && event.skillId === ID.IGNITE);
  assert.deepEqual(
    conditions.map(({ condition, stacks, duration }) => ({ condition, stacks, duration })),
    [{ condition: 'Poisoned', stacks: 2, duration: 4 }]
  );
});

// Procession shares the direct-effect filter, including selected edits and removals, without replaying added boons.
test('Elemental Procession tooltip and combat use the same selected familiar payloads', () => {
  const profession = preview({
    skills: {
      [ID.CONFLAGRATION]: {
        removeEffects: [{ type: 'strike', all: true }],
        effects: [{ type: 'condition', condition: 'Burning', stacks: 3 }],
        addEffects: [{ type: 'boon', boon: 'might', stacks: 9, duration: 7 }]
      }
    }
  });
  for (const patchId of ['current', 'tooltip-projection']) {
    const context = profession.balanceContextFor(patchId);
    const facts = skillTooltip(context, ID.ELEMENTAL_PROCESSION).facts.filter(({ detail }) =>
      detail.includes('Conflagration')
    );
    const patched = patchId === 'tooltip-projection';
    assert.equal(
      facts.some(({ name }) => name === 'Strike damage'),
      !patched
    );
    assert.equal(
      facts.some(({ name }) => name === 'Might'),
      false
    );
    const burning = facts.find(({ name }) => name === 'Burning');
    assert.ok(burning);
    if (patched) assert.equal(burning.stacks, 3);
    const result = simulate(profession, patchId, ID.ELEMENTAL_PROCESSION, {
      selectedSkillIds: [ID.ELEMENTAL_PROCESSION]
    });
    const packets = result.events.filter((event) => event.skillId === ID.CONFLAGRATION);
    assert.equal(
      packets.some(({ type }) => type === 'damage'),
      !patched
    );
    const applications = packets.filter(({ type, condition }) => type === 'condition' && condition === 'Burning');
    assert.ok(applications.length > 0);
    assert.ok(applications.every(({ stacks }) => stacks === burning.stacks));
    // Fire Familiar can independently grant Might on impact; the added nine-stack payload must not be replayed.
    assert.equal(
      result.resolvedEvents.some(
        (event) =>
          event.type === 'buff' && event.kind === 'might' && event.skillId === ID.CONFLAGRATION && event.stacks === 9
      ),
      false
    );
  }
});

// The displayed Power slope must match the condition query under both live and preview trait tuning.
test('Inferno tooltip derives its Power rate from the canonical Burning formula', () => {
  const profession = preview({ balanceProfiles: { [TRAIT.INFERNO]: { fields: { coefficientMultiplier: 0.5 } } } });
  for (const [patchId, rate] of [
    ['current', 0.0825],
    ['tooltip-projection', 0.0775]
  ]) {
    const context = profession.balanceContextFor(patchId);
    const model = describeSimulationTrait(
      context,
      context.catalog.traits.find(({ id }) => id === TRAIT.INFERNO),
      elementalistTooltips,
      'Core'
    );
    assert.equal(model.facts.find(({ name }) => name === 'Burning damage per second per power').detail, String(rate));
    const attributes = elementalistProfession.runtimeFor({}).modifyConditionAttributes(
      {
        catalog: context.catalog,
        config: { selectedTraitIds: [TRAIT.INFERNO] },
        event: { type: 'condition', condition: 'Burning', actorType: 'player' }
      },
      { power: 2000, conditionDamage: 100 }
    );
    assert.ok(Math.abs(attributes.conditionDamage * CONDITION_FORMULAS.Burning.scaling - 2000 * rate) < 1e-10);
  }
});
