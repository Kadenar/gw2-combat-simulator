import {
  conditionStackLimit,
  permanentTargetConditionStacks,
  canonicalTargetConditionName
} from '#gw2/platform/combat/state/targets.js';
import {
  GW2_STANDARD_BOONS,
  standardBoonPresentation,
  isStandardBoon,
  buffMatchesAudience,
  type Gw2TimedBuffApplication
} from '#gw2/platform/combat/boons.js';
import { observeBuffState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';

interface BuffObservation {
  readonly applications: readonly Gw2TimedBuffApplication[];
  readonly maximumStacks: number | undefined;
  readonly maximumDuration: number | undefined;
  readonly at: number;
  readonly until: number;
  readonly states: readonly EffectState[];
}

// Cache only generic immutable grant histories, scoped to their runtime; native charge pools are always observed.
const buffObservations = new WeakMap<object, Map<string, BuffObservation>>();

/** Reuse accepted windows until a grant, replacement, policy change, or time boundary changes their meaning. */
function observeGenericBuff(
  cache: Map<string, BuffObservation>,
  kind: string,
  applications: readonly Gw2TimedBuffApplication[],
  at: number,
  policy: BuffStatePolicy
): readonly EffectState[] {
  const previous = cache.get(kind);
  if (
    previous &&
    at >= previous.at &&
    at < previous.until &&
    previous.maximumStacks === policy.maximumStacks &&
    previous.maximumDuration === policy.maximumDuration &&
    previous.applications.length === applications.length &&
    applications.every((application, index) => application === previous.applications[index])
  )
    return previous.states;

  const states = [observeBuffState(kind, applications, at, policy)];
  let allies = 0;
  let wildcard = false;
  let until = Infinity;
  const companions = new Set<string>();
  for (const application of applications) {
    const audience = application.resolvedAudience;
    allies = Math.max(allies, audience.alliedPlayerCount, audience.alliedPlayerIndex ?? 0);
    for (const id of audience.companionIds) companions.add(id);
    if (audience.includesSummons && !audience.companionIds.length) wildcard = true;
    if (application.at > at) until = Math.min(until, application.at);
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
        buffMatchesAudience(application, 'summon', id)
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
  for (const state of states)
    for (const window of state.windows)
      if (window.expiresAt != null && window.expiresAt > at) until = Math.min(until, window.expiresAt);
  cache.set(kind, {
    applications: [...applications],
    maximumStacks: policy.maximumStacks,
    maximumDuration: policy.maximumDuration,
    at,
    until,
    states
  });
  return states;
}

/** Read existing combat stores at accepted boundaries; profession observations replace only their own generic tracks. */
export function observeRuntimeEffects<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>
): EffectState[] {
  const policies = new Map<string, BuffStatePolicy>(
    GW2_STANDARD_BOONS.map((kind) => [kind, { kind, maximumStacks: standardBoonPresentation(kind)?.maximumStacks }])
  );
  for (const kind of ['sigil-severance', 'target-crippled', 'time-bomb', 'stealth', 'superspeed'])
    policies.set(kind, { kind, maximumStacks: 1 });
  const nativeKinds = new Set<string>();
  for (const policy of profession.buffPolicies?.(runtime) ?? []) {
    if (nativeKinds.has(policy.kind)) throw new TypeError(`Duplicate profession buff policy: ${policy.kind}`);
    nativeKinds.add(policy.kind);
    if (isStandardBoon(policy.kind))
      throw new TypeError(`Profession cannot replace a standard boon policy: ${policy.kind}`);
    policies.set(policy.kind, policy);
  }

  const owned = (profession.observeEffects?.(runtime) ?? []).map((state) => ({
    ...state,
    source:
      state.source ??
      runtime.boons
        .get(state.kind)
        ?.filter((application) => application.at <= runtime.time)
        .at(-1)?.event
  }));
  // Recipient membership uses existing strings rather than allocating a composite key for every observed track.
  const ownedRecipients = new Map<string, Set<string>>();
  for (const state of owned) {
    let recipients = ownedRecipients.get(state.kind);
    if (!recipients) {
      recipients = new Set();
      ownedRecipients.set(state.kind, recipients);
    }

    recipients.add(state.recipient);
  }

  const result: EffectState[] = [...owned];
  let cache = buffObservations.get(runtime);
  if (!cache) {
    cache = new Map();
    buffObservations.set(runtime, cache);
  }

  for (const [kind, applications] of runtime.boons) {
    // Registration makes new reportable effects declare their owner instead of silently bypassing caps.
    const policy = policies.get(kind);
    if (!policy) throw new TypeError(`Missing buff policy: ${kind}`);
    if (policy.owner === 'profession') continue;
    for (const state of observeGenericBuff(cache, kind, applications, runtime.time, policy))
      if (!ownedRecipients.get(kind)?.has(state.recipient)) result.push(state);
  }

  for (const [kind, state] of runtime.conditionState)
    result.push({
      kind,
      category: 'condition',
      recipient: 'target',
      origin: 'simulated',
      countLimit: conditionStackLimit(kind),
      durationLimit: null,
      measure: 'count',
      windows: state.stacks
        .filter((stack) => stack.appliedAt <= runtime.time && stack.expiresAt > runtime.time)
        .map((stack) => ({ stacks: stack.weight, expiresAt: stack.expiresAt }))
    });
  for (const [kind, value] of Object.entries(runtime.config.boons ?? {})) {
    if (!value || !isStandardBoon(kind)) continue;
    result.push({
      kind,
      category: 'boon',
      recipient: 'self',
      origin: 'assumption',
      countLimit: standardBoonPresentation(kind)?.maximumStacks ?? 1,
      durationLimit: null,
      measure: 'count',
      windows: [{ stacks: value === true ? 1 : value, expiresAt: null }]
    });
  }

  for (const kind of new Set(Object.keys(runtime.config.target?.conditions ?? {}).map(canonicalTargetConditionName))) {
    const stacks = permanentTargetConditionStacks(runtime.config, kind);
    if (stacks > 0)
      result.push({
        kind,
        category: 'condition',
        recipient: 'target',
        origin: 'assumption',
        countLimit: conditionStackLimit(kind),
        durationLimit: null,
        measure: 'count',
        windows: [{ stacks, expiresAt: null }]
      });
  }

  return result;
}
