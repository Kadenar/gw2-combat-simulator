import type { Skill } from '#gw2/platform/engine/skills/types.js';
/** Pure strike timing and weapon selectors; all submission belongs to the shared emission service. */

/** A procedural strike whose total coefficient is divided across its hits. */
interface ProceduralStrike {
  readonly at: number;
  readonly coefficient: number;
  readonly hits?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
}

/**
 * Divides one procedural strike into single-hit packets so each hit is an independent resolved-hit fact. The total
 * coefficient is shared equally; `intervalSeconds` spaces consecutive hits, and explicit hit positions are kept.
 */
export function splitStrikeHits<T extends ProceduralStrike>(packet: T, intervalSeconds = 0): T[] {
  const hits = Math.max(1, Math.trunc(packet.hits ?? 1));
  return Array.from({ length: hits }, (_, index) => ({
    ...packet,
    at: packet.at + index * intervalSeconds,
    coefficient: (packet.coefficient || 0) / hits,
    hits: 1,
    hitIndex: packet.hitIndex ?? index + 1,
    totalHits: packet.totalHits ?? hits
  }));
}

/** Weapon identity for a mechanic's strike: the skill's own weapon, or none for utility and profession skills. */
export function proceduralSkillWeapon(skill: Pick<Skill, 'skillWeapon' | 'type' | 'weapon'>): string {
  return skill.skillWeapon ?? (skill.type === 'Weapon' ? skill.weapon || '' : 'Unequipped');
}
