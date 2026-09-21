import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { ELEMENTALIST_SKILL_IDS as E, ELEMENTALIST_TRAIT_IDS as ET } from '#gw2/professions/elementalist/data/ids.js';
import { ENGINEER_TRAIT_IDS as HT } from '#gw2/professions/engineer/data/ids.js';
import { GUARDIAN_TRAIT_IDS as GT } from '#gw2/professions/guardian/data/ids.js';
import { MESMER_SKILL_IDS as M, MESMER_TRAIT_IDS as MT } from '#gw2/professions/mesmer/data/ids.js';
import { NECROMANCER_SKILL_IDS as N } from '#gw2/professions/necromancer/data/ids.js';
import { REVENANT_SKILL_IDS as R, REVENANT_TRAIT_IDS as RT } from '#gw2/professions/revenant/data/ids.js';
import { grantCatalystElementalEmpowerment } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import {
  applyCatalystEmpowerment,
  applyCatalystResolvedDamage
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { applyWeaveSelfAttunement } from '#gw2/professions/elementalist/specializations/weaver/mechanics/weave-self.js';
import { weaverCastRules } from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-attunements.js';
import { onEventScheduled } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { commitRechargeDuration } from '#gw2/professions/elementalist/specializations/evoker/mechanics/recharge.js';
import { grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { consumeElectricEnchantment } from '#gw2/professions/elementalist/specializations/evoker/mechanics/enchantments.js';
import {
  holosmithResolverEventHandlers,
  consumeSolarFocusingLens
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-effects.js';
import {
  performEnergyMeld,
  completeVindicatorDodge
} from '#gw2/professions/revenant/specializations/vindicator/mechanics/dodge.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { galeshotMissileReaction } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { galeshotUi } from '#gw2/professions/ranger/specializations/galeshot/presentation.js';
import { handleNecromancerPainfulBond } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/event-handlers.js';
import { minionActions } from '#gw2/professions/necromancer/core/mechanics/minions.js';
import { createTaskQueue } from '#gw2/platform/execution/tasks.js';
import {
  reactToRighteousInstincts,
  handleRighteousInstinctsTick
} from '#gw2/professions/guardian/core/traits/radiance.js';
import { handleSymbolOfIgnitionField, reactToSymbolOfIgnition } from '#gw2/professions/guardian/core/traits/index.js';
import { dragonhunterEventHandlers } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtue-effects.js';
import { scheduleMesmerTrackedHits } from '#gw2/professions/mesmer/core/mechanics/tracked-hits.js';
import { completeChronomancerTimeBomb } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/time-bomb.js';
import { projectDragonCharges } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { handleSkrittScuffle } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { nourys } from '#gw2/platform/equipment/relics/rules/nourys.js';
import { aristocracy } from '#gw2/platform/equipment/relics/rules/aristocracy.js';

// Real catalogs and state owners; buffer emitted work to isolate the boundary contract of each handler.
function contextFor(profession, specialization, selectedTraitIds = []) {
  const config = { specialization, selectedTraitIds };
  const runtime = profession.resolveRuntime(config);
  const events = [];
  const emit = (event) => {
    events.push(event);
    return event;
  };

  return {
    config,
    profession: runtime,
    catalog: runtime.catalog,
    state: { time: 0, activeWeaponSet: 1, profession: runtime.createProfessionState(config), cooldowns: new Map() },
    events,
    emit,
    emitDerived: (_cause, event) => emit(event),
    eventByOrder: () => undefined,
    replaceEvent: (event, update) => Object.assign(event, update),
    queue: { enqueue: emit },
    tasks: { schedule: emit },
    query: { statsAt: () => ({}) },
    recordProc: () => {},
    createActivationId: () => `test-${events.length}`,
    start: 0,
    fullEnd: 0,
    effectiveEnd: 0,
    horizon: 0,
    observationEndTime: 0
  };
}

const specialization = (context) => context.state.profession.specialization.state;

test('temporary Elemental Empowerment stacks survive the final microsecond and expire on their buff tick', () => {
  const context = contextFor(elementalistProfession, 'Catalyst');
  const state = specialization(context);
  grantCatalystElementalEmpowerment(state, 0.001, 1, 1);
  assert.deepEqual(state.elementalEmpowermentExpiries, [1.04]);
  grantCatalystElementalEmpowerment(state, 1.039999, 1, 1);
  assert.deepEqual(state.elementalEmpowermentExpiries, [1.04, 2.04]);
  grantCatalystElementalEmpowerment(state, 1.04, 1, 1);
  assert.deepEqual(state.elementalEmpowermentExpiries, [2.04, 2.04]);
});

test('Shattering Ice uses the same exclusive tick deadline for grants and hits', () => {
  for (const at of [1.039999, 1.04, 1.040001]) {
    const context = contextFor(elementalistProfession, 'Catalyst');
    applyCatalystEmpowerment(context, {
      kind: 'shattering ice',
      at: 0.001,
      duration: 1,
      resolvedAudience: { includesSelf: true }
    });
    assert.equal(specialization(context).shatteringIceUntil, 1.04);
    applyCatalystResolvedDamage(context, { type: 'damage', at, actorType: 'player', coefficient: 1 });
    assert.equal(
      context.events.some((event) => event.type === 'damage'),
      at < 1.04
    );
  }
});

test('Perfect Weave grant and Tailored Victory gate share the emitted buff expiry', () => {
  const context = contextFor(elementalistProfession, 'Weaver');
  const state = specialization(context);
  state.weaveSelfUntil = 10;
  state.weaveSelfVisited = ['Fire', 'Air', 'Water'];
  applyWeaveSelfAttunement(context, 0.001, 'Earth', 'Earth Attunement', E.EARTH_ATTUNEMENT);
  assert.equal(state.perfectWeaveUntil, 10.04);
  for (const at of [10.039999, 10.04, 10.040001]) {
    context.start = at;
    assert.equal(
      weaverCastRules.availability.handler(context, context.catalog.skillsById.get(E.TAILORED_VICTORY)).ready,
      at < 10.04
    );
  }
});

test('Elemental Balance is consumable through its final microsecond and only once', () => {
  for (const at of [5.039999, 5.04, 5.040001]) {
    const context = contextFor(elementalistProfession, 'Evoker', [ET.ELEMENTAL_BALANCE]);
    const state = specialization(context);
    state.elementalBalanceProgress = 1;
    onEventScheduled(context, { type: 'elementalist.attunement-enter', to: state.element, at: 0.001 });
    assert.equal(state.elementalBalanceUntil, 5.04);
    context.state.time = at;
    context.skill = { type: 'Weapon', slot: 'Weapon_2' };
    assert.equal(commitRechargeDuration(context, 10), at < 5.04 ? 10 * 0.34 : 10);
    assert.equal(commitRechargeDuration(context, 10), 10);
  }
});

test('Electric Enchantment cannot consume hits before its grant, including retrospective scheduling', () => {
  for (const at of [0.300999, 0.301, 1.319999, 1.32]) {
    const context = contextFor(elementalistProfession, 'Evoker');
    const state = specialization(context);
    grantElectricEnchantments(state, 0.1 + 0.201, 1, 1);
    assert.equal(state.electricEnchantmentGrants[0].at, 0.301);
    assert.equal(state.electricEnchantmentGrants[0].expiresAt, 1.32);
    const event = { type: 'damage', at, actorType: 'player', coefficient: 1 };
    consumeElectricEnchantment(context, state, event);
    assert.equal(event.electricEnchantmentConsumed === true, at >= 0.301 && at < 1.32);
  }
});

test('Solar Focusing Lens preserves inclusive expiry without early activation or a grace period', () => {
  for (const at of [0.000999, 0.001, 1.039999, 1.04, 1.040001]) {
    const context = contextFor(engineerProfession, 'Holosmith', [HT.SOLAR_FOCUSING_LENS]);
    holosmithResolverEventHandlers['engineer.solar-focusing-lens'](context, { at: 0.001, duration: 1, stacks: 1 });
    assert.equal(specialization(context).solarFocusingLens.expiresAt, 1.04);
    const hit = { actorType: 'player', coefficient: 1, at };
    assert.equal(Boolean(consumeSolarFocusingLens(context, hit)), at >= 0.001 && at <= 1.04);
    assert.equal(consumeSolarFocusingLens(context, hit), undefined);
  }
});

test('Painful Bond duration stacking and damage use exact exclusive tick expiry', () => {
  const context = contextFor(necromancerProfession, 'Ritualist');
  handleNecromancerPainfulBond(context, { mode: 'apply', at: 0.001, duration: 1 });
  assert.equal(specialization(context).painfulBondUntil, 1.04);
  handleNecromancerPainfulBond(context, { mode: 'apply', at: 0.5, duration: 1 });
  assert.equal(specialization(context).painfulBondUntil, 2.04);
  for (const at of [2.039999, 2.04, 2.040001]) {
    context.events.length = 0;
    handleNecromancerPainfulBond(context, { mode: 'tick', at });
    assert.equal(
      context.events.some((event) => event.type === 'damage'),
      at < 2.04
    );
  }
});

test('Lich Form expires exactly once and preserves its last live microsecond', () => {
  const scheduler = createScheduler({
    profession: necromancerProfession,
    config: { selectedSkills: { Elite: 'Lich Form' } }
  });
  assert.equal(scheduler.cast({ type: 'cast', skillId: N.LICH_FORM }), true);
  const state = scheduler.state.profession.core;
  const deadline = state.lichEndsAt;
  assert.ok(deadline > 0);
  scheduler.advanceTo(deadline - 0.000001);
  assert.equal(state.activeShroud, 'lich');
  scheduler.advanceTo(deadline);
  assert.equal(state.activeShroud, '');
  assert.equal(state.availableFlips[N.EXIT_LICH_FORM], undefined);
  const lifeForce = state.lifeForce;
  scheduler.advanceTo(deadline + 0.000001);
  assert.equal(state.lifeForce, lifeForce);
});

test('minion command control includes its deadline but excludes the following microsecond', () => {
  for (const at of [1.999999, 2, 2.000001]) {
    const context = contextFor(necromancerProfession, 'Core');
    context.tasks = createTaskQueue({ handlers: minionActions.taskHandlers });
    minionActions.start(context, 0, {
      key: 'golem',
      ownerId: 'golem',
      firstAt: at,
      state: {
        skillId: N.SUMMON_FLESH_GOLEM,
        minionKey: 'flesh-golem',
        generation: 1,
        attackGeneration: 1,
        cycleIndex: 1,
        minionIndex: 0,
        attackIndex: 0,
        controlUntil: 2,
        controlKind: 'knockdown'
      }
    });
    context.tasks.drainThrough(at, context);
    assert.equal(
      context.events.find((event) => event.type === 'necromancer.summon-attack')?.controlKind,
      at <= 2 ? 'knockdown' : undefined
    );
  }
});

test('Righteous Instincts extends Resolution at the last live microsecond and stops at expiry', () => {
  const context = contextFor(guardianProfession, 'Core', [GT.RIGHTEOUS_INSTINCTS]);
  reactToRighteousInstincts(context, {
    at: 0.001,
    kind: 'resolution',
    duration: 1,
    resolvedAudience: { includesSelf: true }
  });
  const state = context.state.profession.core;
  assert.equal(state.resolutionUntil, 1.04);
  context.events.length = 0;
  reactToRighteousInstincts(context, {
    at: 1.039999,
    kind: 'resolution',
    duration: 1,
    resolvedAudience: { includesSelf: true }
  });
  assert.equal(state.resolutionUntil, 2.04);
  assert.equal(context.events.length, 0, 'extension must not restart the cadence');
  for (const at of [2.039999, 2.04, 2.040001]) {
    context.events.length = 0;
    state.righteousNextMightAt = at;
    handleRighteousInstinctsTick(context, { at });
    assert.equal(
      context.events.some((event) => event.kind === 'might'),
      at < 2.04
    );
  }
});

test('Symbol of Ignition and Dragonhunter tether retain exact inclusive final triggers', () => {
  for (const at of [0.000999, 0.001, 1.000999, 1.001, 1.001001]) {
    const context = contextFor(guardianProfession, 'Dragonhunter');
    handleSymbolOfIgnitionField(context, { at: 0.001, duration: 1 });
    reactToSymbolOfIgnition(context, { type: 'damage', actorType: 'player', coefficient: 1, at });
    assert.equal(context.events.length > 0, at >= 0.001 && at <= 1.001);
    context.events.length = 0;
    dragonhunterEventHandlers['guardian.dragonhunter-tethered'](context, { at: 0.001, tetherUntil: 1.001 });
    dragonhunterEventHandlers['guardian.dragonhunter-justice-pulse'](context, { at });
    assert.equal(context.events.length > 0, at <= 1.001);
  }
});

test('Mistral requires an armed window and shares inclusive expiry with its display', () => {
  for (const [deadline, at, active] of [
    [0, 0, false],
    [1.001, 1.001, true],
    [1.001, 1.001001, false]
  ]) {
    const context = contextFor(rangerProfession, 'Galeshot');
    specialization(context).mistralUntil = deadline;
    galeshotMissileReaction.taskHandlers['ranger.galeshot-missile-hit'](context, { at, payload: {} });
    assert.equal(
      context.events.some((event) => event.skillName === 'Mistral'),
      active
    );
    assert.equal(galeshotUi.rotationStateSnapshot({ state: context.state, atSeconds: at }).length > 0, active);
  }
});

test('Reavers Curse requires an arm, includes the final landing, and cannot be consumed twice', () => {
  for (const armed of [false, true]) {
    for (const delta of [0, 0.000001]) {
      const context = contextFor(revenantProfession, 'Vindicator', [RT.REAVERS_CURSE]);
      const state = specialization(context);
      if (armed) {
        context.effectiveEnd = 0.001;
        performEnergyMeld(context, context.catalog.skillsById.get(R.ENERGY_MELD));
        assert.ok(state.reaversCurseUntil > 0);
      }

      const at = armed ? state.reaversCurseUntil + delta : 0;
      assert.equal(
        vindicatorUi.rotationStateSnapshot({ state: context.state, atSeconds: at }).length > 0,
        armed && delta === 0
      );
      const profile = context.catalog.skillsById.get(R.DEATH_DROP);
      const offset = Number(profile.effects.find((effect) => effect.type === 'strike').ticks[0].atMs) / 1000;
      context.events.length = 0;
      completeVindicatorDodge(context, profile, at - offset);
      const first = context.events.find((event) => event.type === 'damage').coefficient;
      context.events.length = 0;
      completeVindicatorDodge(context, profile, at - offset);
      const second = context.events.find((event) => event.type === 'damage').coefficient;
      assert.equal(first > second, armed && delta === 0);
    }
  }
});

test('tracked Mesmer hits expire at their exact age limit', () => {
  for (const at of [0.300999, 0.301, 0.301001]) {
    const context = contextFor(mesmerProfession, 'Core');
    const skill = { id: 1, trackedHitDamage: { duration: 0.3, hitsRequired: 2 } };
    const damage = [];
    scheduleMesmerTrackedHits(context.state, (...args) => damage.push(args), skill, [0.001, at]);
    assert.equal(damage.length, at < 0.301 ? 1 : 0);
  }
});

test('Time Bomb cannot rearm early and its marker shares the exact detonation deadline', () => {
  const scheduler = createScheduler({
    profession: mesmerProfession,
    config: { specialization: 'Chronomancer', selectedTraitIds: [MT.TIME_BOMB] }
  });
  const context = { ...scheduler.context, start: 0.001, fullEnd: 0.001, effectiveEnd: 0.001, reservationId: 'bomb' };
  const skill = context.catalog.skillsById.get(M.TIME_SINK);
  completeChronomancerTimeBomb(context, skill);
  const deadline = specialization(context).timeBombUntil;
  const marker = scheduler.events.find((event) => event.kind === 'time-bomb');
  assert.equal(marker.expiresAt, deadline);
  context.fullEnd = context.effectiveEnd = deadline - 0.000001;
  completeChronomancerTimeBomb(context, skill);
  assert.equal(specialization(context).timeBombUntil, deadline);
  context.fullEnd = context.effectiveEnd = deadline;
  completeChronomancerTimeBomb(context, skill);
  assert.ok(specialization(context).timeBombUntil > deadline);
});

test('Dragon Trigger includes a charge exactly at the canonical deadline and no later charge', () => {
  const input = {
    startTime: 0,
    flow: 100,
    maximumFlow: 100,
    maximumCharges: 10,
    chargesPerInterval: 1,
    flowPerInterval: 5,
    flowRateSegments: [],
    deadline: 0.3
  };
  assert.equal(projectDragonCharges({ ...input, tickAt: (index) => 0.1 + index * 0.2 }).length, 1);
  assert.equal(projectDragonCharges({ ...input, tickAt: (index) => 0.100001 + index * 0.2 }).length, 0);
});

test('Skritt Scuffle allows the final pilfer without a grace period', () => {
  for (const at of [15, 15.000001]) {
    const context = contextFor(thiefProfession, 'Antiquary');
    specialization(context).artifactUsesRemaining = 0;
    handleSkrittScuffle(context, { at, payload: { expiresAt: 15 } });
    assert.equal(specialization(context).artifactUsesRemaining > 0, at === 15);
  }
});

test('Nourys recurring damage windows have exact starts and exclusive tick-aligned ends', () => {
  const context = { combatStartTime: 0.001 };
  for (const [at, bonus] of [
    [30, 0],
    [30.001, 0.25],
    [35.039999, 0.25],
    [35.04, 0],
    [65.000999, 0],
    [65.001, 0.25]
  ]) {
    assert.equal(nourys.outgoingDamageBonus(context, {}, 'strike', at), bonus);
  }
});

test('Aristocracy excludes its own trigger instant but benefits the following microsecond', () => {
  const state = aristocracy.createState();
  aristocracy.condition({}, state, {
    type: 'condition',
    actorType: 'player',
    at: 0.001,
    condition: 'Vulnerability',
    duration: 1,
    stacks: 1
  });
  assert.equal(aristocracy.conditionDurationBonus({}, state, 0.001), 0);
  assert.equal(aristocracy.conditionDurationBonus({}, state, 0.001001), 0.03);
});
