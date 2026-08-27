import { replaceSkillHandler } from '../../engine/skills/handlers.js';
import { resetAutoattackChains } from '../../skills/autoattack-chains.js';
import type { SimulationEventInput, Skill, SkillHandlerStrategy } from '../../engine/types.js';

interface Gw2WeaponSwapContext {
  readonly state: {
    activeWeaponSet: number;
    readonly profession: object;
  };
  readonly profession: {
    readonly id: string;
    readonly onWeaponSwap: (context: object, skill: Skill) => unknown;
  };
  readonly effectiveEnd: number;
  emit(event: SimulationEventInput): unknown;
}

/**
 * Applies the GW2-wide weapon-set transition before invoking profession-owned
 * follow-up behavior, so every profession shares state, event, and hook order.
 */
export function performGw2WeaponSwap(context: object, skill: Skill): boolean {
  const swapContext = context as Gw2WeaponSwapContext;
  const weaponSet = swapContext.state.activeWeaponSet === 1 ? 2 : 1;
  swapContext.state.activeWeaponSet = weaponSet;
  resetAutoattackChains(swapContext);
  swapContext.emit({
    type: 'weapon_set',
    at: swapContext.effectiveEnd,
    source: swapContext.profession.id,
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet
  });
  swapContext.profession.onWeaponSwap(context, skill);
  return true;
}

/** Reusable replacing handler for the ordinary Swap Weapons pseudo-skill. */
export const gw2WeaponSwapSkillHandler: Readonly<SkillHandlerStrategy<object>> =
  replaceSkillHandler(performGw2WeaponSwap);
