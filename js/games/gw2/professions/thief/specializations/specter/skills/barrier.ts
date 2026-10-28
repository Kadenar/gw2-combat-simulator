import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Emit the selected barrier; shared delivery resolves recipients before Dark Sentry can react. */
export function grantBarrier(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>, name: string): void {
  const profile = cast.skill;
  const barrier = requireEffect(profile, 'buff', 'barrier', requireSkillAction(profile, 'barrier'));

  if (!barrier) return;

  runtime.effects.emit({
    kind: 'profile',
    profile,
    effects: [
      {
        ...barrier,
        audience: barrier.audience
      }
    ],
    at: runtime.time,
    attribution: {
      source: 'thief',
      sourceId: cast.skill.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      actorType: ACTOR.PLAYER
    },
    transform: (event) => ({ ...event, name, fixedDuration: true })
  });
}
