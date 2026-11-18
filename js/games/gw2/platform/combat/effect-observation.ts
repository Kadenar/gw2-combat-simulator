/** Projects accepted private grant histories into recipient states, reusing observations until their next boundary. */
import { buffMatchesAudience, type Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import { buffApplicationExpiry } from '#gw2/platform/combat/buff-expiry.js';
import { observeBuffState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import { RECIPIENT } from '#gw2/platform/constants.js';

export interface BuffObservation {
  readonly applications: readonly Gw2TimedBuffApplication[];
  readonly length: number;
  readonly name: string | undefined;
  readonly maximumStacks: number | undefined;
  readonly maximumDuration: number | undefined;
  readonly at: number;
  readonly until: number;
  readonly selfStates: readonly EffectState[];
  readonly states: readonly EffectState[] | undefined;
}

/** Reuse accepted windows until a grant, replacement, policy change, or time boundary changes their meaning. */
export function observeGenericBuff(
  cache: Map<string, BuffObservation>,
  kind: string,
  applications: readonly Gw2TimedBuffApplication[],
  at: number,
  policy: BuffStatePolicy,
  playerOnly: boolean
): readonly EffectState[] {
  const previous = cache.get(kind);

  const reusable =
    previous &&
    at >= previous.at &&
    (at === previous.at || at < previous.until) &&
    previous.name === policy.name &&
    previous.maximumStacks === policy.maximumStacks &&
    previous.maximumDuration === policy.maximumDuration &&
    previous.applications === applications &&
    previous.length === applications.length;

  if (reusable && (playerOnly || previous.states)) return playerOnly ? previous.selfStates : previous.states!;

  // A diagnostic read can seed the self observation; a later report expands it without rebuilding player windows.
  const selfStates = reusable ? previous.selfStates : [observeBuffState(kind, applications, at, policy)];
  const states = [...selfStates];
  let allies = 0;
  let wildcard = false;
  let until = Infinity;
  const companions = new Set<string>();
  for (const application of applications) {
    if (application.at > at) until = Math.min(until, application.at);

    if (playerOnly) continue;

    const audience = application.resolvedAudience;
    allies = Math.max(allies, audience.alliedPlayerCount, audience.alliedPlayerIndex ?? 0);
    for (const id of audience.companionIds) companions.add(id);

    if (audience.includesSummons && !audience.companionIds.length) wildcard = true;
  }

  for (let index = 1; index <= allies; index++)
    states.push(
      observeBuffState(kind, applications, at, policy, `ally:${index}`, (application) =>
        application.resolvedAudience.alliedPlayerIndex != null
          ? application.resolvedAudience.alliedPlayerIndex === index
          : application.resolvedAudience.alliedPlayerCount >= index
      )
    );
  for (const id of companions)
    states.push(
      observeBuffState(kind, applications, at, policy, `companion:${id}`, (application) =>
        buffMatchesAudience(application, RECIPIENT.SUMMONS, id)
      )
    );

  if (wildcard)
    states.push(
      observeBuffState(
        kind,
        applications,
        at,
        policy,
        'companions:*',
        (application) =>
          application.resolvedAudience.includesSummons && !application.resolvedAudience.companionIds.length
      )
    );

  // Duration pools can outlive individual grants; invalidate at the resolved deadline, not the grant's expiry.
  // A removed window invalidates at its removal rather than its natural deadline.
  for (const state of states)
    for (const window of state.windows) {
      const end = buffApplicationExpiry(window);

      if (end >= at) until = Math.min(until, end);
    }

  cache.set(kind, {
    applications,
    length: applications.length,
    name: policy.name,
    maximumStacks: policy.maximumStacks,
    maximumDuration: policy.maximumDuration,
    at,
    until,
    selfStates,
    states: playerOnly ? undefined : states
  });
  return playerOnly ? selfStates : states;
}
