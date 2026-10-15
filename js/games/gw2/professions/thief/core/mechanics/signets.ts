import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

/** Assassin's Signet opens its active window and suppresses its passive until the signet recharges. */
export function activateAssassinsSignet(runtime: ThiefRuntime): void {
  const core = runtime.profession.core;
  replaceThiefBuff(
    runtime,
    'assassins-signet',
    balanceNumberFromContext(runtime, PROFILE.assassinsSignet, 'durationMultiplier'),
    ID.ASSASSINS_SIGNET,
    "Assassin's Signet",
    'thief'
  );
  core.assassinsSignetPassiveDisabledUntil = runtime.cooldownController.readyAt(ID.ASSASSINS_SIGNET) ?? runtime.time;
}
