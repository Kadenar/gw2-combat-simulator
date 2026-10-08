import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { DARK_SENTRY } from '#gw2/professions/thief/specializations/specter/traits/behavior.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Dawn's Repose includes the caster; only allied recipients can trigger Dark Sentry. */
export function grantBarrier(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  profileId: string | number,
  name: string
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const barrier = requireEffect(profile, 'buff', 'barrier');
  const affectsSelf = cast.skill.id === ID.DAWNS_REPOSE;
  const recipients = Math.min(
    balanceProfileNumber(profile, 'maximumTargets'),
    gw2AlliedPlayerAssumptions(runtime.config).count + Number(affectsSelf)
  );
  // Barrier removal also suppresses the barrier-triggered Dark Sentry reaction.
  if (!barrier || recipients <= 0) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefBuff(null, {
      at: runtime.time,
      source: 'thief',
      sourceId: cast.skill.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name,
      kind: 'barrier',
      duration: effectNumber(profile, barrier, 'duration'),
      stacks: effectNumber(profile, barrier, 'stacks'),
      audience: { recipients: 'party', affectsSelf, maximumRecipients: recipients },
      fixedDuration: true
    })
  });
  runtime.schedule(DARK_SENTRY, runtime.time, {
    allyIndices: Array.from({ length: recipients - Number(affectsSelf) }, (_, index) => index + 1)
  });
}
