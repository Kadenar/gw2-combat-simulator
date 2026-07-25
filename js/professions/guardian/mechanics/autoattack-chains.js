import { GUARDIAN_BUNDLE_SKILLS } from "../data/guardian-bundle-skills.js";
import { SKILLS } from "../data/guardian-catalog.js";

const ALL_GUARDIAN_SKILLS = Object.freeze([
  ...SKILLS,
  ...GUARDIAN_BUNDLE_SKILLS,
]);

function autoattackChains(skills) {
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  const chainedIds = new Set(
    skills.map(skill => skill.nextChainId).filter(id => id != null),
  );
  const chains = [];
  for (const root of skills) {
    if (
      root.type !== "Weapon"
      || root.slot !== "Weapon_1"
      || root.nextChainId == null
      || chainedIds.has(root.id)
    ) continue;
    const chain = [];
    const visited = new Set();
    let skill = root;
    while (skill && !visited.has(skill.id)) {
      visited.add(skill.id);
      chain.push(skill.id);
      skill = skill.nextChainId == null
        ? null
        : byId.get(skill.nextChainId);
    }
    if (chain.length > 1) chains.push(Object.freeze(chain));
  }
  return Object.freeze(chains);
}

export const GUARDIAN_AUTOATTACK_CHAINS = autoattackChains(
  ALL_GUARDIAN_SKILLS,
);
