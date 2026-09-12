import assert from 'node:assert/strict';
import test from 'node:test';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { createRenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { createConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { completeBeguilingHaze } from '#gw2/professions/revenant/specializations/conduit/mechanics/beguiling-haze.js';
import { releaseRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { observeRevenantEvent } from '#gw2/professions/revenant/core/traits/index.js';
import { observeRenegadeTraits } from '#gw2/professions/revenant/specializations/renegade/traits/index.js';
import {
  revenantEnduranceRegenerationRate,
  revenantEnduranceReadyAt,
  advanceRevenantEnergy
} from '#gw2/professions/revenant/core/mechanics/energy.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const baseConfig = {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  selectedTraitIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
};
const simulate = createProfessionSimulator(revenantProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });

// These minimal casts exercise commit ownership without pinning animation thresholds or saved rotations.
for (const [specialization, name, legend, config = {}] of [
  ['Core', 'Enchanted Daggers', LEGEND.ASSASSIN],
  ['Core', 'Ancient Echo', LEGEND.ASSASSIN],
  ['Core', 'Embrace the Darkness', LEGEND.DEMON],
  ['Core', 'Abyssal Raze', LEGEND.ASSASSIN, { weaponSet1Primary: 'Spear' }],
  ['Renegade', "Razorclaw's Rage", LEGEND.RENEGADE],
  ['Conduit', 'Beguiling Haze', LEGEND.ENTITY],
  ['Conduit', 'Twin Moon Sweep', LEGEND.ENTITY],
  ['Vindicator', 'Dodge Jump', LEGEND.ASSASSIN]
]) {
  test(`Canceled ${name} does not commit its effect package`, () => {
    const result = simulate(specialization, ['__combat_start', { name, interruptAfterMs: 100 }, wait(2000)], {
      ...config,
      selectedLegends: [legend, legend === LEGEND.ASSASSIN ? LEGEND.DEMON : LEGEND.ASSASSIN],
      startingLegend: legend
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps.find((step) => step.skill === name).cancelledBeforeCommit, true);
    assert.equal(
      result.events.some((event) => ['damage', 'condition', 'buff'].includes(event.type)),
      false
    );
    const state = result.endState.profession;
    assert.equal(state.enchantedDaggers.charges, 0);
    assert.equal(state.razorclawsRage.charges, 0);
    assert.equal(state.bandTogetherReady, false);
    assert.equal(state.beguilingHazeCharges, 0);
    assert.equal(state.crushingAbyss.length, 0);
    assert.equal(state.activeUpkeeps.length, 0);
    if (name === 'Ancient Echo') assert.equal(state.energy, 50 + result.duration * 5);
    if (name === 'Twin Moon Sweep') assert.equal(state.affinity, 0);
    if (name === 'Dodge Jump') assert.equal(state.endurance, 50 + result.duration * 5);
  });
}

// Small owner contexts expose lifecycle cleanup and recipient exclusions that rotation inputs cannot express.
function contextFor(specialization = 'Renegade', selectedTraitIds = []) {
  const config = { ...baseConfig, specialization, selectedTraitIds };
  const events = [];
  return {
    config,
    catalog: revenantCatalog,
    profession: revenantProfession,
    epsilon: 1e-9,
    start: 0,
    effectiveEnd: 0,
    hasExplicitCombatStart: true,
    combatStartTime: 0,
    state: {
      time: 0,
      cooldowns: new Map(),
      ammo: new Map(),
      profession: {
        core: createRevenantCoreState(config),
        specialization: {
          kind: specialization,
          state: specialization === 'Conduit' ? createConduitState(config) : createRenegadeState()
        }
      }
    },
    events,
    tasks: { schedule() {}, cancelOwner() {} },
    schedulerPolicy: { combatBeganAt: () => 0 },
    emit(event) {
      events.push(event);
      return event;
    },
    emitDerived(cause, event) {
      return this.emit({ ...event, parentEventOrder: cause.eventOrder });
    }
  };
}

test('Canceled Beguiling Haze retires its reservation without granting charges or rewriting recharge', () => {
  const context = contextFor('Conduit');
  const state = context.state.profession.specialization.state;
  state.beguilingHazeMainReservations.push('canceled', 'other');
  context.reservationId = 'canceled';
  context.action = { cancelled: true };
  context.state.cooldowns.set(SKILL.BEGUILING_HAZE, 12);
  const ammo = { maximum: 1, charges: 0, nextRechargeAt: 12 };
  context.state.ammo.set(SKILL.BEGUILING_HAZE, ammo);
  completeBeguilingHaze(context, revenantCatalog.skillsById.get(SKILL.BEGUILING_HAZE));
  assert.deepEqual(state.beguilingHazeMainReservations, ['other']);
  assert.equal(state.beguilingHazeCharges, 0);
  assert.equal(context.state.cooldowns.get(SKILL.BEGUILING_HAZE), 12);
  assert.deepEqual(ammo, { maximum: 1, charges: 0, nextRechargeAt: 12 });
});

test('Diminish Solace stops upkeep drain, retires owned tasks, and starts the parent cooldown', () => {
  const config = { selectedLegends: [LEGEND.CENTAUR, LEGEND.ASSASSIN], startingLegend: LEGEND.CENTAUR };
  const rotation = ['__combat_start', 'Protective Solace', wait(1000), 'Diminish Solace'];
  const released = simulate('Core', rotation, config);
  const recovered = simulate('Core', [...rotation, wait(2000)], config);
  assert.deepEqual(recovered.warnings, []);
  assert.deepEqual(recovered.endState.profession.activeUpkeeps, []);
  assert.equal(recovered.endState.profession.availableFlips[SKILL.DIMINISH_SOLACE], undefined);
  assert.equal(recovered.endState.profession.energy - released.endState.profession.energy, 10);
  const unavailable = simulate('Core', ['Diminish Solace'], config);
  assert.match(unavailable.warnings.join('\n'), /activate the matching upkeep/);
  const context = contextFor();
  const owners = [];
  context.tasks.cancelOwner = (id) => owners.push(id);
  context.effectiveEnd = 1;
  context.state.profession.core.activeUpkeeps.push({ skillId: SKILL.PROTECTIVE_SOLACE, upkeepCost: 8 });
  releaseRevenantUpkeep(context, revenantCatalog.skillsById.get(SKILL.DIMINISH_SOLACE));
  assert.deepEqual(owners, [`revenant.upkeep:${SKILL.PROTECTIVE_SOLACE}`]);
  assert.equal(context.state.cooldowns.get(SKILL.PROTECTIVE_SOLACE), 6);
});

test('Both Vindicator dodge inputs apply the selected landing conditions and boons once', () => {
  for (const name of ['Dodge', 'Dodge Jump']) {
    for (const [trait, expected] of [
      [TRAIT.FORERUNNER_OF_DEATH, [['Vulnerability', 5, 10]]],
      [
        TRAIT.VASSALS_OF_THE_EMPIRE,
        [
          ['might', 5, 15],
          ['protection', 1, 7.5]
        ]
      ],
      [TRAIT.SAINT_OF_ZU_HELTZER, [['alacrity', 1, 6]]]
    ]) {
      const result = simulate('Vindicator', [name], {
        selectedTraitIds: [trait],
        stats: { concentration: 750 },
        allies: { count: 4 }
      });
      assert.deepEqual(result.warnings, []);
      for (const [kind, stacks, duration] of expected) {
        const applications = result.events.filter((event) => event.kind === kind || event.condition === kind);
        assert.equal(applications.length, 1, `${name}: ${kind}`);
        assert.equal(applications[0].stacks, stacks);
        assert.equal(applications[0].duration, duration);
        if (kind === 'alacrity') assert.equal(applications[0].resolvedAudience.alliedPlayerCount, 4);
      }

      if (trait === TRAIT.FORERUNNER_OF_DEATH) {
        const strike = result.events.find((event) => event.type === 'damage');
        const buff = result.events.find((event) => event.kind === 'forerunner-of-death');
        assert.equal(strike.forerunnerOfDeathActive, false);
        assert.ok(strike.eventOrder < buff.eventOrder);
      }
    }
  }
});

test('In-combat invocations grant Fury and trigger Incensed Response without an internal cooldown', () => {
  const config = { selectedTraitIds: [TRAIT.INVOKERS_RAGE, TRAIT.INCENSED_RESPONSE] };
  const result = simulate(
    'Core',
    ['__combat_start', 'Swap Legends', { type: 'cooldown-reset' }, 'Swap Legends'],
    config
  );
  assert.deepEqual(result.warnings, []);
  const fury = result.events.filter((event) => event.kind === 'fury');
  const might = result.events.filter((event) => event.sourceId === TRAIT.INCENSED_RESPONSE);
  assert.equal(fury.length, 2);
  assert.equal(might.length, 2);
  assert.equal(fury[0].duration, 5);
  assert.equal(might[0].stacks, 5);
  assert.equal(might[0].duration, 8);
  const precast = simulate('Core', ['Swap Legends', '__combat_start'], config);
  assert.equal(
    precast.events.some((event) => event.type === 'buff'),
    false
  );
});

test('Fury reactions respect recipients, source ownership, combat gating, and boon duration', () => {
  const fury = { type: 'buff', kind: 'fury', at: 1, actorType: 'player', eventOrder: 10 };
  for (const [event, combatStartTime, might, vigor] of [
    [fury, 0, 1, 1],
    [fury, 2, 0, 1],
    [{ ...fury, actorType: 'environment' }, 0, 0, 1],
    [{ ...fury, audience: { recipients: 'party', affectsSelf: false } }, 0, 0, 0],
    [{ ...fury, audience: { recipients: 'summons', affectsSelf: false } }, 0, 0, 0]
  ]) {
    const context = contextFor('Renegade', [TRAIT.INCENSED_RESPONSE, TRAIT.BRUTAL_MOMENTUM]);
    context.combatStartTime = combatStartTime;
    observeRevenantEvent(context, event);
    observeRenegadeTraits(context, event);
    assert.equal(context.events.filter((emitted) => emitted.kind === 'might').length, might);
    assert.equal(context.events.filter((emitted) => emitted.kind === 'vigor').length, vigor);
    assert.ok(context.events.every((emitted) => emitted.parentEventOrder === fury.eventOrder));
  }

  const result = simulate('Renegade', ['__combat_start', 'Riposting Shadows'], {
    selectedTraitIds: [TRAIT.INCENSED_RESPONSE, TRAIT.BRUTAL_MOMENTUM],
    stats: { concentration: 750 }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.find((event) => event.sourceId === TRAIT.INCENSED_RESPONSE).duration, 12);
  assert.equal(result.events.find((event) => event.sourceId === TRAIT.BRUTAL_MOMENTUM).duration, 9);
});

test('Enduring Recovery adds to Vigor and funds the next dodge in Core and Vindicator', () => {
  for (const specialization of ['Core', 'Vindicator']) {
    for (const [traits, vigor, rate] of [
      [[], false, 5],
      [[TRAIT.ENDURING_RECOVERY], false, 6.25],
      [[TRAIT.ENDURING_RECOVERY], true, 8.75]
    ]) {
      const context = contextFor(specialization, traits);
      context.config.boons = { vigor };
      context.state.profession.core.endurance = 0;
      assert.equal(revenantEnduranceRegenerationRate(context), rate);
      assert.equal(revenantEnduranceReadyAt(context, 50), 50 / rate);
      advanceRevenantEnergy(context, 4);
      assert.equal(context.state.profession.core.endurance, rate * 4);
    }

    const result = simulate(specialization, ['Dodge', 'Dodge', 'Dodge'], {
      selectedTraitIds: [TRAIT.ENDURING_RECOVERY]
    });
    assert.deepEqual(result.warnings, []);
    const dodges = result.steps.filter((step) => step.skillId === SKILL.DODGE);
    assert.equal(dodges.length, 3);
    assert.equal(dodges[2].start, 8000);
  }
});

test('Brutal Momentum Vigor stops increasing recovery when its self boon expires', () => {
  const context = contextFor('Renegade', [TRAIT.BRUTAL_MOMENTUM]);
  observeRenegadeTraits(context, { type: 'buff', kind: 'fury', at: 0, actorType: 'player', eventOrder: 1 });
  const vigor = context.events.find((event) => event.kind === 'vigor');
  vigor.resolvedAudience = { includesSelf: true, alliedPlayerCount: 0, companionIds: [], recipientCount: 1 };
  context.hasBuff = (kind, at) => kind === 'vigor' && at >= vigor.at && at < vigor.at + vigor.duration;
  context.state.profession.core.endurance = 0;
  advanceRevenantEnergy(context, vigor.duration);
  assert.equal(context.state.profession.core.endurance, vigor.duration * 7.5);
  assert.equal(revenantEnduranceRegenerationRate(context, vigor.duration), 5);
  advanceRevenantEnergy(context, vigor.duration + 2);
  assert.equal(context.state.profession.core.endurance, vigor.duration * 7.5 + 10);
});

test('Brutal Momentum only rearms after its Vigor internal cooldown expires', () => {
  const context = contextFor('Renegade', [TRAIT.BRUTAL_MOMENTUM]);
  // Repeated Fury, including the exact blocked deadline, must not extend Vigor.
  for (const at of [0, 1, 8, 8.01]) {
    observeRenegadeTraits(context, { type: 'buff', kind: 'fury', at, actorType: 'player', eventOrder: at });
  }

  assert.deepEqual(
    context.events.map((event) => event.at),
    [0, 8.01]
  );
});
