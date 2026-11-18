import { buffWindowActive } from '#gw2/platform/combat/buff-expiry.js';
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
  runtime.combat.endBuffs(
    kind,
    runtime.time,
    (application) =>
      application.at <= runtime.time &&
      buffWindowActive(runtime.time, application.at, application.expiresAt, application.removedAt)
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
