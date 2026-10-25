import { ACTOR } from '#gw2/platform/constants.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { balanceProfileNumber, effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';

import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { fervorProfile } from '#gw2/professions/revenant/specializations/renegade/traits/fervor.js';

/** Counts started, unexpired Fervor applications consistently for grants, modifiers, and siphons. */
export function activeKallasFervorStacks(
  state: {
    readonly kallasFervor?: readonly Readonly<RenegadeState['kallasFervor'][number]>[];
  },
  at: number,
  maximumStacks: number
): number {
  // Count in place so hit-time queries and repeated grants do not allocate temporary stack arrays.
  let count = 0;
  for (const application of state.kallasFervor || [])
    if ((application.at || 0) <= at && (application.expiresAt || 0) > at) count++;

  return Math.min(Math.max(1, maximumStacks), count);
}

/** Eligible summons consume the shared timed buff; natural expiry uses the same combat query. */
export function bandTogetherReady(runtime: MechanicQueriesOf<RevenantRuntime>, skillId: SkillId): boolean {
  return (
    RENEGADE_ENHANCED_SKILL_BY_ID[Number(skillId)] != null &&
    runtime.combat.activeBuffStacks('band-together', runtime.time, 1) > 0
  );
}

/** Grants the selected Fervor count, replacing the soonest-expiring stacks at the cap so hits sustain Fervor. */
export function grantKallasFervor(
  runtime: RevenantRuntime,
  { sourceId, sourceName, cause = null }: { sourceId: SkillId; sourceName: string; cause?: Gw2ResolverEvent | null }
): void {
  const state = renegadeState.from(runtime);
  const profile = fervorProfile(runtime);
  const effect = requireEffect(profile, 'buff', 'kallas-fervor');

  // Fervor stacks are the buff, so a removed buff grants nothing.
  if (!effect) return;

  const maximum = Math.max(1, balanceProfileNumber(profile, 'maximumStacks'));
  state.kallasFervor = state.kallasFervor.filter((application) => application.expiresAt > runtime.time);
  const duration = Math.max(0, effectNumber(profile, effect, 'duration'));
  const stacks = Math.max(0, Math.floor(effectNumber(profile, effect, 'stacks')));
  for (let index = 0; index < stacks; index++) {
    if (activeKallasFervorStacks(state, runtime.time, maximum) >= maximum)
      state.kallasFervor.sort((left, right) => left.expiresAt - right.expiresAt).shift();

    state.kallasFervor.push({ at: runtime.time, expiresAt: runtime.time + duration });
  }

  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...{
        type: 'buff',
        at: runtime.time,
        source: 'revenant',
        sourceId,
        actorType: effect.actorType || ACTOR.PLAYER,
        skillId: sourceId,
        skillName: sourceName,
        name: `${sourceName} — Kalla's Fervor`,
        kind: String(effect.kind),
        duration,
        stacks
      },
      fixedDuration: true
    },
    cause
  });
}
