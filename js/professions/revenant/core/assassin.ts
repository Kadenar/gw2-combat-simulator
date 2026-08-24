import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { emitRevenantState } from './shared.js';
import type { RevenantCastContext, RevenantSkill } from '../types.js';

/** Arms the finite Enchanted Daggers charge/expiry state. */
export function activateEnchantedDaggers(context: RevenantCastContext, skill: RevenantSkill): void {
  const buff = skill.effects?.find((effect) => effect.type === 'buff' && effect.kind === 'enchanted-daggers');
  if (!buff) throw new Error('Enchanted Daggers is missing its buff effect.');
  const charges = Math.max(0, Number(buff.stacks || 0));
  const duration = Math.max(0, Number(buff.duration || 0));
  const at = context.effectiveEnd;
  professionCoreState(context).enchantedDaggers = {
    charges,
    expiresAt: at + duration,
    readyAt: at
  };
  context.emit({
    type: 'buff',
    at,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Enchanted Daggers',
    kind: 'enchanted-daggers',
    duration,
    stacks: charges
  });
  emitRevenantState(context, at, 'enchanted-daggers');
}
