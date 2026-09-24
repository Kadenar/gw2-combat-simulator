import { grantResource } from '#gw2/platform/combat/resources/resource-policy.js';
/**
 * Owns synthetic Core Revenant action behavior for dodge and Ancient Echo.
 * Action declarations live in `skills/actions.ts`; registration lives in `index.ts`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';

import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { spendProfessionEndurance } from '#gw2/platform/combat/resources/endurance-policy.js';

/** Pays the profession-wide endurance cost for a dodge. */
export function performRevenantDodge(context: RevenantCastContext, skill: RevenantSkill, reason = 'dodge'): void {
  spendProfessionEndurance(context, Number(skill.resourceCost || 0), context.start);
  emitRevenantStateSnapshot(context, context.start, reason);
}

/** Grants Ancient Echo's profession-wide Energy refund. */
export function gainAncientEchoEnergy(context: RevenantCastContext): void {
  // Refund Energy only when Ancient Echo successfully completes.
  if (context.action.cancelled) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  // Legend metadata selects one self-only effect package; the generic materializer must not emit all four.
  for (const effect of context.skill.effects || []) {
    if (effect.metadata?.legendId !== state.activeLegendId || (effect.type !== 'boon' && effect.type !== 'buff'))
      continue;
    emitSkillBuff(context, context.skill, {
      at,
      kind: String(effect.boon || effect.kind),
      duration: effect.duration,
      stacks: effect.stacks
    });
  }

  grantResource(context, 'energy', Number(context.skill.resourceGain || 0), at);
  emitRevenantStateSnapshot(context, at, 'ancient-echo');
}
