import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/policy.js';
import { planningState } from '#gw2/platform/results/end-state.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  completeRevenantWeaponCast,
  expireImperialGuard
} from '#gw2/professions/revenant/core/mechanics/weapon-state.js';
import { revenantProfession, revenantCatalog } from '#gw2/professions/revenant/profession.js';
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
import { observeRevenantEvent } from '#gw2/professions/revenant/core/mechanics/scheduler-hooks.js';
import {
  observeRenegadeTraits,
  razorclawReaction
} from '#gw2/professions/revenant/specializations/renegade/traits/index.js';
import { activateEnchantedDaggers } from '#gw2/professions/revenant/core/mechanics/enchanted-daggers.js';
import { completeBandTogether } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  revenantEnduranceRegenerationRate,
  advanceRevenantEnergy
} from '#gw2/professions/revenant/core/mechanics/energy.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import {
  applyDanceOfDeath,
  applyBattleScarred,
  applyThrillOfCombat,
  consumeBattleScar
} from '#gw2/professions/revenant/core/traits/devastation.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import { professionEnduranceReadyAt } from '#gw2/platform/combat/resources/endurance-policy.js';

const baseConfig = {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  selectedTraitIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
};
const simulate = createProfessionSimulator(revenantProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });

// Legend inputs and palette tiles must follow the same recharge after Alacrity arrives mid-cooldown and expires.
test('legend swap and its palette use shared recharge after temporary Alacrity', () => {
  const scheduler = createScheduler({
    profession: revenantProfession,
    config: baseConfig,
    schedulerPolicy: createGw2SchedulerPolicy(baseConfig)
  });
  const scheduled = scheduler.run(['__combat_start', 'Swap Legends']);
  scheduler.advanceTo(2);
  scheduler.context.emit({
    type: 'buff',
    kind: 'alacrity',
    at: 2,
    duration: 4,
    stacks: 1,
    source: 'fixture',
    sourceId: 'fixture',
    actorType: 'player'
  });
  scheduler.advanceTo(8.5);
  const projected = planningState(scheduled.context.profession, scheduled);
  const swap = revenantCatalog.skillsById.get(SKILL.SWAP_LEGENDS);
  assert.equal(projected.cooldowns[swap.name].readyAt, 9000);
  assert.deepEqual(
    revenantProfession.ui.paletteSkillAvailability(
      {
        time: projected.atSeconds,
        professionState: projected.profession,
        cooldowns: projected.cooldowns
      },
      swap
    ),
    {
      available: false,
      message: 'Legend swap is recharging',
      retryAt: 9
    }
  );
  assert.equal(scheduler.cast({ type: 'cast', skillId: swap.id }), true);
  assert.equal(scheduler.events.findLast((event) => event.type === 'action').at, 9);
  assert.deepEqual(scheduler.warnings, []);
});

// A child consumed during the channel must not make the parent's later expiry claim another activation.
test('Imperial Guard expiry retains its cast identity after early consumption', () => {
  const core = createRevenantCoreState();
  const scheduled = [];
  const events = [];
  const context = {
    state: { time: 1, profession: { core, specialization: { kind: 'Core', state: {} } } },
    catalog: revenantCatalog,
    reservationId: 'old-guard',
    effectiveEnd: 1,
    events,
    emit: (event) => events.push(event),
    tasks: { cancelOwner() {}, schedule: (task) => scheduled.push(task) }
  };
  completeRevenantWeaponCast(context, revenantCatalog.skillsById.get(SKILL.IMPERIAL_GUARD));
  const window = armSkillFlip(core.availableFlips, SKILL.TRUE_STRIKE, 2, 5, 2, 'new-guard');
  expireImperialGuard(context, scheduled[0]);
  assert.equal(core.availableFlips[SKILL.TRUE_STRIKE], window);
});

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
    const state = result.planningState.profession;
    assert.equal(state.enchantedDaggers.charges, 0);
    assert.equal(state.razorclawsRage.charges, 0);
    assert.equal(state.bandTogetherReady, false);
    assert.equal(state.beguilingHazeCharges, 0);
    assert.equal(state.crushingAbyss.length, 0);
    assert.equal(state.activeUpkeeps.length, 0);
    if (name === 'Ancient Echo') assert.equal(state.energy.value, 50 + result.rotationEndTime * 5);
    if (name === 'Twin Moon Sweep') assert.equal(state.affinity, 0);
    if (name === 'Dodge Jump') assert.equal(state.endurance, 50 + result.rotationEndTime * 5);
  });
}

// Small owner contexts expose lifecycle cleanup and recipient exclusions that rotation inputs cannot express.
function contextFor(specialization = 'Renegade', selectedTraitIds = []) {
  const config = { ...baseConfig, specialization, selectedTraitIds };
  const events = [];
  return {
    config,
    catalog: revenantCatalog,
    profession: revenantProfession.resolveRuntime(config),
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

// Exercise charge ownership through real observers; Razorclaw must spend only when its impact task runs.
for (const [name, skillId, cooldown] of [
  ['Enchanted Daggers', SKILL.ENCHANTED_DAGGERS, 0.52],
  ['Razorclaw without ICD', SKILL.RAZORCLAWS_RAGE, 0],
  ['Razorclaw with patched ICD', SKILL.RAZORCLAWS_RAGE, 0.5]
]) {
  test(`${name} preserves replacement grants, eligibility, strict expiry, and cooldown boundaries`, () => {
    const context = contextFor();
    const daggers = skillId === SKILL.ENCHANTED_DAGGERS;
    const owner = daggers ? context.state.profession.core : context.state.profession.specialization.state;
    const key = daggers ? 'enchantedDaggers' : 'razorclawsRage';
    const skill = revenantCatalog.skillsById.get(skillId);
    const buff = skill.effects.find((effect) => effect.type === 'buff');
    const proc = revenantCatalog.skillsById.get(RENEGADE_PROFILE_IDS.razorclawsRageProc);
    context.catalog = { ...revenantCatalog, skillsById: new Map(revenantCatalog.skillsById) };
    context.catalog.skillsById.set(proc.id, { ...proc, cooldown });
    context.config.allies = { count: 2, strikesPerSecond: 2 };
    context.action = { cancelled: false };
    const activate = (at) => {
      context.start = at;
      context.effectiveEnd = at;
      if (daggers) activateEnchantedDaggers(context, skill);
      else completeBandTogether(context, skill, { enhanced: true, profileSkillId: skillId });
    };

    const observe = daggers ? observeRevenantEvent : observeRenegadeTraits;
    const strike = {
      type: 'damage',
      actorType: 'player',
      coefficient: 1,
      skillId: SKILL.PHASE_TRAVERSAL,
      eventOrder: 7
    };
    const hit = (at, fields = {}) => {
      const event = { ...strike, at, ...fields };
      const tasks = [];
      context.tasks.schedule = (task) => tasks.push(task);
      const charges = owner[key].charges;
      observe(context, event);
      if (!daggers) {
        assert.equal(owner[key].charges, charges, 'emitting a future hit must not spend charges');
        context.eventByOrder = () => event;
        for (const task of tasks) razorclawReaction.taskHandlers['revenant.razorclaw-proc'](context, task);
      }
    };

    activate(1);
    assert.deepEqual(owner[key], { charges: buff.stacks, expiresAt: 1 + buff.duration, readyAt: 1 });
    if (!daggers) assert.ok(context.events.some((event) => event.metadata?.triggeredByAlly));
    for (const fields of [{ actorType: 'effect' }, { coefficient: 0 }, { skillId }]) hit(1.1, fields);
    hit(0.9);
    hit(1);
    assert.equal(owner[key].charges, buff.stacks, 'ineligible hits and activation boundary cannot consume');
    hit(1.1);
    assert.equal(owner[key].charges, buff.stacks - 1);
    assert.equal(owner[key].readyAt, 1.1 + cooldown);
    if (daggers) {
      const siphon = context.events.find((event) => event.type === 'damage' && event.skillId === skillId);
      assert.equal(siphon.at, 1.1 + cooldown);
      assert.equal(siphon.hitIndex, 1);
      assert.equal(siphon.parentEventOrder, strike.eventOrder);
    }

    hit(1.1 + cooldown);
    assert.equal(owner[key].charges, buff.stacks - 1, 'exact cooldown boundary remains blocked');
    hit(1.101 + cooldown);
    assert.equal(owner[key].charges, buff.stacks - 2);
    activate(3);
    assert.deepEqual(owner[key], { charges: buff.stacks, expiresAt: 3 + buff.duration, readyAt: 3 });
    hit(owner[key].expiresAt);
    assert.equal(owner[key].charges, buff.stacks, 'exact expiry cannot consume');
    owner[key].charges = 1;
    owner[key].expiresAt = 100;
    hit(50);
    hit(60);
    assert.equal(owner[key].charges, 0, 'exhausted grants cannot underflow');
  });
}

test('Razorclaw rejects a missing proc and keeps charges when its bleed is removed', () => {
  // A missing declaration is invalid content, while an explicit removal leaves the charge for no packet to spend.
  const context = contextFor();
  const grant = { charges: 2, expiresAt: 10, readyAt: 0 };
  context.state.profession.specialization.state.razorclawsRage = grant;
  context.eventByOrder = () => ({ at: 1, eventOrder: 7 });
  const run = () => razorclawReaction.taskHandlers['revenant.razorclaw-proc'](context, { payload: { eventOrder: 7 } });
  context.catalog = { ...revenantCatalog, skillsById: new Map(revenantCatalog.skillsById) };
  context.catalog.skillsById.delete(RENEGADE_PROFILE_IDS.razorclawsRageProc);
  assert.throws(run, /Missing Razorclaw's Rage proc declaration/);

  context.catalog = applySkillPatch(revenantCatalog, {
    skills: { [RENEGADE_PROFILE_IDS.razorclawsRageProc]: { removeEffects: [{ type: 'condition', name: 'Bleeding' }] } }
  });
  run();
  assert.deepEqual(grant, { charges: 2, expiresAt: 10, readyAt: 0 });
  assert.deepEqual(context.events, []);
});

test('Battle Scars rejects overflow and consumes newest before longest-lived', () => {
  const context = contextFor('Renegade', [TRAIT.BATTLE_SCARRED, TRAIT.DANCE_OF_DEATH]);
  const core = context.state.profession.core;
  const oldest = 30;
  core.battleScars = [oldest, 10];
  consumeBattleScar(context, { at: 2 });
  assert.deepEqual(core.battleScars, [oldest]);
  context.effectiveEnd = 3;
  applyBattleScarred(context, { slot: 'Heal' });
  assert.ok(core.battleScars.length > 1);
  assert.ok(core.battleScars.slice(1).every((expiresAt) => expiresAt === 13));
  applyDanceOfDeath(context, { at: 4, condition: 'Vulnerability', stacks: 100 });
  const cap = context.catalog.balanceProfilesById.get(REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars).maximumStacks;
  assert.equal(core.battleScars.length, cap);
  const full = structuredClone(core.battleScars);
  applyDanceOfDeath(context, { at: 5, condition: 'Vulnerability', stacks: 1 });
  assert.deepEqual(core.battleScars, full, 'overflow cannot replace or refresh retained scars');
  consumeBattleScar(context, { at: 14 });
  assert.deepEqual(core.battleScars, [], 'exact expiry removes newer grants before consuming the oldest survivor');
});

test('Thrill of Combat catches up on its original cadence while capped grants remain rejected', () => {
  const context = contextFor('Renegade', [TRAIT.THRILL_OF_COMBAT]);
  const core = context.state.profession.core;
  core.combatBeganAt = 0;
  const profile = context.catalog.balanceProfilesById.get(REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);
  context.catalog = { ...context.catalog, balanceProfilesById: new Map(context.catalog.balanceProfilesById) };
  context.catalog.balanceProfilesById.set(profile.id, { ...profile, maximumStacks: 2 });
  applyThrillOfCombat(context, { at: 3 });
  assert.deepEqual(core.battleScars, [11, 12]);
  assert.equal(core.nextThrillOfCombatAt, 4);
  applyThrillOfCombat(context, { at: 12 });
  assert.deepEqual(core.battleScars, [21, 22]);
  assert.equal(core.nextThrillOfCombatAt, 13);
});

test('Core strike dispatch preserves upkeep, trait, and dagger order with the original cause', () => {
  // One strike exercises the mixed dispatcher while queued upkeep remains separate from immediate reactions.
  const context = contextFor('Renegade', [TRAIT.VICIOUS_REPRISAL, TRAIT.EXPOSE_DEFENSES]);
  context.hasBuff = (kind) => kind === 'resolution';
  const core = context.state.profession.core;
  core.battleScars = [10];
  core.enchantedDaggers = { charges: 2, expiresAt: 10, readyAt: 0 };
  const order = [];
  const tasks = [];
  context.tasks.schedule = (task) => {
    tasks.push(task);
    order.push(task.type);
  };

  context.emit = (event) => {
    order.push(event.sourceId);
    context.events.push(event);
    return event;
  };

  const strike = {
    type: 'damage',
    at: 1,
    eventOrder: 7,
    actorType: 'player',
    source: 'revenant',
    sourceId: SKILL.PHASE_SMASH,
    skillId: SKILL.PHASE_SMASH,
    skillName: 'Phase Smash',
    coefficient: 1
  };

  observeRevenantEvent(context, strike);

  assert.deepEqual(order, [
    'revenant.impossible-odds-strike',
    'revenant.battle-scars',
    TRAIT.VICIOUS_REPRISAL,
    TRAIT.EXPOSE_DEFENSES,
    SKILL.ENCHANTED_DAGGERS
  ]);
  assert.equal(tasks[0].at, strike.at);
  assert.equal(tasks[0].payload.event, strike);
  assert.ok(context.events.every((event) => event.parentEventOrder === strike.eventOrder));
  assert.equal(core.battleScars.length, 0);
  assert.equal(core.enchantedDaggers.charges, 1);
});

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

// Release cooldowns belong to the upkeep parent and use its release-specific duration with recharge modifiers.
test('upkeep manual release cooldowns scale with Alacrity', () => {
  for (const [specialization, legend, parentName, releaseName, cooldown] of [
    ['Core', LEGEND.ASSASSIN, 'Impossible Odds', 'Relinquish Power', 1],
    ['Core', LEGEND.CENTAUR, 'Protective Solace', 'Diminish Solace', 5],
    ['Renegade', LEGEND.RENEGADE, "Soulcleave's Summit", 'Dismiss Lieutenant Soulcleave', 3]
  ]) {
    for (const alacrity of [false, true]) {
      const result = simulate(specialization, [parentName, wait(1000), releaseName, parentName], {
        selectedLegends: [legend, LEGEND.DEMON],
        startingLegend: legend,
        initialEnergy: 100,
        boons: { alacrity }
      });
      const release = result.steps.find((step) => step.skill === releaseName);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.steps.at(-1).start, release.end + (cooldown / (alacrity ? 1.25 : 1)) * 1000);
    }
  }
});

// Exhaustion starts a distinct parent cooldown at starvation, independent of the later observation endpoint.
test('upkeep starvation cooldowns scale with Alacrity', () => {
  for (const alacrity of [false, true]) {
    const result = simulate('Core', ['Impossible Odds', wait(2000)], {
      initialEnergy: 6,
      boons: { alacrity }
    });
    const starvation = result.events.find((event) => event.reason === 'upkeep-starved');
    assert.deepEqual(result.warnings, []);
    assert.equal(starvation.at, 1);
    assert.equal(result.schedulerState.cooldowns.get(SKILL.IMPOSSIBLE_ODDS), starvation.at + 4 / (alacrity ? 1.25 : 1));
    assert.deepEqual(result.planningState.profession.activeUpkeeps, []);
  }
});

test('Diminish Solace stops upkeep drain, retires owned tasks, and starts the parent cooldown', () => {
  const config = { selectedLegends: [LEGEND.CENTAUR, LEGEND.ASSASSIN], startingLegend: LEGEND.CENTAUR };
  const rotation = ['__combat_start', 'Protective Solace', wait(1000), 'Diminish Solace'];
  const released = simulate('Core', rotation, config);
  const recovered = simulate('Core', [...rotation, wait(2000)], config);
  assert.deepEqual(recovered.warnings, []);
  assert.deepEqual(recovered.planningState.profession.activeUpkeeps, []);
  assert.equal(recovered.planningState.profession.availableFlips[SKILL.DIMINISH_SOLACE], undefined);
  assert.equal(recovered.planningState.profession.energy.value - released.planningState.profession.energy.value, 10);
  const unavailable = simulate('Core', ['Diminish Solace'], config);
  assert.match(unavailable.warnings.join('\n'), /activate the matching upkeep/);
  const context = contextFor();
  const owners = [];
  context.tasks.cancelOwner = (id) => owners.push(id);
  context.rechargeDurationFor = (skill) => skill.cooldown;
  context.state.rechargeProgress = new Map();
  context.state.ammo = new Map();
  context.cooldownController = createCooldownController({
    state: context.state,
    rechargeDuration: context.rechargeDurationFor
  });
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
    for (const [traits, vigor, rate, readyAt] of [
      [[], false, 5, 10],
      [[TRAIT.ENDURING_RECOVERY], false, 6.25, 8],
      [[TRAIT.ENDURING_RECOVERY], true, 8.75, 5.72]
    ]) {
      const context = contextFor(specialization, traits);
      context.config.boons = { vigor };
      context.state.profession.core.endurance = 0;
      assert.equal(revenantEnduranceRegenerationRate(context), rate);
      assert.equal(professionEnduranceReadyAt(context, 50), readyAt);
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
