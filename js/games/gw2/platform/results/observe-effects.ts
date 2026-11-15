import { GW2_STANDARD_BOONS, isStandardBoon, standardBoonPresentation } from '#gw2/platform/combat/boons.js';
import { effectStateRevision, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import {
  canonicalTargetConditionName,
  conditionApplicationExpiry,
  conditionStackLimit,
  permanentTargetConditionStacks
} from '#gw2/platform/combat/state/targets.js';
import { RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { Gw2ResolverConditionState } from '#gw2/platform/resolver/condition-resolution.js';
import type { EffectReportObserver } from '#gw2/platform/results/effect-report.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';

type EffectObservationScope = 'all' | 'player-buffs';

const retirementObservations = new WeakMap<
  object,
  { count: number; states: WeakMap<readonly EffectState[], readonly EffectState[]> }
>();

// Shared policies are fixed; only owner contributions need rebuilding as live profession tuning changes.
const sharedPolicies: ReadonlyMap<string, BuffStatePolicy> = new Map([
  ...GW2_STANDARD_BOONS.map((kind): [string, BuffStatePolicy] => [
    kind,
    { kind, maximumStacks: standardBoonPresentation(kind)?.maximumStacks }
  ]),
  ...[STATUS.STEALTH, STATUS.SUPERSPEED].map((kind): [string, BuffStatePolicy] => [kind, { kind, maximumStacks: 1 }])
]);

/** Select observation work before projecting tracks; native owners still replace only their own generic recipients. */
function visitRuntimeEffects<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>,
  visitor: (scope: string, states: readonly EffectState[]) => void,
  scope: EffectObservationScope = 'all'
): void {
  const playerOnly = scope === 'player-buffs';
  // Reuse clipped scopes until another entity retires, preserving unchanged report capture identity.
  let retirement = playerOnly ? undefined : retirementObservations.get(runtime);

  if (
    !playerOnly &&
    runtime.liveEffects.queries.retirementCount &&
    retirement?.count !== runtime.liveEffects.queries.retirementCount
  ) {
    retirement = { count: runtime.liveEffects.queries.retirementCount, states: new WeakMap() };
    retirementObservations.set(runtime, retirement);
  }

  const visit = (scope: string, states: readonly EffectState[]): void => {
    if (!retirement) return visitor(scope, states);

    let clipped = retirement.states.get(states);

    if (!clipped) {
      clipped = states.map((state) => {
        const removedAt = state.recipient.startsWith('companion:')
          ? runtime.liveEffects.queries.companionRetiredAt(state.recipient.slice('companion:'.length))
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

  const policies = new Map<string, BuffStatePolicy>();
  // Owners contribute live policies; dynamic profession caps continue following the selected balance profile.
  const owners = new Map<string, string>();
  for (const { owner, contributions } of [
    { owner: 'profession', contributions: profession.buffPolicies?.(runtime.mechanicQueries) ?? [] },
    { owner: 'equipment', contributions: runtime.equipmentBuffPolicies }
  ]) {
    for (const policy of contributions) {
      const previous = sharedPolicies.has(policy.kind) ? 'shared' : owners.get(policy.kind);

      if (previous)
        throw new TypeError(`Duplicate ${owner} buff policy: ${policy.kind} (already owned by ${previous}).`);

      owners.set(policy.kind, owner);
      policies.set(policy.kind, policy);
    }
  }

  // Retain native kind order and ownership without projecting sources for recipients outside the requested scope.
  const owned = (profession.observeEffects?.(runtime.mechanicQueries) ?? []).map((state) => {
    if (playerOnly && (state.recipient !== RECIPIENT.SELF || state.category !== 'buff')) return state;

    if (state.source != null) return { ...state };

    // Native effects need only the latest source, not a snapshot of every prior application.
    return { ...state, source: runtime.liveEffects.queries.latestApplication(state.kind, runtime.time)?.event };
  });
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

    if (!playerOnly || state.recipient === RECIPIENT.SELF) scope.push(state);

    nativeScopes.set(state.kind, scope);
  }

  // Both stores share policy enforcement and recipient-specific native overrides.
  for (const store of playerOnly
    ? [runtime.liveEffects.queries.effectKinds('buff')]
    : [runtime.liveEffects.queries.effectKinds('boon'), runtime.liveEffects.queries.effectKinds('buff')])
    for (const kind of store) {
      // Registration makes new reportable effects declare their owner instead of silently bypassing caps.
      const policy = policies.get(kind) ?? sharedPolicies.get(kind);

      if (!policy) throw new TypeError(`Missing buff policy: ${kind}`);

      if (policy.owner === 'profession') continue;

      if (playerOnly && ownedRecipients.get(kind)?.has(RECIPIENT.SELF)) continue;

      const generic = runtime.liveEffects.queries.effectStates(kind, runtime.time, policy, playerOnly);
      const native = nativeScopes.get(kind);

      if (native) {
        for (const state of generic) if (!ownedRecipients.get(kind)?.has(state.recipient)) native.push(state);
      } else visit(`buff:${kind}`, generic);
    }

  for (const [kind, states] of nativeScopes) visit(`buff:${kind}`, states);

  if (playerOnly) return;

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
  // Observe the canonical lifetime; presentation clipping must never shorten a live condition.
  for (const application of state.stacks) {
    const expiresAt = conditionApplicationExpiry(application);

    if (application.at > at) until = Math.min(until, application.at);
    else if (expiresAt > at) {
      windows.push({ stacks: application.stacks, expiresAt });
      until = Math.min(until, expiresAt);
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
      recipient: RECIPIENT.SELF,
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

/** Planning reads remain complete; hit diagnostics request only player buffs and omit configured assumptions. */
export function observeRuntimeEffects<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>,
  scope: EffectObservationScope = 'all'
): EffectState[] {
  const result: EffectState[] = [];
  visitRuntimeEffects(
    runtime,
    profession,
    (_scope, states) => {
      for (const state of states) if (scope === 'all' || state.category === 'buff') result.push(state);
    },
    scope
  );

  if (scope === 'all') result.push(...observeAssumptions(runtime));

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
