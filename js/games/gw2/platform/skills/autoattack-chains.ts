/**
 * GW2-wide runtime ownership for autoattack-chain availability and state.
 * Native professions only declare narrow interruption overrides and optional
 * transition observers; this controller performs every live map mutation.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { effectFirstAt } from '#gw2/platform/engine/effects/materializer.js';
import { CAST_READY, denyCast } from '#gw2/platform/engine/skills/availability.js';
import { resolveAutoattackChainStep } from '#gw2/platform/engine/skills/autoattack-chains.js';
import type { AvailabilityResult, CastContext, CastLifecycleContext } from '#gw2/platform/engine/execution/types.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

interface AutoattackChainCoreState {
  readonly autoattackChains?: Record<string, SkillId>;
}

export interface AutoattackChainContext {
  readonly cast: CastLifecycleContext;
  readonly chainRootId: SkillId;
  readonly expectedSkillId: SkillId;
  readonly interruptingSkill: Skill;
  readonly interruptingChainRootId: SkillId | null;
}

export interface AutoattackChainOverride {
  readonly id: string;
  readonly chainRootIds?: readonly SkillId[];
  readonly interruptingSkillIds?: readonly SkillId[];
  readonly when?: (context: AutoattackChainContext) => boolean;
  readonly decision: 'preserve' | 'reset';
}

export interface AutoattackChainTransition {
  readonly chainRootId: SkillId;
  readonly previousSkillId: SkillId;
  readonly nextSkillId: SkillId | null;
  readonly decision: 'advance' | 'complete' | 'preserve' | 'reset';
  readonly overrideId: string | null;
}

export interface AutoattackChainTransitionResult {
  readonly committed: boolean;
  readonly castChainRootId: SkillId | null;
  readonly transitions: readonly AutoattackChainTransition[];
}

export interface AutoattackChainTransitionContext {
  readonly cast: CastLifecycleContext;
  readonly skill: Skill;
  readonly result: AutoattackChainTransitionResult;
}

export interface Gw2AutoattackChainOptions {
  readonly overrides?: readonly AutoattackChainOverride[];
  readonly onTransition?: (context: AutoattackChainTransitionContext) => void;
}

interface AutoattackChainHook {
  readonly phase: 'scheduler';
  readonly hook: 'availability' | 'afterCast';
  readonly id: string;
  readonly order: number;
  readonly handler: (...args: never[]) => unknown;
}

export interface Gw2AutoattackChainMechanics {
  readonly availability: AutoattackChainHook;
  readonly castLifecycle: AutoattackChainHook;
}

function chainState(context: object): Record<string, SkillId> | null {
  const core = professionCoreState(context) as AutoattackChainCoreState | undefined;
  const chains = core?.autoattackChains;
  return chains && typeof chains === 'object' && !Array.isArray(chains) ? chains : null;
}

/** Clears all pending roots, or only the supplied roots, without replacing the shared state object. */
export function resetAutoattackChains(context: object, chainRootIds?: readonly SkillId[]): readonly SkillId[] {
  const chains = chainState(context);
  if (!chains) return Object.freeze([]);
  const roots = chainRootIds == null ? Object.keys(chains).map(Number) : [...new Set(chainRootIds.map(Number))];
  const reset: SkillId[] = [];
  for (const root of roots) {
    if (!Object.hasOwn(chains, root)) continue;
    delete chains[root];
    reset.push(root);
  }

  return Object.freeze(reset);
}

/** Restores a captured chain snapshot through the same mutation boundary used by live transitions. */
export function replaceAutoattackChains(context: object, replacement: Readonly<Record<string, SkillId>>): void {
  const chains = chainState(context);
  if (!chains) return;
  resetAutoattackChains(context);
  for (const [root, expected] of Object.entries(replacement)) {
    const rootId = Number(root);
    const expectedSkillId = Number(expected);
    if (Number.isFinite(rootId) && Number.isFinite(expectedSkillId)) {
      chains[rootId] = expectedSkillId;
    }
  }
}

function matchingOverride(
  overrides: readonly AutoattackChainOverride[],
  context: AutoattackChainContext
): AutoattackChainOverride | null {
  for (const override of overrides) {
    if (override.chainRootIds && !override.chainRootIds.map(Number).includes(Number(context.chainRootId))) continue;
    if (
      override.interruptingSkillIds &&
      !override.interruptingSkillIds.map(Number).includes(Number(context.interruptingSkill.id))
    )
      continue;
    if (override.when && !override.when(context)) continue;
    return override;
  }

  return null;
}

function validateOptions(options: Gw2AutoattackChainOptions): void {
  const ids = new Set<string>();
  for (const override of options.overrides || []) {
    const id = String(override.id || '').trim();
    if (!id) throw new TypeError('Autoattack-chain override id is required.');
    if (ids.has(id)) throw new TypeError(`Duplicate autoattack-chain override id: ${id}.`);
    if (override.decision !== 'preserve' && override.decision !== 'reset') {
      throw new TypeError(`${id} must decide "preserve" or "reset".`);
    }

    if (override.when != null && typeof override.when !== 'function') {
      throw new TypeError(`${id}.when must be a function.`);
    }

    ids.add(id);
  }
}

function availability(context: CastContext, skill: Skill): AvailabilityResult {
  const chains = chainState(context);
  if (!chains) return CAST_READY;
  const chain = resolveAutoattackChainStep(context.catalog.autoattackChainPositions, chains, skill.id);
  if (!chain || chain.matchesExpectedStep) return CAST_READY;
  const expected = context.catalog.skillsById.get(chain.expectedSkillId);
  return denyCast(
    'gw2.autoattack-chain',
    `${skill.name} is unavailable — cast ${expected?.name || 'the earlier chain skill'} first.`
  );
}

/** A player cast interrupts a pending chain only when its own damage lands no later than the cast's actual end. */
function interruptsAutoattackChain(context: CastLifecycleContext, skill: Skill): boolean {
  if (
    context.action?.cancelled === true ||
    skill.independentCast === true ||
    context.fullEnd <= context.start + context.epsilon
  )
    return false;
  const emittedByCastEnd = context
    .eventsOfType('damage')
    .some(
      (event) =>
        event.activationId === context.reservationId && Number(event.at) <= context.effectiveEnd + context.epsilon
    );
  if (emittedByCastEnd) return true;

  // Replacing handlers can retain their profile until cast completion, so use
  // that authored timing when no damage event exists yet.
  return (skill.effects || []).some((effect) => {
    if (effect.type !== 'strike') return false;
    const timing = context.schedulerPolicy.effectTiming?.(context, skill, effect) ?? effect;
    return effectFirstAt(context.start, context.fullEnd, timing) <= context.effectiveEnd + context.epsilon;
  });
}

function transition(
  context: CastLifecycleContext,
  skill: Skill,
  options: Gw2AutoattackChainOptions
): AutoattackChainTransitionResult {
  const chains = chainState(context);
  const committed = context.action?.cancelled !== true;
  const position = context.catalog.autoattackChainPositions.get(Number(skill.id));
  const castChainRootId = position?.root ?? null;
  if (!chains) {
    return Object.freeze({ committed, castChainRootId, transitions: Object.freeze([]) });
  }

  const changes: AutoattackChainTransition[] = [];
  const pending = Object.entries(chains)
    .map(([root, expected]) => [Number(root), Number(expected)] as const)
    .filter(([root, expected]) => Number.isFinite(root) && Number.isFinite(expected) && expected !== root);

  // Every pending root is judged independently so one precise exception cannot
  // accidentally preserve an unrelated weapon's sequence.
  for (const [root, expected] of pending) {
    if (root === castChainRootId) continue;
    const overrideContext: AutoattackChainContext = {
      cast: context,
      chainRootId: root,
      expectedSkillId: expected,
      interruptingSkill: skill,
      interruptingChainRootId: castChainRootId
    };
    const override = matchingOverride(options.overrides || [], overrideContext);
    // Skill type is irrelevant: only a nonzero cast whose damage lands by cast end
    // interrupts the pending chain unless a profession declares a narrow exception.
    const decision = override?.decision || (interruptsAutoattackChain(context, skill) ? 'reset' : 'preserve');
    if (decision === 'reset') delete chains[root];
    changes.push(
      Object.freeze({
        chainRootId: root,
        previousSkillId: expected,
        nextSkillId: decision === 'preserve' ? expected : null,
        decision,
        overrideId: override?.id || null
      })
    );
  }

  if (position && committed) {
    const previousSkillId = Number(chains[position.root]) || position.root;
    if (position.next == null) delete chains[position.root];
    else chains[position.root] = position.next;
    changes.push(
      Object.freeze({
        chainRootId: position.root,
        previousSkillId,
        nextSkillId: position.next,
        decision: position.next == null ? 'complete' : 'advance',
        overrideId: null
      })
    );
  }

  return Object.freeze({
    committed,
    castChainRootId,
    transitions: Object.freeze(changes)
  });
}

/** Creates the two hooks automatically installed on every native GW2 profession. */
export function createGw2AutoattackChainMechanics(
  options: Gw2AutoattackChainOptions = {}
): Gw2AutoattackChainMechanics {
  validateOptions(options);
  const frozenOptions = Object.freeze({
    ...options,
    overrides: Object.freeze([...(options.overrides || [])])
  });
  return Object.freeze({
    availability: Object.freeze({
      phase: 'scheduler' as const,
      hook: 'availability' as const,
      id: 'gw2.autoattack-chain-availability',
      order: -1000,
      handler: availability as (...args: never[]) => AvailabilityResult
    }),
    castLifecycle: Object.freeze({
      phase: 'scheduler' as const,
      hook: 'afterCast' as const,
      id: 'gw2.autoattack-chain-transition',
      order: -1000,
      handler: ((context: CastLifecycleContext, skill: Skill): void => {
        const result = transition(context, skill, frozenOptions);
        frozenOptions.onTransition?.({ cast: context, skill, result });
      }) as (...args: never[]) => void
    })
  });
}
