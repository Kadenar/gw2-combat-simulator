// Shared autoattack-chain helpers. Professions can either derive chains from
// catalog metadata or provide explicit sequences and index them with the same
// lookup shape.

/**
 * Freezes a chain after normalizing all skill ids to numbers.
 */
function freezeChain(chain) {
  return Object.freeze(chain.map(Number));
}

/**
 * Discovers rooted weapon-slot-1 autoattack chains from canonical skill
 * metadata.
 */
export function deriveAutoattackChains(skills) {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const chainedIds = new Set(
    skills.map((skill) => skill.nextChainId).filter((id) => id != null),
  );
  const chains = [];
  for (const root of skills) {
    if (
      root.type !== "Weapon" ||
      root.slot !== "Weapon_1" ||
      root.nextChainId == null ||
      chainedIds.has(root.id)
    )
      continue;
    const chain = [];
    const visited = new Set();
    let skill = root;
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
export function indexAutoattackChains(chains) {
  const positions = new Map();
  for (const source of chains) {
    const chain = freezeChain(source);
    if (chain.length < 2) {
      throw new TypeError("Autoattack chains require at least two skills.");
    }
    chain.forEach((skillId, index) => {
      if (positions.has(skillId)) {
        throw new TypeError(
          `Skill ${skillId} belongs to multiple autoattack chains.`,
        );
      }
      positions.set(
        skillId,
        Object.freeze({
          root: chain[0],
          index,
          step: index + 1,
          next: chain[index + 1] ?? null,
        }),
      );
    });
  }
  return positions;
}
