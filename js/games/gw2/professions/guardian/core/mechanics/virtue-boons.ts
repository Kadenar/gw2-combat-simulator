/**
 * Inspired Virtue and Legendary Lore select each virtue's effect by this stable name. The selected profile supplies the
 * boon it grants.
 */
import { BOON } from '#gw2/platform/constants.js';
import type { GuardianVirtue } from '#gw2/professions/guardian/types.js';

export const virtueBoonEffects = {
  justice: { type: 'boon', name: BOON.MIGHT },
  resolve: { type: 'boon', name: BOON.REGENERATION },
  courage: { type: 'boon', name: BOON.PROTECTION }
} as const satisfies Record<GuardianVirtue, { type: 'boon'; name: string }>;
