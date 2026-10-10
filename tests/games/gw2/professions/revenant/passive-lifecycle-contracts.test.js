import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { draconicEcho } from '#gw2/professions/revenant/specializations/herald/traits/index.js';
import { evaluateAttributeDeclarations } from '#tests/helpers/attribute-declarations.js';
import { gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { revenantCoreModifiers } from '#gw2/professions/revenant/core/modifiers.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { heraldAttributes } from '#gw2/professions/revenant/specializations/herald/modifiers.js';
import { heraldModule } from '#gw2/professions/revenant/specializations/herald/module.js';
import { createHeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { revenantHit, runRevenant } from '#tests/helpers/revenant-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const heraldPassiveModifierRules = heraldModule.modifiers.modifierRules.filter((rule) =>
  rule.id.startsWith('revenant.draconic-echo-')
);

const base = {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
  startingLegend: LEGEND.ASSASSIN,
  selectedTraitIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
};
const simulate = createObservedProfessionSimulator(revenantProfession, base);
const wait = (durationMs) => ({ type: 'wait', durationMs });

// Minimal resource histories include delayed applications, pooled duration, and timestamped extension.
test('Endurance accrual and readiness integrate the same Vigor windows regardless of wait boundaries', () => {
  const initialize = (runtime) => {
    runtime.profession.core.endurance.value = 0;
    for (const event of [
      { type: 'buff', at: 1, kind: 'vigor', duration: 2, stacks: 1 },
      { type: 'buff', at: 2, kind: 'vigor', duration: 1, stacks: 1 },
      { type: 'boon_extension', at: 3, kind: 'vigor', duration: 1, extensionAudience: 'self' }
    ])
      runtime.effects.emit({
        kind: 'packet',
        event: { ...event, source: 'fixture', sourceId: 'fixture', actorType: 'player' }
      });
  };

  const run = (rotation) => runRevenant(rotation, base, { initialize });

  // A 50-endurance Dodge becomes affordable exactly when the integrated Vigor windows reach its cost.
  assert.equal(run(['Dodge']).steps[0].start, 8000);
  for (const waits of [[8000], [1000, 1000, 1000, 1000, 1000, 2000, 1000]])
    assert.equal(run(waits.map(wait)).planningState.profession.endurance.value, 50);
});

test('Vindicator Vigor produces equal endurance for equivalent public waits', () => {
  const rotation = ['Dodge', 'Dodge', 'Energy Meld', 'Dodge'];
  const config = { selectedTraitIds: [TRAIT.SONG_OF_ARBOREUM] };
  const single = simulate('Vindicator', [...rotation, wait(12000)], config);
  const split = simulate('Vindicator', [...rotation, wait(6000), wait(6000)], config);
  assert.deepEqual(single.warnings, []);
  assert.deepEqual(split.warnings, []);
  assert.equal(single.planningState.profession.endurance.value, split.planningState.profession.endurance.value);
});

test('Ancient Echo selects exactly the active Core legend package', () => {
  for (const [legend, kind, duration, stacks] of [
    [LEGEND.ASSASSIN, 'unblockable', 5, 2],
    [LEGEND.CENTAUR, 'regeneration', 5, 1],
    [LEGEND.DEMON, 'resistance', 3, 1],
    [LEGEND.DWARF, 'rite-of-the-great-dwarf', 3, 1]
  ]) {
    const result = simulate('Core', ['__combat_start', 'Ancient Echo'], {
      selectedLegends: [legend, legend === LEGEND.ASSASSIN ? LEGEND.DEMON : LEGEND.ASSASSIN],
      startingLegend: legend
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      result.events.filter((event) => event.type === 'buff').map((event) => [event.kind, event.duration, event.stacks]),
      [[kind, duration, stacks]]
    );
    assert.equal(result.planningState.profession.energy.value, 75 + result.rotationEndTime * 5);
  }
});

test('Found Purpose requires combat for a legend invocation', () => {
  const config = { selectedTraitIds: [TRAIT.FOUND_PURPOSE], selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY] };
  const before = simulate('Conduit', ['Swap Legends', wait(1000), '__combat_start'], config);
  const during = simulate('Conduit', ['__combat_start', 'Swap Legends'], config);
  assert.deepEqual(before.warnings, []);
  assert.deepEqual(during.warnings, []);
  assert.equal(
    before.events.some((event) => event.type === 'buff'),
    false
  );
  assert.ok(during.events.some((event) => event.type === 'buff' && event.kind === 'fury'));
});

test("Assassin's Presence pulses during idle combat and attacks cannot move the cadence", () => {
  const config = { selectedTraitIds: [TRAIT.ASSASSINS_PRESENCE, TRAIT.INCENSED_RESPONSE] };
  const idle = simulate('Core', [wait(5000), '__combat_start', wait(21000)], config);
  const attack = simulate(
    'Core',
    [wait(5000), '__combat_start', wait(4000), 'Preparation Thrust', wait(17000)],
    config
  );
  const pulses = (result) =>
    result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.ASSASSINS_PRESENCE);
  assert.deepEqual(
    pulses(idle).map((event) => event.at),
    [5, 15, 25]
  );
  assert.deepEqual(
    pulses(attack).map((event) => event.at),
    [5, 15, 25]
  );
  assert.ok(pulses(idle).every((event) => event.duration === 3 && event.resolvedAudience.includesSelf));
  assert.ok(idle.events.some((event) => event.sourceId === TRAIT.INCENSED_RESPONSE));
  assert.equal(
    revenantCoreModifiers.modifyCriticalChance(
      {
        config: { ...config, selectedTraitIds: [...config.selectedTraitIds, TRAIT.ROILING_MISTS] },
        time: 1,
        event: { actorType: 'player' },
        boons: new Map(),
        buffs: new Map()
      },
      0.05
    ),
    0.05
  );
});

test('Draconic Echo retains bounded facet pulses without upkeep drain, including after a legend swap', () => {
  const config = {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON,
    selectedTraitIds: [TRAIT.DRACONIC_ECHO]
  };
  const rotation = ['__combat_start', 'Facet of Strength', 'Burst of Strength'];
  const consumed = simulate('Herald', rotation, config);
  const retained = simulate('Herald', [...rotation, wait(7000)], config);
  const swapped = simulate('Herald', [...rotation, 'Swap Legends', wait(7000)], config);
  const absent = simulate('Herald', [...rotation, wait(7000)], { ...config, selectedTraitIds: [] });
  const pulses = (result) =>
    result.events.filter((event) => event.type === 'buff' && event.skillId === SKILL.FACET_OF_STRENGTH);
  const consumeAt = consumed.rotationEndTime;
  assert.deepEqual(retained.warnings, []);
  assert.deepEqual(retained.planningState.profession.activeUpkeeps, []);
  assert.ok(
    Math.abs(retained.planningState.profession.energy.value - consumed.planningState.profession.energy.value - 35) <
      1e-9
  );
  assert.ok(pulses(retained).some((event) => event.at > consumeAt));
  assert.ok(pulses(retained).every((event) => event.at < consumeAt + 6));
  assert.deepEqual(
    pulses(swapped).map((event) => event.at),
    pulses(retained).map((event) => event.at)
  );
  assert.equal(pulses(absent).length, 0);
});

test('Draconic Echo bonuses apply to active and retained facets only while selected', () => {
  const core = createRevenantCoreState(base);
  const state = createHeraldState();
  const context = {
    config: { ...base, selectedTraitIds: [TRAIT.DRACONIC_ECHO] },
    // Distinct facet values verify that each selected balance field controls only its own bonus.
    catalog: applyBalanceProfilePatch(revenantCatalog, {
      balanceProfiles: {
        'revenant.draconic-echo': {
          fields: {
            damageIncrease: 0.2,
            conditionDamageIncrease: 0.3,
            criticalChanceBonus: 0.15,
            boonDurationBonus: 20
          }
        }
      }
    }),
    time: 2,
    event: { actorType: 'player' },
    runtime: { profession: { core, specialization: { kind: 'Herald', state } } }
  };
  for (const [index, skillId] of [
    SKILL.FACET_OF_STRENGTH,
    SKILL.FACET_OF_ELEMENTS,
    SKILL.FACET_OF_DARKNESS
  ].entries()) {
    const rule = heraldPassiveModifierRules[index];
    assert.equal(index < 2 ? rule.factor(context) : rule.amount(context), [1.2, 1.3, 0.15][index]);
    core.activeUpkeeps = [{ skillId, startsAt: 0 }];
    assert.equal(rule.when(context), true);
    core.activeUpkeeps = [];
    state.lingeringFacets[skillId] = { startsAt: 1, expiresAt: 7, legendId: LEGEND.DRAGON };
    assert.equal(rule.when(context), true);
    assert.equal(rule.when({ ...context, time: 7 }), false);
    assert.equal(rule.when({ ...context, config: base }), false);
  }

  core.activeUpkeeps = [{ skillId: SKILL.FACET_OF_NATURE, startsAt: 0 }];
  assert.equal(
    evaluateAttributeDeclarations(context, { boonDurationBonus: 5 }, (context) => [
      ...heraldAttributes(context),
      ...(hasTrait(context, TRAIT.DRACONIC_ECHO) ? [draconicEcho.attributes(context)] : [])
    ]).boonDurationBonus,
    25
  );
});

test('Assassin Nature procs only on eligible resolved strikes while its passive is available', () => {
  // Probe tasks end the active facet and later retain it, isolating active and lingering eligibility.
  const result = runRevenant(
    [wait(10000)],
    { ...base, specialization: 'Herald' },
    {
      extend: (native) => ({
        tasks: {
          ...native.tasks,
          'test.end-facet': (runtime) => (runtime.profession.core.activeUpkeeps = []),
          'test.retain-facet': (runtime) =>
            (runtime.profession.specialization.state.lingeringFacets[SKILL.FACET_OF_NATURE] = {
              startsAt: 3,
              expiresAt: 9,
              legendId: LEGEND.ASSASSIN
            })
        }
      }),
      initialize(runtime) {
        runtime.profession.core.activeUpkeeps = [
          { skillId: SKILL.FACET_OF_NATURE, startsAt: 0, upkeepCost: 0, empoweredNextPulse: false }
        ];
        runtime.schedule('test.end-facet', 2);
        runtime.schedule('test.retain-facet', 3);
        // A zero-coefficient packet cannot proc; the second strike falls inside the 0.52-second cooldown.
        runtime.effects.emit({ kind: 'packet', event: revenantHit(0.5, { coefficient: 0 }) });
        for (const at of [1, 1.2, 2.5, 4, 9]) runtime.effects.emit({ kind: 'packet', event: revenantHit(at) });
      }
    }
  );
  const siphons = result.resolvedEvents.filter((event) => event.name === 'Facet of Nature — Life Siphon');
  // The siphon's own effect-owned packet never recurses, and the retained passive ends at its exclusive expiry.
  assert.deepEqual(
    siphons.map((event) => event.at),
    [1, 4]
  );
  assert.ok(siphons.every((event) => event.flatStrikeBase === 53 && event.flatStrikePowerCoeff === 0.0666));
});

// The same live attributes feed skills, traits, equipment, and resolver-created combo boons.
test('Nature changes passive with the active legend without adding Concentration or exceeding 120 percent', () => {
  const core = createRevenantCoreState(base);
  core.activeUpkeeps = [{ skillId: SKILL.FACET_OF_NATURE, startsAt: 0 }];
  const state = createHeraldState();
  const context = {
    config: base,
    time: 2,
    event: { actorType: 'effect' },
    runtime: { profession: { core, specialization: { kind: 'Herald', state } } }
  };
  const attributes = { concentration: 1500, boonDurationBonus: 25 };
  for (const legend of [LEGEND.DRAGON, LEGEND.ASSASSIN, LEGEND.DEMON, LEGEND.CENTAUR, LEGEND.DWARF]) {
    core.activeLegendId = legend;
    const stats = evaluateAttributeDeclarations(context, attributes, (context) => [
      ...heraldAttributes(context),
      ...(hasTrait(context, TRAIT.DRACONIC_ECHO) ? [draconicEcho.attributes(context)] : [])
    ]);
    assert.equal(stats.concentration, 1500);
    assert.equal(stats.boonDurationBonus, 25);
    assert.equal(
      gw2BoonDurationMultiplier('might', stats, { boonDurationBonus: 10 }),
      legend === LEGEND.DRAGON ? 2.2 : 2
    );
    const resolver = { config: {}, query: { statsAt: () => stats } };
    assert.equal(gw2ResolverBoonDuration(resolver, { at: 2 }, 'might', 10), legend === LEGEND.DRAGON ? 22 : 20);
  }

  core.activeUpkeeps = [];
  core.activeLegendId = LEGEND.DRAGON;
  assert.equal(
    gw2BoonDurationMultiplier(
      'might',
      evaluateAttributeDeclarations(context, attributes, (context) => [
        ...heraldAttributes(context),
        ...(hasTrait(context, TRAIT.DRACONIC_ECHO) ? [draconicEcho.attributes(context)] : [])
      ])
    ),
    2
  );
});

test('Nature adds outgoing Assassin damage only while its passive is available', () => {
  const enabled = simulate('Herald', ['Facet of Nature', 'Preparation Thrust']);
  const disabled = simulate('Herald', ['Preparation Thrust']);
  const consumed = simulate('Herald', ['Facet of Nature', 'True Nature', 'Preparation Thrust']);
  const swapped = simulate('Herald', ['Facet of Nature', 'Swap Legends', 'Preparation Thrust']);
  const entered = simulate('Herald', ['Facet of Nature', 'Swap Legends', 'Preparation Thrust'], {
    startingLegend: LEGEND.DRAGON
  });
  const siphons = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.damageKind === 'life-steal' && event.skillId === SKILL.FACET_OF_NATURE
    );
  assert.deepEqual(enabled.warnings, []);
  assert.equal(siphons(enabled).length, 1);
  assert.ok(siphons(enabled)[0].damage > 0);
  assert.equal(siphons(disabled).length, 0);
  // Consuming ends the passive; entering Assassin enables it without a second activation.
  assert.equal(
    siphons(consumed).some((event) => event.triggeredBy === 'Preparation Thrust'),
    false
  );
  assert.equal(siphons(swapped).length, 0);
  assert.deepEqual(entered.warnings, []);
  assert.equal(siphons(entered).length, 1);
});

// Each accepted variant restores exactly one live reward; Song replaces it, and cancellation grants neither.
test('Energy Meld declares one endurance reward for each trait selection and variant', () => {
  for (const skillId of [SKILL.ENERGY_MELD, SKILL.ENERGY_MELD_ID_72058]) {
    for (const song of [false, true]) {
      for (const cancelled of [false, true]) {
        const result = runRevenant(
          [{ type: 'cast', skillId, ...(cancelled ? { interruptAfterMs: 100 } : {}) }],
          { specialization: 'Vindicator', selectedTraitIds: song ? [TRAIT.SONG_OF_ARBOREUM] : [] },
          {
            catalog: (catalog) => withSkill(catalog, skillId, { resourceGain: 17 }),
            initialize: (runtime) => {
              runtime.profession.core.endurance.value = 0;
            }
          }
        );
        assert.deepEqual(result.warnings, []);
        const expected = result.rotationEndTime * 5 + (cancelled ? 0 : song ? 40 : 17);
        assert.ok(Math.abs(result.planningState.profession.endurance.value - expected) < 1e-9);
      }
    }
  }
});
