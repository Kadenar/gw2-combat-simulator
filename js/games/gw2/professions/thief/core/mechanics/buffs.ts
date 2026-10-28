import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

/** These ordinary windows replace their previous grant; recharge, stealth and consumed charges keep their owners. */
export function replaceThiefBuff(
  runtime: ThiefRuntime,
  kind: string,
  duration: number,
  sourceId: SkillId,
  name: string,
  source: 'Trait' | 'thief'
): void {
  runtime.combat.reviseBuffExpiry(
    kind,
    (application) => application.at <= runtime.time && application.expiresAt > runtime.time,
    () => runtime.time
  );
  runtime.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: {
      type: 'buff',
      kind,
      at: runtime.time,
      duration,
      stacks: 1,
      source,
      sourceId,
      actorType: ACTOR.PLAYER,
      skillId: sourceId,
      name,
      skillName: name,
      audience: { recipients: RECIPIENT.SELF }
    }
  });
}
