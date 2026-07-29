import {
  deriveAutoattackChains,
} from "../../../platform/engine/autoattack-chains.js";

// The API models Rifle Burst Grenade as a chain/flip, but it is an automatic
// packet fired by Rifle Burst rather than a second player-selected attack.
const TRIGGERED_FOLLOWUP_IDS = new Set([68079]);

export function engineerAutoattackChains(skills) {
  return Object.freeze(
    deriveAutoattackChains(skills).filter(chain =>
      !chain.some(skillId => TRIGGERED_FOLLOWUP_IDS.has(skillId))),
  );
}
