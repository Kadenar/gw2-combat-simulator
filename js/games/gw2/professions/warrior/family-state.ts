import { projectPublicProfessionState, snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import type { ScheduledTask } from '#gw2/platform/engine/execution/types.js';
import type {
  WarriorCastContext,
  WarriorEndStateProjectionOptions,
  WarriorSkill,
  WarriorState,
  WarriorSchedulerContext
} from '#gw2/professions/warrior/types.js';
import {
  gainCoreWarriorAdrenaline,
  spendCoreWarriorAdrenaline
} from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import {
  WARRIOR_CORE_PUBLIC_END_STATE_DEFAULTS,
  WARRIOR_CORE_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/warrior/core/state.js';
import {
  BERSERKER_PUBLIC_END_STATE_DEFAULTS,
  BERSERKER_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/warrior/specializations/berserker/state.js';
import {
  BLADESWORN_PUBLIC_END_STATE_DEFAULTS,
  BLADESWORN_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import {
  PARAGON_PUBLIC_END_STATE_DEFAULTS,
  PARAGON_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/warrior/specializations/paragon/state.js';
import {
  SPELLBREAKER_PUBLIC_END_STATE_DEFAULTS,
  SPELLBREAKER_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { spendBerserkerAdrenaline } from '#gw2/professions/warrior/specializations/berserker/mechanics/adrenaline.js';
import { recordBladeswornAmmoSpend } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/ammunition.js';
import { gainBladeswornFlow } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/flow.js';
import { spendParagonAdrenaline } from '#gw2/professions/warrior/specializations/paragon/mechanics/adrenaline.js';
import { spendSpellbreakerAdrenaline } from '#gw2/professions/warrior/specializations/spellbreaker/mechanics/adrenaline.js';

/** Aggregates Core and active-specialization state at the Warrior family boundary. */
export function snapshotWarriorState(
  state: unknown,
  skillsById: WarriorSchedulerContext['catalog']['skillsById']
): WarriorState {
  const snapshot = snapshotProfessionState<WarriorState>(state);
  // Keep public/UI labels derived from the current catalog, never used as mechanic identity.
  snapshot.activeRefrain = snapshot.activeRefrainId == null ? '' : skillsById.get(snapshot.activeRefrainId)?.name || '';
  return snapshot;
}

export const WARRIOR_PUBLIC_END_STATE_KEYS: readonly (keyof WarriorState)[] = Object.freeze([
  ...WARRIOR_CORE_PUBLIC_END_STATE_KEYS,
  ...BERSERKER_PUBLIC_END_STATE_KEYS,
  ...SPELLBREAKER_PUBLIC_END_STATE_KEYS,
  ...BLADESWORN_PUBLIC_END_STATE_KEYS,
  ...PARAGON_PUBLIC_END_STATE_KEYS
]);

const INACTIVE_DEFAULTS: Readonly<Partial<WarriorState>> = Object.freeze({
  ...WARRIOR_CORE_PUBLIC_END_STATE_DEFAULTS,
  ...BERSERKER_PUBLIC_END_STATE_DEFAULTS,
  ...SPELLBREAKER_PUBLIC_END_STATE_DEFAULTS,
  ...BLADESWORN_PUBLIC_END_STATE_DEFAULTS,
  ...PARAGON_PUBLIC_END_STATE_DEFAULTS
});

/** Projects the stable public end state after the active slice has been flattened. */
export function projectWarriorEndState({
  schedulerState,
  schedulerContext
}: WarriorEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotWarriorState(schedulerState.profession, schedulerContext.catalog.skillsById);
  return projectPublicProfessionState(state, WARRIOR_PUBLIC_END_STATE_KEYS, INACTIVE_DEFAULTS);
}

// Family resource routing: Core owns the adrenaline contract, the active specialization owns its conversion.

function specializationKind(context: WarriorSchedulerContext): string {
  return context.state.profession.specialization.kind;
}

/** Routes a family resource gain through the active specialization's conversion policy. */
export function gainWarriorAdrenaline(context: WarriorSchedulerContext, amount: number): void {
  if (specializationKind(context) === 'Bladesworn') {
    gainBladeswornFlow(context, amount);
    return;
  }

  gainCoreWarriorAdrenaline(context, amount);
}

/** Routes a resource spend to the slice that owns the active profession mechanic. */
export function spendWarriorAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  switch (specializationKind(context)) {
    case 'Berserker':
      return spendBerserkerAdrenaline(context, skill);
    case 'Spellbreaker':
      return spendSpellbreakerAdrenaline(context, skill);
    case 'Paragon':
      return spendParagonAdrenaline(context, skill);
    default:
      return spendCoreWarriorAdrenaline(context, skill);
  }
}

/** Applies the selected spend policy before routing any skill-authored resource gain. */
export function applyWarriorSkillResource(context: WarriorCastContext, skill: WarriorSkill): number {
  const spent = spendWarriorAdrenaline(context, skill);
  // Cancellation retains spending but cannot award a successful activation's resource gain.
  if (!context.action.cancelled && Number(skill.adrenalineGain || 0) > 0) {
    gainWarriorAdrenaline(context, Number(skill.adrenalineGain));
  }

  return spent;
}

/** Ordinary strikes grant adrenaline except on Bladesworn, which generates passive Flow. */
export function warriorGainsAdrenalineOnHit(context: WarriorSchedulerContext): boolean {
  return specializationKind(context) !== 'Bladesworn';
}

/** Applies deferred strike-resource gains through the active family policy. */
export function handleWarriorAdrenalineTask(context: WarriorSchedulerContext, task: ScheduledTask): void {
  const payload = task.payload as { readonly amount?: number } | null;
  gainWarriorAdrenaline(context, Number(payload?.amount ?? 1));
}

/** Routes generic ammo-spend facts to the active slice that reacts to them. */
export function recordWarriorAmmoSpend(context: WarriorCastContext, roundsSpent: number, startedFull: boolean): void {
  if (context.state.profession.specialization.kind === 'Bladesworn') {
    recordBladeswornAmmoSpend(context, roundsSpent, startedFull);
  }
}
