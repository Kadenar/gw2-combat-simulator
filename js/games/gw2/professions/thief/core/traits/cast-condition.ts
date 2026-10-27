import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Attribute a trait's named condition to its accepted cast; the emitter respects patched payload removal. */
export function thiefCastCondition(trait: SkillId, condition: string, name: string) {
  return (runtime: ThiefRuntime, { cast }: { readonly cast: RuntimeCast<ThiefSkill> }): void => {
    emitTraitProfile(runtime, trait, trait, undefined, {
      at: runtime.time,
      fullEnd: runtime.time,
      effect: { type: 'condition', name: condition },
      activationId: cast.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      attribution: { name, actorType: ACTOR.PLAYER }
    });
  };
}
