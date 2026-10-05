import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { gw2SigilIds } from '#gw2/platform/equipment/sigils/loadout.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { SEVERANCE_BUFF_POLICY } from '#gw2/platform/equipment/sigils/severance.js';

/** Register both configured sets for the run so swapping cannot retire an active effect's owner. */
export function sigilBuffPolicies(config: Gw2Config): readonly BuffStatePolicy[] {
  return Object.freeze(
    [1, 2].some((set) => gw2SigilIds(config, set).includes(SIGIL_IDS.SEVERANCE)) ? [SEVERANCE_BUFF_POLICY] : []
  );
}
