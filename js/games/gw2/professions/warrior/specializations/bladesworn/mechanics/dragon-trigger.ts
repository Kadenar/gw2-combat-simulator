import type { CastCommand } from '#gw2/platform/execution/types.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { clamp } from '#kernel/core/numeric.js';

type Runtime = Gw2Runtime<WarriorRuntimeState, WarriorSkill>;

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

export function requestedDragonCharges(
  context: { readonly command: Pick<CastCommand, 'releaseAtCharges'> },
  maximumCharges: number
): number {
  const configured = context.command.releaseAtCharges;
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
  state.dragonCharges = 0;
  state.dragonChargesPerInterval = 1;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = '';
}
