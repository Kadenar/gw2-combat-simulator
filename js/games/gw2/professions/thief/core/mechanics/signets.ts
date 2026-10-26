import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

/** Assassin's Signet owns only its active buff; the shared cooldown query controls passive eligibility. */
export function activateAssassinsSignet(runtime: ThiefRuntime): void {
  replaceThiefBuff(
    runtime,
    'assassins-signet',
    skillNumberFromContext(runtime, ID.ASSASSINS_SIGNET, 'duration'),
    ID.ASSASSINS_SIGNET,
    "Assassin's Signet",
    'thief'
  );
}
