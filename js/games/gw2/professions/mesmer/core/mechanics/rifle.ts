/** Resolves Inspiring Imagery's mutually exclusive boon expiry and offensive detonation. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerCastContext, MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Bind the blast to this image and end its field immediately after the detonation interaction. */
export function detonateInspiringImagery(context: MesmerCastContext): void {
  const flip = professionCoreState(context).availableFlips[ID.ABSTRACTION];
  const field = context
    .eventsOfType('combo_field')
    .find((event) => event.skillId === ID.INSPIRING_IMAGERY && event.at === flip?.availableAt);
  if (!field) return;
  context.replaceEvent(field, { expiresAt: context.start });
  context.emitDerived(context.action, {
    type: 'combo_finisher',
    at: context.start,
    effectAt: context.start,
    source: 'mesmer',
    sourceId: ID.ABSTRACTION,
    skillId: ID.ABSTRACTION,
    skillName: 'Abstraction',
    actorType: 'player',
    attemptId: `${context.reservationId}:abstraction`,
    finisherType: 'Blast',
    fieldBinding: { kind: 'field-id', fieldId: String(field.fieldId) },
    // Abstraction consumes this exact field at the shared detonation timestamp.
    allowFieldAtExpiry: true,
    chance: 1,
    applications: 1,
    successfulCombos: 1
  });
}

export const mesmerCoreRifleSkillMechanicHandlers = Object.freeze({
  // A consumed or replaced flip means this image no longer has a natural boon explosion.
  'mesmer.core.imagery-expire': ({
    context,
    skill,
    at,
    castEnd,
    activationId
  }: {
    context: MesmerSchedulerContext;
    skill: MesmerSkill;
    at: number;
    castEnd: number;
    activationId: string;
  }): void => {
    const core = professionCoreState(context);
    if (core.availableFlips[ID.ABSTRACTION]?.availableAt !== castEnd) return;
    delete core.availableFlips[ID.ABSTRACTION];
    for (const effect of skill.effects || []) {
      if (effect.type !== 'boon') continue;
      emitSkillBuff(context, skill, {
        at,
        activationId,
        kind: String(effect.boon),
        stacks: effect.stacks,
        duration: effect.duration
      });
    }
  }
});
