import { emitSkillBuff } from '../../../../platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { snapshotRevenantState } from '../state.js';
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
  emitSkillBuff(context, {
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
  emitStateSnapshot(context, 'revenant', at, 'enchanted-daggers', snapshotRevenantState(context.state.profession));
}
