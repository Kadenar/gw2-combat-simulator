import assert from 'node:assert/strict';
import test from 'node:test';
import { revenantProfession, revenantCatalog } from '#gw2/professions/revenant/profession.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { createHeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { advanceRevenantEnergy, revenantEnduranceReadyAt } from '#gw2/professions/revenant/core/mechanics/energy.js';
import {
  heraldPassiveModifierRules,
  modifyHeraldPassiveAttributes,
  resolveNatureSiphon
} from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';
import { revenantCoreAttributeRules } from '#gw2/professions/revenant/core/traits/modifiers.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';

const base = {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
  startingLegend: LEGEND.ASSASSIN,
  selectedTraitIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
};
const simulate = createProfessionSimulator(revenantProfession, base);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const self = { includesSelf: true, alliedPlayerCount: 0, companionIds: [], recipientCount: 1 };

// Minimal resource histories include delayed applications, pooled duration, and timestamped extension.
test('Endurance accrual and readiness integrate the same Vigor windows regardless of wait boundaries', () => {
  const events = [
    { type: 'buff', at: 1, kind: 'vigor', duration: 2, stacks: 1, resolvedAudience: self },
    { type: 'buff', at: 2, kind: 'vigor', duration: 1, stacks: 1, resolvedAudience: self },
    { type: 'boon_extension', at: 3, kind: 'vigor', duration: 1, extensionAudience: 'self' }
  ];
  const run = (boundaries) => {
    const core = createRevenantCoreState(base);
    core.endurance = 0;
    const context = {
      config: base,
      catalog: revenantCatalog,
      events,
      start: 0,
      state: {
        profession: { core, specialization: { kind: 'Herald', state: createHeraldState() } },
        cooldowns: new Map()
      },
      tasks: { cancelOwner() {} },
      schedulerPolicy: {},
      emit() {}
    };
    assert.equal(revenantEnduranceReadyAt(context, 50), 8);
    for (const at of boundaries) advanceRevenantEnergy(context, at);
    return core.endurance;
  };

  assert.equal(run([8]), 50);
  assert.equal(run([1, 2, 3, 4, 5, 7, 8]), 50);
});

test('Vindicator Vigor produces equal endurance for equivalent public waits', () => {
  const rotation = ['Dodge', 'Dodge', 'Energy Meld', 'Dodge'];
  const config = { selectedTraitIds: [TRAIT.SONG_OF_ARBOREUM] };
  const single = simulate('Vindicator', [...rotation, wait(12000)], config);
  const split = simulate('Vindicator', [...rotation, wait(6000), wait(6000)], config);
  assert.deepEqual(single.warnings, []);
  assert.deepEqual(split.warnings, []);
  assert.equal(single.planningState.profession.endurance, split.planningState.profession.endurance);
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
    assert.equal(result.planningState.profession.energy, 75 + result.rotationEndTime * 5);
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
    revenantCoreAttributeRules.modifyCriticalChance(
      {
        config: { ...config, selectedTraitIds: [...config.selectedTraitIds, TRAIT.ROILING_MISTS] },
        time: 1,
        event: { actorType: 'player' },
        boons: new Map()
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
  assert.equal(retained.planningState.profession.energy - consumed.planningState.profession.energy, 35);
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
    core.activeUpkeeps = [{ skillId, startsAt: 0 }];
    assert.equal(rule.when(context), true);
    core.activeUpkeeps = [];
    state.lingeringFacets[skillId] = { startsAt: 1, expiresAt: 7, legendId: LEGEND.DRAGON };
    assert.equal(rule.when(context), true);
    assert.equal(rule.when({ ...context, time: 7 }), false);
    assert.equal(rule.when({ ...context, config: base }), false);
  }

  core.activeUpkeeps = [{ skillId: SKILL.FACET_OF_NATURE, startsAt: 0 }];
  assert.equal(modifyHeraldPassiveAttributes(context, { boonDurationBonus: 5 }).boonDurationBonus, 15);
});

test('Assassin Nature procs only on eligible resolved strikes while its passive is available', () => {
  const core = createRevenantCoreState(base);
  core.activeUpkeeps = [{ skillId: SKILL.FACET_OF_NATURE, startsAt: 0 }];
  const state = createHeraldState();
  const emitted = [];
  const profession = { core, specialization: { kind: 'Herald', state } };
  const context = {
    config: base,
    catalog: revenantCatalog,
    profession,
    queue: { enqueue: (event) => emitted.push(event) }
  };
  const hit = { actorType: 'player', coefficient: 1, skillName: 'Test strike' };
  resolveNatureSiphon(context, { ...hit, at: 1 });
  // Rejected packets must not trigger siphons even after the initial proc's cooldown.
  resolveNatureSiphon(context, { ...emitted[0], at: 2 });
  resolveNatureSiphon(context, { ...hit, at: 2, cancelled: true });
  resolveNatureSiphon(context, { ...hit, at: 2, coefficient: 0 });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].flatStrikeBase, 53);
  assert.equal(emitted[0].flatStrikePowerCoeff, 0.0666);
  core.activeUpkeeps = [];
  resolveNatureSiphon(context, { ...hit, at: 3 });
  assert.equal(emitted.length, 1);
  state.lingeringFacets[SKILL.FACET_OF_NATURE] = { startsAt: 3, expiresAt: 9, legendId: LEGEND.ASSASSIN };
  resolveNatureSiphon(context, { ...hit, at: 4 });
  resolveNatureSiphon(context, { ...hit, at: 9 });
  assert.equal(emitted.length, 2);
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
    const stats = modifyHeraldPassiveAttributes(context, attributes);
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
  assert.equal(gw2BoonDurationMultiplier('might', modifyHeraldPassiveAttributes(context, attributes)), 2);
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
      (event) => event.type === 'damage' && event.lifeSiphon && event.skillId === SKILL.FACET_OF_NATURE
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
