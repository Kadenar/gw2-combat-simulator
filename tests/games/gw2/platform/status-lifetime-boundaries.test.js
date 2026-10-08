import { flattenProfessionState } from '#gw2/platform/profession-definition/state.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { aristocracy } from '#gw2/platform/equipment/relics/rules/aristocracy.js';
import { nourys } from '#gw2/platform/equipment/relics/rules/nourys.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { ELEMENTALIST_SKILL_IDS as E, ELEMENTALIST_TRAIT_IDS as ET } from '#gw2/professions/elementalist/data/ids.js';
import {
  applyCatalystResolvedDamage,
  applyShatteringIce
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { grantCatalystElementalEmpowerment } from '#gw2/professions/elementalist/specializations/catalyst/traits/empowerment.js';
import { onAcceptedEvent } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { commitRechargeDuration } from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';
import { consumeElectricEnchantment } from '#gw2/professions/elementalist/specializations/evoker/traits/enchantments.js';
import { weaverHooks } from '#gw2/professions/elementalist/specializations/weaver/hooks.js';
import { applyWeaveSelfAttunement } from '#gw2/professions/elementalist/specializations/weaver/mechanics/weave-self.js';
import { ENGINEER_TRAIT_IDS as HT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { consumeSolarFocusingLens } from '#gw2/professions/engineer/specializations/holosmith/traits/behavior.js';
import { solarFocusingLens } from '#gw2/professions/engineer/specializations/holosmith/traits/index.js';
import { GUARDIAN_TRAIT_IDS as GT } from '#gw2/professions/guardian/data/ids.js';
import { scheduleMesmerTrackedHits } from '#gw2/professions/mesmer/core/mechanics/tracked-hits.js';
import { MESMER_SKILL_IDS as M, MESMER_TRAIT_IDS as MT } from '#gw2/professions/mesmer/data/ids.js';
import { completeChronomancerTimeBomb } from '#gw2/professions/mesmer/specializations/chronomancer/traits/time-bomb.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as RI } from '#gw2/professions/ranger/data/ids.js';
import { bindGaleshotUi } from '#gw2/professions/ranger/specializations/galeshot/presentation.js';
import { REVENANT_TRAIT_IDS as RT } from '#gw2/professions/revenant/data/ids.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const galeshotUi = bindGaleshotUi(rangerCatalog);

// Real catalogs and state owners; buffer emitted work to isolate the boundary contract of each handler.
function contextFor(profession, specialization, selectedTraitIds = []) {
  const config = { specialization, selectedTraitIds };
  const runtime = profession.resolveProfession(config);
  const events = [];
  const emit = (event) => {
    events.push(event);
    return event;
  };

  const context = {
    traits: new Set(selectedTraitIds),
    config,
    hasBuff: () => false,
    profession: runtime,
    catalog: runtime.catalog,
    state: {
      time: 0,
      activeWeaponSet: 1,
      profession: runtime.createState(config)
    },
    events,
    effects: captureEffectEmissions({ submit: emit }).effects,
    eventByOrder: () => undefined,
    replaceEvent: (event, update) => Object.assign(event, update),
    tasks: { schedule: emit },
    query: { statsAt: () => ({}) },
    createActivationId: () => `test-${events.length}`,
    start: 0,
    fullEnd: 0,
    effectiveEnd: 0,
    horizon: 0,
    observationEndTime: 0
  };
  // Handler tests use the same recharge owner as the scheduler, with no active recharge-speed boons.
  context.cooldownController = createCooldownController({ clock: context.state, rechargeDuration: () => 0 });
  return context;
}

const specialization = (context) => context.state.profession.specialization.state;

// Native services supply the actual state and catalog; collect only the handler's immediate output.
function elementalistContext(specialization, selectedTraitIds = []) {
  const runtime = observedRuntime(runElementalist([], { specialization, selectedTraitIds }));
  runtime.events = [];
  runtime.effects = captureEffectEmissions({
    now: () => runtime.time,
    submit: (event) => {
      runtime.events.push(event);
      return event;
    }
  }).effects;
  return runtime;
}

test('temporary Elemental Empowerment stacks survive the final microsecond and expire on their buff tick', () => {
  const context = elementalistContext('Catalyst');
  const state = context.profession.specialization.state;
  grantCatalystElementalEmpowerment(state, 0.001, 1, 1, 10);
  assert.deepEqual(state.elementalEmpowermentExpiries, [1.04]);
  grantCatalystElementalEmpowerment(state, 1.039999, 1, 1, 10);
  assert.deepEqual(state.elementalEmpowermentExpiries, [1.04, 2.04]);
  grantCatalystElementalEmpowerment(state, 1.04, 1, 1, 10);
  assert.deepEqual(state.elementalEmpowermentExpiries, [2.04, 2.04]);
});

test('Shattering Ice uses the same exclusive tick deadline for grants and hits', () => {
  for (const at of [1.039999, 1.04, 1.040001]) {
    const context = elementalistContext('Catalyst');
    applyShatteringIce(context, {
      kind: 'shattering ice',
      at: 0.001,
      duration: 1,
      resolvedAudience: { includesSelf: true }
    });
    assert.equal(context.profession.specialization.state.shatteringIceUntil, 1.04);
    applyCatalystResolvedDamage(context, { type: 'damage', at, actorType: 'player', coefficient: 1 });
    assert.equal(
      context.events.some((event) => event.type === 'damage'),
      at < 1.04
    );
  }
});

test('Perfect Weave grant and Tailored Victory gate share the emitted buff expiry', () => {
  const context = elementalistContext('Weaver');
  const state = context.profession.specialization.state;
  state.weaveSelfUntil = 10;
  state.weaveSelfVisited = ['Fire', 'Air', 'Water'];
  applyWeaveSelfAttunement(context, 0.001, 'Earth', 'Earth Attunement', E.EARTH_ATTUNEMENT);
  assert.equal(state.perfectWeaveUntil, 10.04);
  for (const at of [10.039999, 10.04, 10.040001]) {
    context.time = at;
    assert.equal(
      weaverHooks.availability(context, context.helpers.skillsById.get(E.TAILORED_VICTORY)).ready,
      at < 10.04
    );
  }
});

test('Elemental Balance is consumable through its final microsecond and only once', () => {
  for (const at of [5.039999, 5.04, 5.040001]) {
    const context = elementalistContext('Evoker', [ET.ELEMENTAL_BALANCE]);
    const state = context.profession.specialization.state;
    state.elementalBalanceProgress = 1;
    onAcceptedEvent(context, { type: 'elementalist.attunement-enter', to: state.element, at: 0.001 });
    assert.equal(state.elementalBalanceUntil, 5.04);
    context.time = at;
    context.skill = { type: 'Weapon', slot: 'Weapon_2' };
    assert.equal(commitRechargeDuration(context, context.skill, 10), at < 5.04 ? 10 * 0.34 : 10);
    assert.equal(commitRechargeDuration(context, context.skill, 10), 10);
  }
});

test('Electric Enchantment cannot consume hits before its grant, at its exact boundaries', () => {
  for (const at of [0.300999, 0.301, 1.319999, 1.32]) {
    const context = elementalistContext('Evoker');
    const state = context.profession.specialization.state;
    grantElectricEnchantments(state, 0.1 + 0.201, 1, 1);
    assert.equal(state.electricEnchantmentGrants[0].at, 0.301);
    assert.equal(state.electricEnchantmentGrants[0].expiresAt, 1.32);
    const event = { type: 'damage', at, actorType: 'player', coefficient: 1 };
    context.time = at;
    consumeElectricEnchantment(context, state, event);
    assert.equal(
      context.events.some((event) => event.source === 'Electric Enchantment'),
      at >= 0.301 && at < 1.32
    );
  }
});

test('Solar Focusing Lens preserves inclusive expiry without early activation or a grace period', () => {
  for (const at of [0.000999, 0.001, 1.039999, 1.04, 1.040001]) {
    const context = contextFor(engineerProfession, 'Holosmith', [HT.SOLAR_FOCUSING_LENS]);
    solarFocusingLens.hooks.eventHandlers['engineer.solar-focusing-lens'](context, {
      at: 0.001,
      duration: 1,
      stacks: 1
    });
    assert.equal(specialization(context).solarFocusingLens.expiresAt, 1.04);
    const hit = { actorType: 'player', coefficient: 1, at };
    assert.equal(Boolean(consumeSolarFocusingLens(context, hit)), at >= 0.001 && at <= 1.04);
    assert.equal(consumeSolarFocusingLens(context, hit), undefined);
  }
});

test('Righteous Instincts extends Resolution at the last live microsecond and stops at expiry', () => {
  const result = runGuardian(
    [{ type: 'wait', durationMs: 2100 }],
    { selectedTraitIds: [GT.RIGHTEOUS_INSTINCTS] },
    {
      initialize: (runtime) => {
        for (const at of [0.001, 1.039999])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              source: 'fixture',
              sourceId: 'resolution',
              actorType: 'player',
              kind: 'resolution',
              duration: 1,
              stacks: 1,
              at,
              audience: { recipients: 'self' }
            }
          });
      }
    }
  );
  const might = result.events.filter((event) => event.type === 'buff' && event.kind === 'might');
  assert.deepEqual(
    might.map((event) => event.at),
    [0.001, 1.001, 2.001]
  );
});

test('Symbol of Ignition includes its endpoint while Dragonhunter tether stops at its deadline', () => {
  for (const at of [0.000999, 0.001, 1.000999, 1.001, 1.001001]) {
    const result = runGuardian(
      [{ type: 'wait', durationMs: 1100 }],
      { specialization: 'Dragonhunter' },
      {
        initialize: (runtime) => {
          runtime.profession.core.symbolIgnitionStartsAt = 0.001;
          runtime.profession.core.symbolIgnitionUntil = 1.001;
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              source: 'guardian',
              sourceId: 'fixture-hit',
              actorType: 'player',
              coefficient: 1,
              weaponStrengthProfileId: 'weapon.scepter',
              at
            }
          });
          const state = runtime.profession.specialization.state;
          state.tetherActivationId = 'fixture-tether';
          state.tetherUntil = 1.001;
          runtime.schedule('guardian.dragonhunter.tether-burn', at, {
            activationId: state.tetherActivationId,
            deadline: state.tetherUntil,
            event: { type: 'damage', source: 'guardian', sourceId: 'tether', at }
          });
        }
      }
    );
    const ignition = result.resolvedEvents.some(
      (event) => event.type === 'condition' && event.skillName === 'Symbol of Ignition'
    );
    assert.equal(ignition, at >= 0.001 && at <= 1.001);
    const tether = result.events.some(
      (event) => event.type === 'condition' && event.name === 'Spear of Justice — Active Burning' && event.at === at
    );
    assert.equal(tether, at < 1.001);
  }
});

test('Mistral requires an armed window and shares inclusive expiry with its display', () => {
  for (const [deadline, at, active] of [
    [0, 0, false],
    [1.001, 1.001, true],
    [1.001, 1.001001, false]
  ]) {
    const result = runRanger(
      [{ type: 'wait', durationMs: 1100 }],
      { specialization: 'Galeshot' },
      {
        initialize(runtime) {
          runtime.profession.specialization.state.mistralUntil = deadline;
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              source: 'probe',
              sourceId: RI.SPLITBLADE,
              skillId: RI.SPLITBLADE,
              projectile: true, // This fixture probes Mistral's lifetime with an eligible ranged packet.
              actorType: 'player',
              at,
              coefficient: 1
            }
          });
        }
      }
    );
    assert.equal(
      result.events.some((event) => event.skillName === 'Mistral'),
      active
    );
    assert.equal(
      galeshotUi.rotationStateSnapshot({
        professionState: flattenProfessionState(observedRuntime(result).profession),
        atSeconds: at
      }).length > 0,
      active
    );
  }
});

test('Reavers Curse requires an arm, includes the final landing, and cannot be consumed twice', () => {
  const config = {
    specialization: 'Vindicator',
    selectedLegends: ['LegendaryAlliance', 'LegendaryAssassin'],
    startingLegend: 'LegendaryAlliance',
    selectedTraitIds: [RT.REAVERS_CURSE],
    initialEnergy: 100
  };
  // A completed Energy Meld arms the curse; the probe landings then read that live deadline.
  const armedState = observedRuntime(runRevenant(['Energy Meld'], config)).profession;
  const unarmedState = observedRuntime(runRevenant([], config)).profession;
  const deadline = armedState.specialization.state.reaversCurseUntil;
  assert.ok(deadline > 0);
  for (const armed of [false, true]) {
    for (const delta of [0, 0.000001]) {
      const at = armed ? deadline + delta : 0.001;
      assert.equal(
        vindicatorUi.rotationStateSnapshot({
          professionState: flattenProfessionState(armed ? armedState : unarmedState),
          atSeconds: at
        }).length > 0,
        armed && delta === 0
      );
      // The rotation outlasts the probe landings so their queued work executes.
      const wait = { type: 'wait', durationMs: Math.ceil(at * 1000) + 500 };
      const result = runRevenant(armed ? ['Energy Meld', wait] : [wait], config, {
        initialize(runtime) {
          // Two same-time landings prove the first consumes the charge.
          for (const activationId of ['landing-1', 'landing-2'])
            runtime.schedule('revenant.vindicator-landing', at, { skillId: SHARED_SKILL_IDS.DODGE, activationId });
        }
      });
      const [first, second] = ['landing-1', 'landing-2'].map(
        (activationId) =>
          result.events.find((event) => event.type === 'damage' && event.activationId === activationId).coefficient
      );
      assert.equal(first > second, armed && delta === 0);
    }
  }
});

test('tracked Mesmer hits expire at their exact age limit', () => {
  for (const at of [0.300999, 0.301, 0.301001]) {
    const context = observedRuntime(runMesmer([], { specialization: 'Core' }));
    const capture = captureEffectEmissions();
    context.effects = capture.effects;
    const skill = {
      id: 1,
      name: 'Tracked fixture',
      trackedHitDamage: { duration: 0.3, hitsRequired: 2, coefficient: 1 }
    };
    scheduleMesmerTrackedHits(context, skill, [0.001, at]);
    assert.equal(capture.events.length, at < 0.301 ? 1 : 0);
  }
});

test('Time Bomb cannot rearm early and its marker shares the exact detonation deadline', () => {
  const result = runMesmer(
    [],
    { specialization: 'Chronomancer', selectedTraitIds: [MT.TIME_BOMB] },
    {
      initialize(runtime) {
        const skill = runtime.helpers.skillsById.get(M.TIME_SINK);
        completeChronomancerTimeBomb(runtime, {
          id: 'bomb',
          skill,
          command: { type: 'cast', skillId: skill.id },
          start: 0,
          fullEnd: 0,
          effectiveEnd: 0
        });
      }
    }
  );
  const context = observedRuntime(result);
  const skill = context.helpers.skillsById.get(M.TIME_SINK);
  const castAt = (at) => ({
    id: 'bomb',
    skill,
    command: { type: 'cast', skillId: skill.id },
    start: at,
    fullEnd: at,
    effectiveEnd: at
  });
  const state = context.profession.specialization.state;
  const deadline = state.timeBombUntil;
  assert.equal(context.history.find((event) => event.kind === 'time-bomb').expiresAt, deadline);
  completeChronomancerTimeBomb(context, castAt(deadline - 0.000001));
  assert.equal(state.timeBombUntil, deadline);
  completeChronomancerTimeBomb(context, castAt(deadline));
  assert.ok(state.timeBombUntil > deadline);
});

test('Skritt Scuffle allows the final pilfer without a grace period', () => {
  // Scuffle completes at 0.56 s, so its assistant expires at 15.56 s; the pulse at that instant still pilfers.
  const uses = [];
  const observe = (runtime) => uses.push(runtime.profession.specialization.state.artifactUsesRemaining);
  const clear = (runtime) => (runtime.profession.specialization.state.artifactUsesRemaining = 0);
  const result = runThief(
    ['Skritt Scuffle', { type: 'wait', durationMs: 20000 }],
    { specialization: 'Antiquary', selectedSkillIds: [77255] },
    {
      probes: [
        [15.5, clear],
        [15.56, observe],
        [15.57, clear],
        [18.6, observe]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(uses, [1, 0]);
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
  aristocracy.condition({ effects: captureEffectEmissions().effects }, state, {
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
