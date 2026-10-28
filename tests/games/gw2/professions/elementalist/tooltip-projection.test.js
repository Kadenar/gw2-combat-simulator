import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { describeSimulationSkill, describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { acceptIgniteEffects } from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { AURA } from '#gw2/platform/constants.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// The unlock trait owns the same energy policy read by runtime and presentation.
test('Depth of Elements tooltip shares the selected Catalyst energy capacity', () => {
  const family = preview({
    balanceProfiles: { [TRAIT.DEPTH_OF_ELEMENTS]: { fields: { maximumStacks: 12 } } }
  });
  for (const [patchId, maximum] of [
    ['current', 30],
    ['tooltip-projection', 12],
    ['current', 30]
  ]) {
    const context = family.resolvePatch({ id: patchId }).balanceContext;
    assert.equal(context.catalog.balanceProfilesById.get(TRAIT.DEPTH_OF_ELEMENTS)?.maximumStacks, maximum);
    const trait = context.catalog.traits.find(({ id }) => id === TRAIT.DEPTH_OF_ELEMENTS);
    const model = describeSimulationTrait(context, trait, elementalistTooltips);
    assert.ok(!model.incomplete);
    assert.equal(model.facts.find(({ name }) => name === 'Maximum energy').detail, String(maximum));
    const result = runElementalist(
      [],
      { patchId, specialization: 'Catalyst', initialCatalystEnergy: 100 },
      { profession: family }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession[STATE.CATALYST_ENERGY].maximum, maximum);
    assert.equal(result.planningState.profession[STATE.CATALYST_ENERGY].value, maximum);
  }
});

// One aura declaration drives the granted aura, its tooltip fact, and the transmute that consumes it.
test('skill aura grants share one declaration between combat and tooltip facts', () => {
  let declared;
  let selectedCatalog;
  const run = (rotation) => {
    const result = runElementalist(
      [{ type: 'cast', skillId: ID.FIRE_SHIELD }, { type: 'wait', durationMs: 1000 }, ...rotation],
      {
        specialization: 'Core',
        startAttunement: 'Fire',
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Focus',
        selectedTraitIds: []
      },
      {
        catalog(catalog) {
          const edited = withSkill(catalog, ID.FIRE_SHIELD, {
            effects: [{ type: 'aura', aura: AURA.FIRE, duration: 7 }]
          });
          selectedCatalog = edited;
          declared = edited.skillsById.get(ID.FIRE_SHIELD);
          return edited;
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    return result;
  };

  const granted = run([]);
  assert.deepEqual(
    granted.events
      .filter((event) => event.type === 'aura')
      .map((event) => [event.sourceId, event.aura, event.duration]),
    [[ID.FIRE_SHIELD, AURA.FIRE, 7]]
  );
  assert.deepEqual(
    observedRuntime(granted).profession.core.activeAuras.map(({ type, expiresAt }) => [type, expiresAt]),
    [[AURA.FIRE, 7]]
  );
  assert.deepEqual(
    observedRuntime(run([{ type: 'cast', skillId: ID.TRANSMUTE_FIRE }])).profession.core.activeAuras,
    []
  );
  const model = describeSimulationSkill(
    { ...preview().resolvePatch({ id: 'current' }).balanceContext, catalog: selectedCatalog },
    declared,
    elementalistTooltips
  );
  assert.ok(!model.incomplete);
  assert.equal(model.facts.find(({ name }) => name === AURA.FIRE).detail, '7s');
});

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

test('skill-owned Evoker action payloads project edits and removals into tooltips and combat', () => {
  // Each selected action owns its reward independently of the other skills.
  const cases = [
    ['boons', ID.FOXS_FURY, 'boon', 'Fox Fury', 'fury', 'Fire'],
    ['zap-window', ID.ZAP, 'buff', 'Zap Window', 'zap buff', 'Air']
  ];
  for (const [actionId, skillId, type, name, factName, element] of cases) {
    for (const removed of [false, true]) {
      const profession = preview({
        skills: {
          [skillId]: {
            sideEffects: {
              [actionId]: removed ? { removeEffects: [{ type, name }] } : { effects: [{ type, name, duration: 9 }] }
            }
          }
        }
      });
      const context = profession.resolvePatch({ id: 'tooltip-projection' }).balanceContext;
      const facts = skillTooltip(context, skillId).facts.filter((fact) => fact.name.toLowerCase() === factName);
      assert.equal(facts.length, removed ? 0 : 1);

      if (!removed) assert.match(facts[0].detail, /^9s/);

      const result = simulate(profession, 'tooltip-projection', skillId, {
        evokerElement: element,
        startAttunement: element,
        selectedSkillIds: [skillId]
      });

      const grants = result.resolvedEvents.filter(
        (event) => event.type === 'buff' && event.skillId === skillId && event.kind === factName
      );
      assert.equal(grants.length, removed ? 0 : 1);

      if (!removed) assert.equal(grants[0].duration, 9);
    }
  }
});

test('enchantment action patches share charges and lifetime with tooltips and preserve independent skill effects', () => {
  for (const [skillId, name] of [
    [ID.HARES_AGILITY, 'Hare Enchantment'],
    [ID.LIGHTNING_BLITZ, 'Lightning Blitz Enchantment']
  ]) {
    for (const removed of [false, true]) {
      const profession = preview({
        skills: {
          [skillId]: {
            sideEffects: {
              'electric-enchantment': removed
                ? { removeEffects: [{ type: 'buff', name }] }
                : { effects: [{ type: 'buff', name, stacks: 2, duration: 9 }] }
            }
          }
        }
      });
      const context = profession.resolvePatch({ id: 'tooltip-projection' }).balanceContext;
      const facts = skillTooltip(context, skillId).facts.filter((fact) => fact.name === name);
      assert.equal(facts.length, removed ? 0 : 1);

      if (!removed) {
        assert.equal(facts[0].stacks, 2);
        assert.match(facts[0].detail, /^9s/);
        assert.match(facts[0].detail, /Electric Enchantment charges/);
      }

      const result = simulate(profession, 'tooltip-projection', skillId, {
        evokerElement: 'Air',
        initialEndurance: 0,
        selectedSkillIds: [ID.HARES_AGILITY],
        initialEvokerEmpowered: skillId === ID.LIGHTNING_BLITZ ? 3 : 0,
        selectedTraitIds: [TRAIT.ALTRUISTIC_ASPECT]
      });
      const grants = result.events.filter(
        (event) => event.type === 'proc' && event.name === 'Electric Enchantment' && event.detail?.startsWith('+')
      );
      assert.equal(grants.length, removed ? 0 : 1);

      if (!removed) {
        assert.equal(grants[0].detail, '+2 stacks');
        assert.equal(grants[0].sourceId, skillId);
      }

      assert.equal(
        result.resolvedEvents.some((event) => event.skillName === 'Electric Enchantment'),
        !removed
      );
      assert.ok(
        result.resolvedEvents.some(
          (event) => event.type === 'damage' && event.skillId === skillId && event.actorType === 'player'
        )
      );
      const state = observedRuntime(result).profession.specialization.state;

      if (skillId === ID.LIGHTNING_BLITZ) {
        assert.equal(state.empoweredCharges.value, 0);
      } else {
        assert.ok(
          observedRuntime(result).profession.core.endurance.value >= 50,
          'The independent endurance grant remains active'
        );
        assert.ok(result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'swiftness'));
        assert.ok(
          result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'fury'),
          'Altruistic Aspect remains active'
        );
      }
    }
  }
});

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
    const context = profession.resolvePatch({ id: 'tooltip-projection' }).balanceContext;
    const facts = skillTooltip(context, ID.TOADS_FORTITUDE).facts.filter((fact) => fact.name === 'Resistance');
    assert.equal(facts.length, removed ? 0 : 1);

    if (!removed) {
      assert.match(facts[0].detail, /^9s/);
      assert.match(facts[0].detail, /only in Earth/);
      assert.match(facts[0].detail, /party/);
    }

    for (const element of ['Earth', 'Fire']) {
      const result = simulate(profession, 'tooltip-projection', ID.TOADS_FORTITUDE, {
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
        assert.equal(grant.duration, 9);
        assert.equal(grant.audience.recipients, 'party');
        assert.equal(grant.audience.maximumRecipients, 3);
        assert.equal(grant.resolvedAudience.includesSelf, true);
        assert.equal(grant.resolvedAudience.alliedPlayerCount, 2);
        // The skill reward settles before the trait reward at the same completion boundary.
        assert.equal(grant.at, stability.at);
        assert.ok(grant.eventOrder < stability.eventOrder);
        assert.equal(grant.activationId, stability.activationId);
      }

      assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.TOADS_FORTITUDE));
      assert.ok(
        result.resolvedEvents.some(
          (event) =>
            event.type === 'condition' && event.skillId === ID.TOADS_FORTITUDE && event.condition === 'Bleeding'
        )
      );
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
      const context = profession.resolvePatch({ id: patchId }).balanceContext;
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

// Tier templates supply duration only; the native skill continues to own stack counts and additional conditions.
test('Ignite tier facts and combat preserve native stacks and non-Burning conditions', () => {
  const profession = preview({
    skills: {
      [ID.IGNITE]: {
        effects: [{ type: 'condition', condition: 'Burning', stacks: 3 }],
        addEffects: [{ type: 'condition', condition: 'Poisoned', stacks: 2, duration: 4 }],
        sideEffects: { 'burning-tiers': { effects: [{ type: 'condition', name: 'Tier 1', duration: 7, stacks: 9 }] } }
      }
    }
  });
  for (const patchId of ['current', 'tooltip-projection']) {
    const context = profession.resolvePatch({ id: patchId }).balanceContext;
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
        : {
            skills: {
              [ID.IGNITE]: {
                sideEffects: { 'burning-tiers': { removeEffects: [{ type: 'condition', name: 'Tier 2' }] } }
              }
            }
          }
    );
    const context = profession.resolvePatch({ id: 'tooltip-projection' }).balanceContext;
    const model = skillTooltip(context, ID.IGNITE);
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
      const tab = model.factTabs.find(({ label }) => label === `Tier ${tier + 1}`);
      assert.equal(
        tab.facts.some(({ name }) => name === 'Burning'),
        expectedBurning
      );
      assert.ok(tab.facts.some(({ name }) => name === 'Strike damage'));
    }

    assert.ok(
      skillTooltip(profession.resolvePatch({ id: 'current' }).balanceContext, ID.IGNITE).factTabs.every(({ facts }) =>
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
        sideEffects: { 'burning-tiers': { removeEffects: [{ type: 'condition', name: 'Tier 1' }] } },
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
    }
  });
  const context = profession.resolvePatch({ id: 'tooltip-projection' }).balanceContext;
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
    const context = profession.resolvePatch({ id: patchId }).balanceContext;
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
    const context = profession.resolvePatch({ id: patchId }).balanceContext;
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
