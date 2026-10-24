import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Emit the selected barrier; shared delivery resolves recipients before Dark Sentry can react. */
export function grantBarrier(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  profileId: string | number,
  name: string
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const barrier = requireEffect(profile, 'buff', 'barrier');

  if (!barrier) return;

  runtime.effects.emit({
    kind: 'profile',
    profile,
    effects: [
      {
        ...barrier,
        audience: barrier.audience ?? {
          recipients: RECIPIENT.PARTY,
          affectsSelf: cast.skill.id === ID.DAWNS_REPOSE,
          maximumRecipients: balanceProfileNumber(profile, 'maximumTargets'),
          eligibleCompanionIds: []
        }
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
