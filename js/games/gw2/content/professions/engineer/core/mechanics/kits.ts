import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/content/professions/engineer/state.js';
import { emitEngineerBarSwap } from '#gw2/content/professions/engineer/core/mechanics/event-handlers.js';
import type { EngineerCastContext, EngineerSkill } from '#gw2/content/professions/engineer/types.js';

/** Activates a kit and publishes the resulting bar and profession-state transitions. */
function equipKit(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = professionCoreState(context);
  // kit becomes active at effectiveEnd — weapon bar is replaced from that moment
  const at = context.effectiveEnd;
  const kit = skill.kitName || skill.name;
  state.activeKit = kit;
  emitEngineerBarSwap(context, skill, at);
  emitEngineerStateSnapshot(context, at, 'equip-kit');
}

/** Returns from the active kit to baseline weapons and publishes the bar transition. */
function stowKit(context: EngineerCastContext, skill: EngineerSkill): void {
  const at = context.effectiveEnd;
  professionCoreState(context).activeKit = '';
  emitEngineerBarSwap(context, skill, at);
  emitEngineerStateSnapshot(context, at, 'stow-kit');
}

export const engineerKitSkillHandlers = Object.freeze({
  'engineer.kit-equip': equipKit,
  'engineer.kit-stow': stowKit
});
