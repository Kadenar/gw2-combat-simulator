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
import { effectStateRevision } from '#gw2/platform/combat/effect-revisions.js';
import type { Gw2ResolverConditionState } from '#gw2/platform/resolver/condition-resolution.js';
import type { EffectReportObserver } from '#gw2/platform/results/effect-report.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';

interface BuffObservation {
  readonly applications: readonly Gw2TimedBuffApplication[];
  readonly name: string | undefined;
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
    previous.name === policy.name &&
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
    name: policy.name,
    maximumStacks: policy.maximumStacks,
    maximumDuration: policy.maximumDuration,
    at,
    until,
    states
  });
  return states;
}

const retirementObservations = new WeakMap<
  object,
  { count: number; states: WeakMap<readonly EffectState[], readonly EffectState[]> }
>();

/** Visit complete kind scopes; native observations replace only their own generic recipients. */
function visitRuntimeEffects<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>,
  visitor: (scope: string, states: readonly EffectState[]) => void
): void {
  // Reuse clipped scopes until another entity retires, preserving unchanged report capture identity.
  let retirement = retirementObservations.get(runtime);
  if (runtime.retiredCompanions.size && retirement?.count !== runtime.retiredCompanions.size) {
    retirement = { count: runtime.retiredCompanions.size, states: new WeakMap() };
    retirementObservations.set(runtime, retirement);
  }

  const visit = (scope: string, states: readonly EffectState[]): void => {
    if (!retirement) return visitor(scope, states);
    let clipped = retirement.states.get(states);
    if (!clipped) {
      clipped = states.map((state) => {
        const removedAt = state.recipient.startsWith('companion:')
          ? runtime.retiredCompanions.get(state.recipient.slice('companion:'.length))
          : undefined;
        return removedAt == null
          ? state
          : {
              ...state,
              windows: state.windows.map((window) => ({
                ...window,
                expiresAt: Math.min(window.expiresAt ?? Infinity, removedAt)
              }))
            };
      });
      retirement.states.set(states, clipped);
    }

    visitor(scope, clipped);
  };

  const policies = new Map<string, BuffStatePolicy>(
    GW2_STANDARD_BOONS.map((kind) => [kind, { kind, maximumStacks: standardBoonPresentation(kind)?.maximumStacks }])
  );
  for (const kind of ['stealth', 'superspeed']) policies.set(kind, { kind, maximumStacks: 1 });
  // Owners contribute live policies; dynamic profession caps continue following the selected balance profile.
  const owners = new Map([...policies.keys()].map((kind) => [kind, 'shared']));
  for (const { owner, contributions } of [
    { owner: 'profession', contributions: profession.buffPolicies?.(runtime.mechanicQueries) ?? [] },
    { owner: 'equipment', contributions: runtime.equipmentBuffPolicies }
  ]) {
    for (const policy of contributions) {
      const previous = owners.get(policy.kind);
      if (previous)
        throw new TypeError(`Duplicate ${owner} buff policy: ${policy.kind} (already owned by ${previous}).`);
      owners.set(policy.kind, owner);
      policies.set(policy.kind, policy);
    }
  }

  const owned = (profession.observeEffects?.(runtime.mechanicQueries) ?? []).map((state) => ({
    ...state,
    source:
      state.source ??
      (isStandardBoon(state.kind) ? runtime.boons : runtime.buffs)
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

  const nativeScopes = new Map<string, EffectState[]>();
  for (const state of owned) {
    const scope = nativeScopes.get(state.kind) ?? [];
    scope.push(state);
    nativeScopes.set(state.kind, scope);
  }

  let cache = buffObservations.get(runtime);
  if (!cache) {
    cache = new Map();
    buffObservations.set(runtime, cache);
  }

  // Both stores share policy enforcement and recipient-specific native overrides.
  for (const store of [runtime.boons, runtime.buffs])
    for (const [kind, applications] of store) {
      // Registration makes new reportable effects declare their owner instead of silently bypassing caps.
      const policy = policies.get(kind);
      if (!policy) throw new TypeError(`Missing buff policy: ${kind}`);
      if (policy.owner === 'profession') continue;
      const generic = observeGenericBuff(cache, kind, applications, runtime.time, policy);
      const native = nativeScopes.get(kind);
      if (native) {
        for (const state of generic) if (!ownedRecipients.get(kind)?.has(state.recipient)) native.push(state);
      } else visit(`buff:${kind}`, generic);
    }

  for (const [kind, states] of nativeScopes) visit(`buff:${kind}`, states);
  for (const [kind, state] of runtime.conditionState)
    visit(`condition:${kind}`, observeCondition(kind, state, runtime.time));
}

interface ConditionObservation {
  readonly revision: number;
  readonly at: number;
  readonly until: number;
  readonly states: readonly EffectState[];
}
const conditionObservations = new WeakMap<object, ConditionObservation>();

/** Retain accepted windows until a mutation or visibility boundary; damage ticks do not alter their lifetimes. */
function observeCondition(kind: string, state: Gw2ResolverConditionState, at: number): readonly EffectState[] {
  const previous = conditionObservations.get(state);
  const revision = effectStateRevision(state);
  if (previous && previous.revision === revision && at >= previous.at && at < previous.until) return previous.states;
  const windows: Array<{ stacks: number; expiresAt: number }> = [];
  let until = Infinity;
  for (const stack of state.stacks) {
    if (stack.appliedAt > at) until = Math.min(until, stack.appliedAt);
    else if (stack.expiresAt > at) {
      windows.push({ stacks: stack.weight, expiresAt: stack.expiresAt });
      until = Math.min(until, stack.expiresAt);
    }
  }

  const states: EffectState[] = [
    {
      kind,
      category: 'condition',
      recipient: 'target',
      origin: 'simulated',
      countLimit: conditionStackLimit(kind),
      durationLimit: null,
      measure: 'count',
      windows
    }
  ];
  conditionObservations.set(state, { revision, at, until, states });
  return states;
}

/** Configuration assumptions have their own origin and never replace self-generated boon history. */
function observeAssumptions(runtime: Gw2Runtime): EffectState[] {
  const result: EffectState[] = [];
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

/** Planning reads remain complete and independent of which scopes combat reporting last submitted. */
export function observeRuntimeEffects<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>
): EffectState[] {
  const result: EffectState[] = [];
  visitRuntimeEffects(runtime, profession, (_scope, states) => result.push(...states));
  result.push(...observeAssumptions(runtime));
  return result;
}

interface RuntimeCapture {
  readonly recorder: EffectReportObserver;
  readonly scopes: Map<string, readonly EffectState[]>;
}
const runtimeCaptures = new WeakMap<object, RuntimeCapture>();

/** Submit only changed complete scopes, while assumptions are recorded once and native owners remain live. */
export function captureRuntimeEffects<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>
): void {
  const recorder = runtime.effectRecorder;
  if (!recorder) return;
  let capture = runtimeCaptures.get(runtime);
  const initial = !capture || capture.recorder !== recorder;
  if (initial) {
    capture = { recorder, scopes: new Map() };
    runtimeCaptures.set(runtime, capture);
  }

  const scopes = capture!.scopes;
  const seen = new Set<string>();
  visitRuntimeEffects(runtime, profession, (scope, states) => {
    seen.add(scope);
    if (scopes.get(scope) === states) return;
    recorder.capture(runtime.time, states, scope);
    scopes.set(scope, states);
  });
  // Omission clears only the disappeared scope; unchanged scopes retain their accepted deadlines.
  for (const scope of scopes.keys()) {
    if (seen.has(scope)) continue;
    recorder.capture(runtime.time, [], scope);
    scopes.delete(scope);
  }

  if (initial) recorder.capture(runtime.time, observeAssumptions(runtime), 'assumptions');
}
