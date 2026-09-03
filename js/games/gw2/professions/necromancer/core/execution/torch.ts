/**
 * Owns Necromancer torch cast behavior derived from the target's live condition state.
 * Torch skill fragments remain in `skills/weapons/torch.ts`; `index.ts` assigns cast phases.
 */
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

// Converts the target's active-condition count into party Might, subject to Oppressive Collapse's seven-condition cap.
function oppressiveCollapse(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const conditionCount = Math.min(
    7,
    Object.values(context.config.target?.conditions || {}).filter((value) => value === true || Number(value) > 0).length
  );
  if (!conditionCount) return;
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    kind: 'might',
    duration: 8,
    stacks: conditionCount * 2,
    audience: { recipients: 'party' as const, maximumRecipients: 5 }
  });
}

/** Exposes torch cast hooks by handler ID for root execution composition. */
export const necromancerTorchSkillHandlers = Object.freeze({
  'necromancer.oppressive-collapse': oppressiveCollapse
});
