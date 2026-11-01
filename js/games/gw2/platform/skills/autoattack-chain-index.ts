/**
 * Shared indexing for explicitly declared chains; membership and order come from the owner declarations.
 */
import type { AutoattackChainPosition, Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Classifies ordinary attacks without treating manually activated slot-one replacements as autos. */
export function isAutoattackSkill(skill: Skill): boolean {
  return skill.autoattack === true;
}

interface AutoattackChainState {
  readonly [root: number]: SkillId | undefined;
}

interface ResolvedAutoattackChainStep {
  readonly expectedSkillId: number;
  readonly matchesExpectedStep: boolean;
}

/**
 * Freezes a chain after normalizing all skill ids to numbers.
 */
function freezeChain(chain: readonly SkillId[]): readonly number[] {
  return Object.freeze(chain.map(Number));
}

/**
 * Produces a per-skill lookup describing where that skill sits inside its
 * chain.
 */
export function indexAutoattackChains(chains: readonly (readonly SkillId[])[]): Map<number, AutoattackChainPosition> {
  const positions = new Map<number, AutoattackChainPosition>();
  for (const source of chains) {
    const chain = freezeChain(source);

    if (chain.length < 2) {
      throw new TypeError('Autoattack chains require at least two skills.');
    }

    chain.forEach((skillId, index) => {
      if (positions.has(skillId)) {
        throw new TypeError(`Skill ${skillId} belongs to multiple autoattack chains.`);
      }

      positions.set(
        skillId,
        Object.freeze({
          root: chain[0],
          index,
          next: chain[index + 1] ?? null
        })
      );
    });
  }

  return positions;
}

/**
 * Resolves the currently expected member of a cataloged autoattack chain so
 * profession gates can share sequencing while retaining their own policy.
 * Missing chain state starts the sequence at its root skill.
 */
export function resolveAutoattackChainStep(
  positions: ReadonlyMap<number, AutoattackChainPosition>,
  chainState: AutoattackChainState,
  skillId: SkillId
): ResolvedAutoattackChainStep | null {
  const normalizedSkillId = Number(skillId);
  const position = positions.get(normalizedSkillId);

  if (!position) return null;

  const expectedSkillId = Number(chainState[position.root]) || position.root;
  return {
    expectedSkillId,
    matchesExpectedStep: normalizedSkillId === expectedSkillId
  };
}

/** Execution and reporting distinguish automatic attacks from manual activations using the same canonical classification. */
export function activationInputKind(skill: Skill) {
  return isAutoattackSkill(skill) ? 'autoattack' : 'manual';
}
