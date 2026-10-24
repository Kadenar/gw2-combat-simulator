import { ACTOR, RECIPIENT, STATUS } from '#gw2/platform/constants.js';

/** Fixtures submit real accepted packets so they cannot bypass the common stealth admission or trait reactions. */
export function emitStealth(runtime, skill, duration, fields = {}) {
  runtime.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: {
      type: 'buff',
      kind: STATUS.STEALTH,
      at: runtime.time,
      duration,
      stacks: 1,
      source: 'fixture',
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      actorType: ACTOR.PLAYER,
      audience: { recipients: RECIPIENT.SELF },
      fixedDuration: true,
      ...fields
    }
  });
}
