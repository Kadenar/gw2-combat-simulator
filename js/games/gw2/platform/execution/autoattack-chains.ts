/**
 * GW2-wide runtime ownership for autoattack-chain availability and state.
 * Native professions only declare narrow interruption overrides and optional
 * transition observers; this controller performs every live map mutation.
 */
import { CAST_READY, denyCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { resolveAutoattackChainStep } from '#gw2/platform/skills/autoattack-chain-index.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

export type AutoattackChainQueries = Pick<AutoattackChainController, 'read'>;

export type MechanicAutoattackController = Pick<AutoattackChainController, 'read' | 'reset'>;

export interface AutoattackChainController {
  readonly queries: AutoattackChainQueries;
  readonly mechanics: MechanicAutoattackController;
  read(root: SkillId): SkillId;
  snapshot(): Record<string, SkillId>;
  reset(chainRootIds?: readonly SkillId[]): void;
  availability(skill: Skill): AvailabilityResult;
  advance(
    skill: Skill,
    committed: boolean,
    interrupts: boolean,
    overrides?: readonly AutoattackChainOverride[]
  ): AutoattackChainTransitionResult;
}

/** Each execution owns its progress independently of replaceable profession state; observations include root defaults. */
export function createAutoattackChainController(catalog: CanonicalCatalog): AutoattackChainController {
  const chains: Record<string, SkillId> = {};
  // Only declared roots have an unstarted default; invalid IDs must not masquerade as reset progress.
  const read = (root: SkillId): SkillId => {
    if (catalog.autoattackChainPositions.get(Number(root))?.index !== 0)
      throw new RangeError(`Skill ${root} is not an autoattack chain root.`);

    return chains[root] ?? root;
  };

  // Restricted owner views never carry execution advancement or snapshot authority.
  const queries = Object.freeze({ read });
  const mechanics = Object.freeze({
    ...queries,
    reset: (roots?: readonly SkillId[]) => resetAutoattackChains(chains, roots)
  });
  return Object.freeze({
    ...mechanics,
    queries,
    mechanics,
    snapshot: () => Object.fromEntries(catalog.autoattackChains.map(([root]) => [root, read(root)])),
    availability: (skill: Skill) => autoattackChainAvailability(chains, catalog, skill),
    advance: (skill: Skill, committed: boolean, interrupts: boolean, overrides?: readonly AutoattackChainOverride[]) =>
      advanceAutoattackChains(chains, catalog, skill, committed, interrupts, overrides)
  });
}

interface AutoattackChainContext {
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

/** Shows the canonical expected step and defaults an unstarted chain to its root without resolving labels. */
export function autoattackChainSkillAvailable(
  skill: Skill,
  chainState: Readonly<Record<string, unknown>> = {}
): boolean {
  if (!skill.chainRoot) return true;

  const chainRoot = String(skill.chainRoot);
  const expected = chainState[chainRoot] ?? skill.chainRoot;
  return skill.id === expected;
}

/** Clears all pending roots, or only the supplied roots, without replacing the shared state object. */
function resetAutoattackChains(chains: Record<string, SkillId>, chainRootIds?: readonly SkillId[]): void {
  const roots = chainRootIds == null ? Object.keys(chains).map(Number) : [...new Set(chainRootIds.map(Number))];
  for (const root of roots) {
    if (!Object.hasOwn(chains, root)) continue;

    delete chains[root];
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
    const id = (override.id || '').trim();

    if (!id) throw new TypeError('Autoattack-chain override id is required.');

    if (ids.has(id)) throw new TypeError(`Duplicate autoattack-chain override id: ${id}.`);

    ids.add(id);
  }
}

/** Cast admission checks execution-owned progress without changing the expected step. */
function autoattackChainAvailability(
  chains: Readonly<Record<string, SkillId>>,
  catalog: Pick<CanonicalCatalog, 'autoattackChainPositions' | 'skillsById'>,
  skill: Skill
): AvailabilityResult {
  const chain = resolveAutoattackChainStep(catalog.autoattackChainPositions, chains, skill.id);

  if (!chain || chain.matchesExpectedStep) return CAST_READY;

  const expected = catalog.skillsById.get(chain.expectedSkillId);
  return denyCast(
    'gw2.autoattack-chain',
    `${skill.name} is unavailable - cast ${expected?.name || 'the earlier chain skill'} first.`
  );
}

/** Mutates each pending root once from committed cast facts, independently of scheduling or combat-history queries. */
function advanceAutoattackChains(
  chains: Record<string, SkillId>,
  catalog: Pick<CanonicalCatalog, 'autoattackChainPositions'>,
  skill: Skill,
  committed: boolean,
  interrupts: boolean,
  overrides: readonly AutoattackChainOverride[] = []
): AutoattackChainTransitionResult {
  const position = catalog.autoattackChainPositions.get(Number(skill.id));
  const castChainRootId = position?.rootSkillId ?? null;

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
    if (position.nextSkillId == null) delete chains[position.rootSkillId];
    else chains[position.rootSkillId] = position.nextSkillId;

    changes.push(
      Object.freeze({
        chainRootId: position.rootSkillId,
        nextSkillId: position.nextSkillId,
        decision: position.nextSkillId == null ? 'complete' : 'advance'
      })
    );
  }

  return Object.freeze({
    committed,
    castChainRootId,
    transitions: Object.freeze(changes)
  });
}
