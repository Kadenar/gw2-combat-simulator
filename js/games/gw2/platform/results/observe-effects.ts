import {
  conditionStackLimit,
  permanentTargetConditionStacks,
  canonicalTargetConditionName
} from '#gw2/platform/combat/state/targets.js';
import {
  GW2_STANDARD_BOONS,
  standardBoonPresentation,
  isStandardBoon,
  buffMatchesAudience
} from '#gw2/platform/combat/boons.js';
import { observeBuffState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';

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
  const ownedKeys = new Set(owned.map((state) => state.kind + ':' + state.recipient));
  const result: EffectState[] = [...owned];
  for (const [kind, applications] of runtime.boons) {
    // Registration makes new reportable effects declare their owner instead of silently bypassing caps.
    const policy = policies.get(kind);
    if (!policy) throw new TypeError(`Missing buff policy: ${kind}`);
    if (policy.owner === 'profession') continue;
    if (!ownedKeys.has(kind + ':self')) result.push(observeBuffState(kind, applications, runtime.time, policy));
    const allies = Math.max(
      0,
      ...applications.map((application) =>
        Math.max(application.resolvedAudience.alliedPlayerCount, application.resolvedAudience.alliedPlayerIndex ?? 0)
      )
    );
    for (let index = 1; index <= allies; index++)
      if (!ownedKeys.has(kind + ':ally:' + index))
        result.push(
          observeBuffState(kind, applications, runtime.time, policy, `ally:${index}`, (application) =>
            application.resolvedAudience.alliedPlayerIndex != null
              ? application.resolvedAudience.alliedPlayerIndex === index
              : application.resolvedAudience.alliedPlayerCount >= index
          )
        );
    for (const id of new Set(applications.flatMap((application) => application.resolvedAudience.companionIds)))
      if (!ownedKeys.has(kind + ':companion:' + id))
        result.push(
          observeBuffState(kind, applications, runtime.time, policy, `companion:${id}`, (application) =>
            buffMatchesAudience(application, 'summon', id)
          )
        );
    // Wildcard summon grants retain their scope without inventing named companion identities.
    if (
      applications.some(
        (application) =>
          application.resolvedAudience.includesSummons && !application.resolvedAudience.companionIds.length
      )
    )
      result.push(
        observeBuffState(
          kind,
          applications,
          runtime.time,
          policy,
          'companions:*',
          (application) =>
            application.resolvedAudience.includesSummons && !application.resolvedAudience.companionIds.length
        )
      );
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
