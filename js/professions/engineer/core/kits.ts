import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { emitEngineerBarSwap, emitEngineerState } from './events.js';
import type { EngineerCastContext, EngineerSkill } from '../types.js';

function equipKit(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = professionCoreState(context);
  // kit becomes active at effectiveEnd — weapon bar is replaced from that moment
  const at = context.effectiveEnd;
  const kit = skill.kitName || skill.name;
  state.activeKit = kit;
  emitEngineerBarSwap(context, skill, at);
  emitEngineerState(context, at, 'equip-kit');
}

function stowKit(context: EngineerCastContext, skill: EngineerSkill): void {
  const at = context.effectiveEnd;
  professionCoreState(context).activeKit = '';
  emitEngineerBarSwap(context, skill, at);
  emitEngineerState(context, at, 'stow-kit');
}

export const engineerKitSkillHandlers = Object.freeze({
  'engineer.kit-equip': equipKit,
  'engineer.kit-stow': stowKit
});
