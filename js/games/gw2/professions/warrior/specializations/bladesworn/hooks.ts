import { CAST_READY, denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { GW2_ACTION_TICK_MS } from '#gw2/platform/skills/timing.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import {
  berserkersPowerDragonSlash,
  burstMasteryDragonSlash,
  resetSoldierFocus
} from '#gw2/professions/warrior/core/traits/behavior.js';
import { dragonChargeTickOffsetSeconds } from '#gw2/professions/warrior/data/dragon-charges.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import {
  DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
  DRAGON_TRIGGER_TICK_RESOURCE_REASON,
  dragonChargesToAdrenalineSpent,
  ENTER_DRAGON_TRIGGER_REASON,
  exitDragonTrigger,
  requestedDragonCharges
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import {
  bladeswornSkillActions,
  bladeswornSkillTasks,
  cartridgeExplosion,
  dragonSlashReleases
} from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import {
  ammoTraits,
  dragonFlowPerInterval,
  gunsaberEntryTraits,
  gunsAndGloryExplosion,
  maximumDragonCharges
} from '#gw2/professions/warrior/specializations/bladesworn/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime, EPSILON, timeKey } from '#kernel/core/clock.js';

type Runtime = Gw2Runtime<WarriorRuntimeState, WarriorSkill>;

const FLOW_TICK = 'warrior.flow-tick';

const CHARGE_TICK = 'warrior.dragon-charge';

const TRIGGER_EXPIRY = 'warrior.dragon-trigger-expiry';

/** Flow uses the absolute action grid; a grant at a tick cannot receive regeneration for that same tick. */
function scheduleFlowTick(runtime: Runtime): void {
  const tick = Math.floor(timeKey(runtime.time) / (GW2_ACTION_TICK_MS * 1000)) + 1;
  runtime.schedule(FLOW_TICK, (tick * GW2_ACTION_TICK_MS) / 1000, null, undefined, -250);
}

/** Credit the interval ending now before closing its windows; no future rate or event-history projection is needed. */
function flowTick(runtime: Runtime): void {
  const state = bladeswornState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  const active = (start: number, end: number) => start < runtime.time && runtime.time <= end;
  const stabilizers = state.flowStabilizerWindows.filter((window) => active(window.startedAt, window.expiresAt));
  const rate =
    (runtime.combatActive ? balanceProfileNumber(profile, 'energyRegenerationPerSecond') : 0) +
    stabilizers.length * balanceProfileNumber(profile, 'resourceGain') +
    (active(state.traitPositiveFlowStartedAt, state.traitPositiveFlowUntil)
      ? state.traitPositiveFlowStacks * balanceProfileNumber(profile, 'attributePerStack')
      : 0);
  grantWarriorAdrenaline(runtime, rate * (GW2_ACTION_TICK_MS / 1000));
  state.flowStabilizerWindows = state.flowStabilizerWindows.filter((window) => window.expiresAt > runtime.time);
  if (state.traitPositiveFlowUntil <= runtime.time) {
    state.traitPositiveFlowStartedAt = 0;
    state.traitPositiveFlowUntil = 0;
    state.traitPositiveFlowStacks = 0;
  }

  scheduleFlowTick(runtime);
}

/** Both sides share the already committed recharge and notify equipment without changing the configured weapon set. */
function swapGunsaber(runtime: Runtime, cast: RuntimeCast<WarriorSkill>, active: boolean): void {
  bladeswornState.from(runtime).gunsaberActive = active;
  // Every actual Gunsaber entry or exit shares weapon-swap recovery, including entry through Dragon Trigger.
  lockTransitionInput(runtime, 'weaponSwapMs', cast.skill);
  resetAutoattackChains(runtime);
  resetSoldierFocus(runtime);
  const swapId = cast.skill.id === ID.DRAGON_TRIGGER ? ID.UNSHEATHE_GUNSABER : cast.skill.id;
  if (cast.skill.id === ID.DRAGON_TRIGGER)
    runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.UNSHEATHE_GUNSABER)!, runtime.time);
  runtime.cooldownController.copy(swapId, ID.UNSHEATHE_GUNSABER);
  runtime.cooldownController.copy(swapId, ID.SHEATHE_GUNSABER);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'sigil_swap',
      at: runtime.time,
      source: 'warrior',
      sourceId: cast.skill.id,
      actorType: 'player',
      activationId: cast.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      weaponSet: runtime.activeWeaponSet
    }
  });
  if (active) gunsaberEntryTraits(runtime, cast);
}

/** Selected completion/entry buffs keep their own components and current duration modifiers. */

function scheduleCharge(runtime: Runtime): void {
  const state = bladeswornState.from(runtime);
  state.nextDragonChargeAt = canonicalTime(
    state.dragonTriggerStartedAt + dragonChargeTickOffsetSeconds(state.dragonChargeTickCount + 1)
  );
  if (
    state.nextDragonChargeAt <= state.dragonTriggerChargeDeadline &&
    state.dragonCharges < maximumDragonCharges(runtime)
  )
    runtime.schedule(CHARGE_TICK, state.nextDragonChargeAt, state.dragonTriggerEventActivationId, undefined, -200);
}

/** Entry spends once; the first interval is prepaid, and every subsequent interval checks then spends current Flow. */
function enterDragonTrigger(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const state = bladeswornState.from(runtime);
  if (!state.gunsaberActive) swapGunsaber(runtime, cast, true);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.dragonTrigger);
  const cost = balanceProfileNumber(profile, 'threshold');
  state.flow = Math.max(0, state.flow - cost);
  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = runtime.time;
  state.dragonTriggerChargeDeadline = canonicalTime(runtime.time + balanceProfileNumber(profile, 'cooldown'));
  state.dragonCharges = 0;
  state.dragonChargesPerInterval = state.tacticalReloadUntil > 0 && runtime.time < state.tacticalReloadUntil ? 2 : 1;
  if (state.dragonChargesPerInterval > 1) state.tacticalReloadUntil = 0;
  state.dragonChargeTickCount = 0;
  state.dragonChargeReachedAt = [];
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = cast.id;
  scheduleCharge(runtime);
  // The deadline admits both its last charge and a command at that instant; close at the next canonical microsecond.
  runtime.schedule(
    TRIGGER_EXPIRY,
    (timeKey(state.dragonTriggerChargeDeadline) + 1) / 1_000_000,
    cast.id,
    undefined,
    -220
  );
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'resource',
      at: runtime.time,
      source: 'Warrior',
      sourceId: ID.DRAGON_TRIGGER,
      actorType: 'player',
      skillId: ID.DRAGON_TRIGGER,
      skillName: 'Dragon Trigger',
      activationId: cast.id,
      resource: 'flow',
      reason: DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
      amount: -cost,
      value: state.flow,
      maximumFlow: state.maximumFlow,
      maximumCharges: maximumDragonCharges(runtime),
      chargesPerInterval: state.dragonChargesPerInterval,
      nextChargeAt: state.nextDragonChargeAt,
      deadline: state.dragonTriggerChargeDeadline
    }
  });
}

function chargeTick(runtime: Runtime, identity: unknown): void {
  const state = bladeswornState.from(runtime);
  if (!state.dragonTriggerActive || state.dragonTriggerEventActivationId !== identity) return;
  // A pending delayed release holds its selected charges without spending Flow; the ordinary clock still advances.
  const pending = runtime.cursor.command;
  if (
    pending?.type === 'cast' &&
    Number(pending.releaseDelayMs) > 0 &&
    runtime.helpers.skillsById.get(pending.skillId)?.dragonSlash &&
    state.dragonCharges >= requestedDragonCharges({ command: pending }, maximumDragonCharges(runtime))
  ) {
    state.dragonChargeTickCount++;
    scheduleCharge(runtime);
    return;
  }

  const cost = state.dragonChargeTickCount === 0 ? 0 : dragonFlowPerInterval(runtime);
  const granted = state.flow + EPSILON >= cost;
  const before = state.dragonCharges;
  if (granted) {
    state.flow = Math.max(0, state.flow - cost);
    state.dragonTriggerFlowSpent += cost;
    state.dragonCharges = Math.min(maximumDragonCharges(runtime), state.dragonCharges + state.dragonChargesPerInterval);
    for (let charge = before + 1; charge <= state.dragonCharges; charge++) {
      state.dragonChargeReachedAt[charge] = runtime.time;
    }
  }

  state.dragonChargeTickCount++;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'resource',
      at: runtime.time,
      source: 'Warrior',
      sourceId: ID.DRAGON_TRIGGER,
      actorType: 'player',
      skillId: ID.DRAGON_TRIGGER,
      skillName: 'Dragon Trigger',
      activationId: state.dragonTriggerEventActivationId,
      resource: 'dragon charges',
      reason: DRAGON_TRIGGER_TICK_RESOURCE_REASON,
      amount: state.dragonCharges - before,
      value: state.dragonCharges,
      flowAfter: state.flow,
      flowSpent: granted ? cost : 0,
      deadline: state.dragonTriggerChargeDeadline
    }
  });
  scheduleCharge(runtime);
}

/** Only actual player explosions extend Glory or create cartridge Burning; neither derived condition can recurse. */
function explosion(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;

  gunsAndGloryExplosion(runtime, event);

  cartridgeExplosion(runtime, event);
}

/** Native declarations own actual resources, bar transitions, completed ammunition rewards, and accepted explosions. */
export const bladeswornHooks: Partial<RuntimeProfession<WarriorRuntimeState, WarriorSkill>> = {
  sideEffectHandlers: {
    ...bladeswornSkillActions,
    // Bar declarations invoke the shared transition, including recharge and entry trait observers.
    'warrior.gunsaber-enter'(runtime, context) {
      if (context.kind === 'cast') swapGunsaber(runtime, context.cast, true);
    },
    'warrior.gunsaber-exit'(runtime, context) {
      if (context.kind === 'cast') {
        exitDragonTrigger(runtime);
        swapGunsaber(runtime, context.cast, false);
      }
    },
    'warrior.dragon-trigger-enter'(runtime, context) {
      if (context.kind === 'cast') enterDragonTrigger(runtime, context.cast);
    }
  },
  // Entry rewards use the committed skill; slash rewards require the release captured at cast start.

  reserveRecharge: (_runtime, skill, work) => (skill.id === ID.DRAGON_TRIGGER ? 0 : work),
  // Like weapon swaps, Gunsaber transitions recharge instantly until combat begins.
  rechargeWork: (runtime, skill, work) =>
    (skill.id === ID.UNSHEATHE_GUNSABER || skill.id === ID.SHEATHE_GUNSABER) && !runtime.combatActive ? 0 : work,
  // Only the trait adds control; the selected release owns all intrinsic packets.

  availability(runtime, skill, command) {
    const state = bladeswornState.from(runtime);
    if (skill.burst && !skill.dragonSlash)
      return denyCast('warrior.flow', 'Bladesworn replaces weapon bursts with Dragon Slash.');
    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS)
      return denyCast('warrior.gunsaber', 'Bladesworn cannot swap normal weapon sets in combat.');
    if (skill.id === ID.UNSHEATHE_GUNSABER && state.gunsaberActive)
      return denyCast('warrior.gunsaber', 'Gunsaber is already active.');
    if (skill.id === ID.SHEATHE_GUNSABER && !state.gunsaberActive)
      return denyCast('warrior.gunsaber', 'Gunsaber is not active.');
    if ((state.gunsaberActive || state.dragonTriggerActive) && skill.type === 'Weapon' && skill.weapon)
      return denyCast('warrior.gunsaber', 'Sheathe the gunsaber before using standard weapon skills.');
    if ((skill.dragonSlash || skill.dragonTriggerSkill) && !state.dragonTriggerActive)
      return denyCast('warrior.dragon-trigger', ENTER_DRAGON_TRIGGER_REASON);
    if (skill.id === ID.DRAGON_TRIGGER) {
      if (state.dragonTriggerActive) return denyCast('warrior.dragon-trigger', 'Dragon Trigger is already active.');
      const cost = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.dragonTrigger), 'threshold');
      if (state.flow + EPSILON < cost)
        return denyCast('warrior.flow', `Dragon Trigger requires at least ${cost} flow.`);
    }

    if (skill.dragonSlash) {
      const requested = requestedDragonCharges({ command }, maximumDragonCharges(runtime));
      if (state.dragonCharges < requested) {
        if (state.nextDragonChargeAt > state.dragonTriggerChargeDeadline)
          return denyCast(
            'warrior.flow',
            `Dragon Slash could not reach ${requested} charges before Dragon Trigger ended; it reached ${state.dragonCharges}.`
          );
        return retryCast(
          state.nextDragonChargeAt,
          'warrior.dragon-trigger-charging',
          `Dragon Trigger is charging to ${requested} charges.`
        );
      }

      // Anchor the hold to the actual selected threshold, so retries cannot restart it or bypass Flow stalls.
      if (Number(command.releaseDelayMs) > 0) {
        const reachedAt = state.dragonChargeReachedAt[requested];
        if (reachedAt == null) throw new TypeError('A delayed Dragon Slash requires its observed charge threshold.');
        const releaseAt = canonicalTime(reachedAt + command.releaseDelayMs! / 1000);
        if (releaseAt > state.dragonTriggerChargeDeadline)
          return denyCast(
            'warrior.dragon-trigger-delay',
            "The additional release delay exceeds Dragon Trigger's duration."
          );
        if (runtime.time < releaseAt)
          return retryCast(releaseAt, 'warrior.dragon-trigger-delay', 'Holding Dragon Slash before release.');
      }
    }

    if (skill.gunsaberSkill && !skill.dragonSlash && !skill.dragonTriggerSkill) {
      if (state.dragonTriggerActive)
        return denyCast('warrior.dragon-trigger', 'Finish Dragon Trigger before using gunsaber attacks.');
      if (!state.gunsaberActive) return denyCast('warrior.gunsaber', 'Unsheathe the gunsaber first.');
    }

    return CAST_READY;
  },
  initialize(runtime) {
    const state = bladeswornState.from(runtime);
    state.maximumFlow = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.resources),
      'maximumStacks'
    );
    state.flow = Math.min(state.flow, state.maximumFlow);
    runtime.profession.core.adrenaline = 0;
    runtime.profession.core.maximumAdrenaline = 0;
    scheduleFlowTick(runtime);
  },
  onCastStart(runtime, cast) {
    if (cast.ammo) {
      const ammo = runtime.ammo.get(cast.skill.id)!;
      warriorAmmunition.set(cast, { rounds: 1, startedFull: ammo.charges >= ammo.maximum });
    }

    if (!cast.skill.dragonSlash && cast.fullEnd > cast.start) exitDragonTrigger(runtime);
  },
  onCastCommit(runtime, cast) {
    // Successful ammunition commitment earns its reward even when the remaining animation is interrupted.
    ammoTraits(runtime, cast);
    grantWarriorAdrenaline(runtime, cast.skill.flowGain ?? 0);
    const release = dragonSlashReleases.get(cast);
    if (release) {
      burstMasteryDragonSlash(runtime, cast, release);

      berserkersPowerDragonSlash(runtime, cast, dragonChargesToAdrenalineSpent(release.charges));
    }

    if (cast.skill.gunsaberSkill && !runtime.helpers.autoattackChainPositions.has(Number(cast.skill.id)))
      resetAutoattackChains(runtime);
  },
  tasks: {
    ...bladeswornSkillTasks,
    [FLOW_TICK]: flowTick,
    [CHARGE_TICK]: chargeTick,
    [TRIGGER_EXPIRY](runtime, identity) {
      const state = bladeswornState.from(runtime);
      if (state.dragonTriggerActive && state.dragonTriggerEventActivationId === identity)
        exitDragonTrigger(runtime, state.dragonTriggerChargeDeadline);
    }
  },
  reactions: { 'damage.resolved': explosion }
};
