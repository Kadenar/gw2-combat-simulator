import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { CAST_READY, denyCast, retryCast } from '#gw2/platform/execution/availability.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { dragonChargeTickOffsetSeconds } from '#gw2/professions/warrior/data/dragon-charges.js';
import { swapGunsaber } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import {
  dragonFlowPerInterval,
  maximumDragonCharges
} from '#gw2/professions/warrior/specializations/bladesworn/traits/behavior.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { timeKey } from '#kernel/core/clock.js';
const CHARGE_TICK = 'warrior.dragon-charge';
const TRIGGER_EXPIRY = 'warrior.dragon-trigger-expiry';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { clamp } from '#kernel/core/numeric.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

export const DRAGON_TRIGGER_ENTRY_RESOURCE_REASON = 'dragon trigger entry';
export const DRAGON_TRIGGER_TICK_RESOURCE_REASON = 'dragon trigger charge';

export function dragonSlashCoefficient(
  minimum: number,
  maximum: number,
  charges: number,
  maximumCharges: number
): number {
  if (maximumCharges <= 1) return maximum;
  const resolvedCharges = clamp(charges, 1, maximumCharges);
  return minimum + (maximum - minimum) * ((resolvedCharges - 1) / (maximumCharges - 1));
}

// Maps charges to adrenaline bars spent (1 bar = 10): 1-4 charges → 10,
// 5-9 → 20, 10 → 30. Used by burst traits that scale on adrenaline bars.
export function dragonChargesToAdrenalineSpent(charges: number): number {
  if (charges >= 10) return 30;
  if (charges >= 5) return 20;
  return charges > 0 ? 10 : 0;
}

/** Missing release thresholds use the mechanic's current maximum; authored thresholds stay within its charge range. */
function requestedDragonCharges(configured: number | undefined, maximumCharges: number): number {
  if (configured == null) return maximumCharges;
  return clamp(configured, 1, maximumCharges);
}
// Shared reason string so both the availability check and the charge-release
// projection surface the same message in the UI.

export const ENTER_DRAGON_TRIGGER_REASON = 'Enter Dragon Trigger before using this skill.';

/** Charge windows own their next actual tick; release or replacement invalidates all remaining wakes by activation ID. */
export function exitDragonTrigger(runtime: Runtime, at = runtime.time): void {
  const state = bladeswornState.from(runtime);
  if (!state.dragonTriggerActive) return;
  runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.DRAGON_TRIGGER)!, at);
  state.dragonTriggerActive = false;
  state.dragonTriggerStartedAt = 0;
  state.dragonTriggerChargeDeadline = 0;
  state.nextDragonChargeAt = 0;
  state.dragonChargeTickCount = 0;
  state.dragonChargeReachedAt = [];
  state.dragonCharges = 0;
  state.dragonChargesPerInterval = 1;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = '';
}

/** Schedule charge work from the activation clock so stalls cannot shift the charge grid. */

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
  const pending = runtime.castController.pendingChargeRelease();
  if (
    pending &&
    runtime.helpers.skillsById.get(pending.skillId)?.dragonSlash &&
    state.dragonCharges >= requestedDragonCharges(pending.charges, maximumDragonCharges(runtime))
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

/** Release captures charge facts before clearing the mode; every packet still uses common miss, interruption, and impact scheduling. */
export function slashEffects(_runtime: Runtime, cast: RuntimeCast<WarriorSkill>): readonly SkillEffect[] {
  const released = dragonSlashRelease(_runtime, cast)!;
  const skill = cast.skill;
  const spent = dragonChargesToAdrenalineSpent(released.charges);
  const timing = {
    timingAnchor: 'castStart' as const,
    timingScale: 'fixed' as const,
    atMs: skill.dragonSlashImpactOffsetMs ?? (cast.fullEnd - cast.start) * 1000
  };
  const effects: SkillEffect[] = [
    {
      ...timing,
      type: 'strike',
      coefficient: released.coefficient,
      weapon: 'Gunsaber',
      damageKind: 'explosion',
      hits: 1,
      metadata: { warriorAdrenalineSpent: spent, warriorBurstTier: spent / 10 }
    }
  ];
  const min = skill.dragonSlashMinimumBurningDuration ?? 0;
  const max = skill.dragonSlashMaximumBurningDuration ?? 0;
  if (min > 0 && max > 0) {
    const stacks = dragonSlashCoefficient(1, 20, released.charges, released.maximum);
    const duration = dragonSlashCoefficient(min, max, released.charges, released.maximum);
    effects.push({
      ...timing,
      type: 'condition',
      condition: 'Burning',
      stacks,
      duration
    });
  }

  return effects;
}

/** Accepted releases publish captured charge facts before clearing the shared Trigger state, even on cancellation. */
function captureSlash(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const state = bladeswornState.from(runtime);
  const maximum = maximumDragonCharges(runtime);
  const release = {
    charges: state.dragonCharges,
    maximum,
    flowSpent: state.dragonTriggerFlowSpent,
    coefficient: dragonSlashCoefficient(
      cast.skill.dragonSlashMinimumCoefficient ?? 0,
      cast.skill.dragonSlashMaximumCoefficient ?? 0,
      state.dragonCharges,
      maximum
    )
  };
  state.dragonSlashReleases.set(cast.id, Object.freeze(release));
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'resource',
      at: runtime.time,
      source: 'Warrior',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      resource: 'dragon charges',
      reason: 'profession mechanic',
      amount: -release.charges,
      value: 0,
      requestedCharges: requestedDragonCharges(cast.command.releaseAtCharges, release.maximum),
      maximumCharges: release.maximum,
      chargesReached: release.charges,
      flowSpent: release.flowSpent,
      flowAfter: state.flow,
      coefficient: release.coefficient,
      chargingSeconds: runtime.time - state.dragonTriggerStartedAt,
      maximumChargingSeconds: dragonChargeTickOffsetSeconds(Math.ceil(release.maximum / state.dragonChargesPerInterval))
    }
  });
  exitDragonTrigger(runtime);
}

/** Release facts belong to this run and survive exit for commit traits and detached packets. */
export function dragonSlashRelease(runtime: MechanicQueriesOf<Runtime>, cast: RuntimeCast<WarriorSkill>) {
  return bladeswornState.from(runtime).dragonSlashReleases.get(cast.id);
}

/** The lifecycle supplies its own tasks and actions; module composition only states cross-mechanic order. */
export const dragonTriggerHooks = {
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    const state = bladeswornState.from(runtime);
    if (skill?.dragonSlash) {
      const charges = Number(inputs.charges ?? maximumDragonCharges(runtime));
      if (!Number.isInteger(charges) || charges < 1 || charges > maximumDragonCharges(runtime))
        throw new RangeError('Dragon charges exceed the selected build maximum.');
      state.dragonTriggerActive = true;
      state.dragonCharges = charges;
      state.dragonChargeReachedAt = Array.from({ length: charges + 1 }, () => 0);
      state.dragonTriggerChargeDeadline = Infinity;
    }
  },

  reserveRecharge: (_runtime, skill, work) => (skill.id === ID.DRAGON_TRIGGER ? 0 : work),
  sideEffectHandlers: {
    'warrior.dragon-trigger-enter'(runtime, context) {
      if (context.kind === 'cast') enterDragonTrigger(runtime, context.cast);
    },
    'warrior.slash-release'(runtime, context) {
      if (context.kind === 'cast') captureSlash(runtime, context.cast);
    }
  },
  tasks: {
    [CHARGE_TICK]: chargeTick,
    [TRIGGER_EXPIRY](runtime, identity) {
      const state = bladeswornState.from(runtime);
      if (state.dragonTriggerActive && state.dragonTriggerEventActivationId === identity)
        exitDragonTrigger(runtime, state.dragonTriggerChargeDeadline);
    }
  }
} satisfies Partial<RuntimeProfession<WarriorRuntimeState, WarriorSkill>>;
/** Entry and release readiness use observed charge thresholds and the current Flow pool. */
export const dragonTriggerAvailability: NonNullable<
  RuntimeProfession<WarriorRuntimeState, WarriorSkill>['availability']
> = (runtime, skill, command) => {
  const state = bladeswornState.from(runtime);
  if ((skill.dragonSlash || skill.dragonTriggerSkill) && !state.dragonTriggerActive)
    return denyCast('warrior.dragon-trigger', ENTER_DRAGON_TRIGGER_REASON);
  if (skill.id === ID.DRAGON_TRIGGER) {
    if (state.dragonTriggerActive) return denyCast('warrior.dragon-trigger', 'Dragon Trigger is already active.');
    const cost = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.dragonTrigger), 'threshold');
    if (state.flow + EPSILON < cost) return denyCast('warrior.flow', `Dragon Trigger requires at least ${cost} flow.`);
  }

  if (skill.dragonSlash) {
    const requested = requestedDragonCharges(command.releaseAtCharges, maximumDragonCharges(runtime));
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

  return CAST_READY;
};
