/**
 * Shared autoattack-chain helpers. Professions can either derive rooted
 * weapon-slot-1 chains from canonical catalog metadata or provide explicit
 * sequences, then index each skill's position within its chain using the same
 * lookup shape.
 */
import type { AutoattackChainPosition, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

export interface AutoattackChainState {
  readonly [root: number]: SkillId | undefined;
}

export interface ResolvedAutoattackChainStep {
  readonly position: AutoattackChainPosition;
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
 * Discovers rooted weapon-slot-1 autoattack chains from canonical skill
 * metadata.
 */
export function deriveAutoattackChains(skills: readonly Skill[]): readonly (readonly number[])[] {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const chainedIds = new Set(skills.map((skill) => skill.nextChainId).filter((id) => id != null));
  const chains: (readonly number[])[] = [];
  for (const root of skills) {
    if (root.type !== 'Weapon' || root.slot !== 'Weapon_1' || root.nextChainId == null || chainedIds.has(root.id))
      continue;
    const chain: SkillId[] = [];
    const visited = new Set<SkillId>();
    let skill: Skill | null | undefined = root;
    while (skill && !visited.has(skill.id)) {
      visited.add(skill.id);
      chain.push(skill.id);
      skill = skill.nextChainId == null ? null : byId.get(skill.nextChainId);
    }

    if (chain.length > 1) chains.push(freezeChain(chain));
  }

  return Object.freeze(chains);
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
          step: index + 1,
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
    position,
    expectedSkillId,
    matchesExpectedStep: normalizedSkillId === expectedSkillId
  };
}
