/** Alliance factions share utility slots while retaining separate skill identities and cooldowns. */
import type { SkillId } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

export type AllianceFaction = 'Luxon' | 'Kurzick';

export const KURZICK_SKILL_BY_LUXON: ReadonlyMap<SkillId, number> = new Map([
  [ID.SELFISH_SPIRIT, ID.SELFLESS_SPIRIT],
  [ID.NOMADS_ADVANCE, ID.BATTLE_DANCE],
  [ID.SCAVENGER_BURST, ID.TREE_SONG],
  [ID.REAVERS_RAGE, ID.AWAKENING],
  [ID.SPEAR_OF_ARCHEMORUS, ID.URN_OF_SAINT_VIKTOR]
]);

/** Gate the Alliance bar only; the grandmaster's F4 remains available with either faction. */
export function allianceBarFaction(skillId: SkillId): AllianceFaction | undefined {
  if (KURZICK_SKILL_BY_LUXON.has(skillId)) return 'Luxon';

  if (skillId === ID.DROP_URN_OF_SAINT_VIKTOR || [...KURZICK_SKILL_BY_LUXON.values()].includes(Number(skillId)))
    return 'Kurzick';

  return undefined;
}
