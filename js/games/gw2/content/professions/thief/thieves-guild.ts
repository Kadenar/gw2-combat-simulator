import { ANTIQUARY_THIEVES_GUILD_SUMMON } from './specializations/antiquary/thieves-guild.js';
import { DAREDEVIL_THIEVES_GUILD_SUMMON } from './specializations/daredevil/thieves-guild.js';
import { DEADEYE_THIEVES_GUILD_SUMMON } from './specializations/deadeye/thieves-guild.js';
import { SPECTER_THIEVES_GUILD_SUMMON } from './specializations/specter/thieves-guild.js';
import type { ThiefSummonDefinition } from './types.js';

const SPECIALIZATION_THIEVES_GUILD_SUMMON: Readonly<Record<string, ThiefSummonDefinition>> = Object.freeze({
  Antiquary: ANTIQUARY_THIEVES_GUILD_SUMMON,
  Daredevil: DAREDEVIL_THIEVES_GUILD_SUMMON,
  Deadeye: DEADEYE_THIEVES_GUILD_SUMMON,
  Specter: SPECTER_THIEVES_GUILD_SUMMON
});

// Family-level dispatch selects a specialization-owned summon without leaking elite definitions into Core.
export function thiefSpecializationGuildSummon(specialization: string): ThiefSummonDefinition | null {
  return SPECIALIZATION_THIEVES_GUILD_SUMMON[specialization] || null;
}
