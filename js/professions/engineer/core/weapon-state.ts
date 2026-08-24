import { professionCoreState } from '../../../platform/engine/profession/state.js';
import type { EngineerCastContext, EngineerSkill } from '../types.js';

export function updateEngineerWeaponState(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = professionCoreState(context);
  // A pre-commit cancellation did not land, so it must not advance or reset weapon-chain state.
  if (context.action?.cancelled === true) return;
  const chain = typeof skill.id === 'number' ? context.catalog.autoattackChainPositions.get(skill.id) : undefined;
  if (chain) {
    // chain.next == null means this was the last hit — delete the key so the next cast starts at root
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === 'Weapon') {
    // any non-chain weapon skill (e.g. a cooldown skill) resets all chains to the beginning
    state.autoattackChains = {};
  }
}
