import { expireSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
/** Resolves Inspiring Imagery's mutually exclusive boon expiry and offensive detonation. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Bind the blast to this image and end its field immediately after the detonation interaction. */
export function detonateInspiringImagery(context: MesmerRuntime, cast: RuntimeCast): void {
  const flip = professionCoreState(context).availableFlips[ID.ABSTRACTION];
  const field = [...context.combo.fields.values()].find(
    (event) => event.skillId === ID.INSPIRING_IMAGERY && event.at === flip?.availableAt
  );
  if (!field) return;
  context.combo.fields.set(field.fieldId, { ...field, expiresAt: cast.start });
  context.emit({
    activationId: cast.id,
    type: 'combo_finisher',
    at: cast.start,
    effectAt: cast.start,
    source: 'mesmer',
    sourceId: ID.ABSTRACTION,
    skillId: ID.ABSTRACTION,
    skillName: 'Abstraction',
    actorType: 'player',
    attemptId: `${cast.id}:abstraction`,
    finisherType: 'Blast',
    fieldBinding: { kind: 'field-id', fieldId: String(field.fieldId) },
    // Abstraction consumes this exact field at the shared detonation timestamp.
    allowFieldAtExpiry: true,
    chance: 1,
    applications: 1,
    successfulCombos: 1
  });
}

/** Only the matching live image can resolve its natural boon explosion. */
export function expireInspiringImagery(context: MesmerRuntime, cast: RuntimeCast): void {
  if (!expireSkillFlip(context.profession.core.availableFlips, ID.ABSTRACTION, context.time, cast.id)) return;
  for (const effect of cast.skill.effects ?? [])
    if (effect.type === 'boon')
      mesmerMechanicsFor(context).addEvent({
        type: 'buff',
        at: context.time,
        activationId: cast.id,
        source: 'mesmer',
        sourceId: cast.skill.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        kind: String(effect.boon),
        stacks: Number(effect.stacks ?? 1),
        duration: Number(effect.duration)
      });
}
