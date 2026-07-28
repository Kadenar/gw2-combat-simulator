export function thiefAutoattackChains(skills) {
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  const children = new Set(
    skills.map(skill => skill.nextChainId).filter(id => id != null),
  );
  const chains = [];
  for (const skill of skills) {
    if (skill.nextChainId == null || children.has(skill.id)) continue;
    const chain = [];
    const seen = new Set();
    let current = skill;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.push(current.id);
      current = current.nextChainId == null
        ? null
        : byId.get(current.nextChainId);
    }
    if (chain.length > 1) chains.push(Object.freeze(chain));
  }
  return Object.freeze(chains);
}

