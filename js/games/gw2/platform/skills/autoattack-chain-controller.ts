/**
 * GW2-wide runtime ownership for autoattack-chain availability and state.
 * Native professions only declare narrow interruption overrides and optional
 * transition observers; this controller performs every live map mutation.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { CAST_READY, denyCast } from '#gw2/platform/engine/skills/availability.js';
import { resolveAutoattackChainStep } from '#gw2/platform/engine/skills/autoattack-chains.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Skill, SkillId, CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';

interface AutoattackChainCoreState {
  readonly autoattackChains?: Record<string, SkillId>;
}

export interface AutoattackChainContext {
  readonly chainRootId: SkillId;
  readonly interruptingSkill: Skill;
}

export interface AutoattackChainOverride {
  readonly id: string;
  readonly chainRootIds?: readonly SkillId[];
  readonly interruptingSkillIds?: readonly SkillId[];
  readonly when?: (context: AutoattackChainContext) => boolean;
  readonly decision: 'preserve' | 'reset';
}

/** Reports the resulting chain state so profession observers can manage carryover and expiry. */
export interface AutoattackChainTransition {
  readonly chainRootId: SkillId;
  readonly nextSkillId: SkillId | null;
  readonly decision: 'advance' | 'complete' | 'preserve' | 'reset';
}

export interface AutoattackChainTransitionResult {
  readonly committed: boolean;
  readonly castChainRootId: SkillId | null;
  readonly transitions: readonly AutoattackChainTransition[];
}

export interface Gw2AutoattackChainOptions {
  readonly overrides?: readonly AutoattackChainOverride[];
}

/** Shows the expected chain step, accepting stored names or IDs and defaulting an unstarted chain to its root. */
export function autoattackChainSkillAvailable(
  skill: Skill,
  chainState: Readonly<Record<string, unknown>> = {}
): boolean {
  if (!skill.chainRoot) return true;
  const chainRoot = String(skill.chainRoot);
  const expected = chainState[chainRoot] ?? skill.chainRoot;
  return skill.name === expected || skill.id === Number(expected);
}

function chainState(context: object): Record<string, SkillId> | null {
  const core = professionCoreState(context) as AutoattackChainCoreState | undefined;
  const chains = core?.autoattackChains;
  return chains && typeof chains === 'object' && !Array.isArray(chains) ? chains : null;
}

/** Clears all pending roots, or only the supplied roots, without replacing the shared state object. */
export function resetAutoattackChains(context: object, chainRootIds?: readonly SkillId[]): void {
  const chains = chainState(context);
  if (!chains) return;
  const roots = chainRootIds == null ? Object.keys(chains).map(Number) : [...new Set(chainRootIds.map(Number))];
  for (const root of roots) {
    if (!Object.hasOwn(chains, root)) continue;
    delete chains[root];
  }
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

export function validateAutoattackChainOptions(options: Gw2AutoattackChainOptions): void {
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

/** Both execution owners validate the same canonical chain map without changing its current step. */
export function autoattackChainAvailability(
  context: object,
  catalog: Pick<CanonicalCatalog, 'autoattackChainPositions' | 'skillsById'>,
  skill: Skill
): AvailabilityResult {
  const chains = chainState(context);
  if (!chains) return CAST_READY;
  const chain = resolveAutoattackChainStep(catalog.autoattackChainPositions, chains, skill.id);
  if (!chain || chain.matchesExpectedStep) return CAST_READY;
  const expected = catalog.skillsById.get(chain.expectedSkillId);
  return denyCast(
    'gw2.autoattack-chain',
    `${skill.name} is unavailable — cast ${expected?.name || 'the earlier chain skill'} first.`
  );
}

/** Mutates each pending root once from committed cast facts, independently of scheduling or combat-history queries. */
export function advanceAutoattackChains(
  context: object,
  catalog: Pick<CanonicalCatalog, 'autoattackChainPositions'>,
  skill: Skill,
  committed: boolean,
  interrupts: boolean,
  overrides: readonly AutoattackChainOverride[] = []
): AutoattackChainTransitionResult {
  const chains = chainState(context);
  const position = catalog.autoattackChainPositions.get(Number(skill.id));
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
      chainRootId: root,
      interruptingSkill: skill
    };
    const override = matchingOverride(overrides, overrideContext);
    // Skill type is irrelevant: only a nonzero cast whose damage lands by cast end
    // interrupts the pending chain unless a profession declares a narrow exception.
    const decision = override?.decision || (interrupts ? 'reset' : 'preserve');
    if (decision === 'reset') delete chains[root];
    changes.push(
      Object.freeze({
        chainRootId: root,
        nextSkillId: decision === 'preserve' ? expected : null,
        decision
      })
    );
  }

  if (position && committed) {
    if (position.next == null) delete chains[position.root];
    else chains[position.root] = position.next;
    changes.push(
      Object.freeze({
        chainRootId: position.root,
        nextSkillId: position.next,
        decision: position.next == null ? 'complete' : 'advance'
      })
    );
  }

  return Object.freeze({
    committed,
    castChainRootId,
    transitions: Object.freeze(changes)
  });
}
