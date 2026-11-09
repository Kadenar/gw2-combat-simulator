/** Resolves Inspiring Imagery's mutually exclusive boon expiry and offensive detonation. */
import { ACTOR, COMBO_FINISHER } from '#gw2/platform/constants.js';
import type { StatusEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Bind the blast to this image and end its field immediately after the detonation interaction. */
export function detonateInspiringImagery(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const flip = context.flips[ID.ABSTRACTION];
  const field = context.combat.fieldFor(ID.INSPIRING_IMAGERY, flip?.availableAt);

  if (!field) return;

  context.combat.expireField(field.fieldId, cast.start);
  context.effects.emit({
    kind: 'packet',
    event: {
      activationId: cast.id,
      type: 'combo_finisher',
      at: cast.start,
      effectAt: cast.start,
      source: 'mesmer',
      sourceId: ID.ABSTRACTION,
      skillId: ID.ABSTRACTION,
      skillName: 'Abstraction',
      actorType: ACTOR.PLAYER,
      attemptId: `${cast.id}:abstraction`,
      finisherType: COMBO_FINISHER.BLAST,
      fieldId: field.fieldId,
      // Abstraction consumes this exact field at the shared detonation timestamp.
      allowFieldAtExpiry: true,
      chance: 1,
      applications: 1,
      successfulCombos: 1
    }
  });
}

/** Only the matching live image emits its boon profile, attributed to the original cast. */
export function expireInspiringImagery(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  if (!context.expireFlip(ID.ABSTRACTION, cast.id)) return;

  context.effects.emit({
    kind: 'profile',
    profile: cast.skill,
    at: context.time,
    cast: { activationId: cast.id, skillId: cast.skill.id },
    attribution: {
      activationId: cast.id,
      source: 'mesmer',
      sourceId: cast.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name
    },
    // Expiry owns delivery time; the skill's cast-relative delay has already elapsed.
    effects: (cast.skill.effects ?? [])
      .filter((effect): effect is StatusEffect => effect.type === 'boon')
      .map<StatusEffect>((effect) => ({
        type: 'boon',
        boon: effect.boon,
        stacks: effect.stacks ?? 1,
        duration: effect.duration,
        audience: effect.audience
      }))
  });
}
