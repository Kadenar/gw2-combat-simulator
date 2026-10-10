import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianResolverEvent, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** A successful Dragonhunter cast, after its accepted virtue activation rewards. */
export interface DragonhunterCastCompletion {
  readonly cast: RuntimeCast<GuardianSkill>;
}

/** The elite cast grants endurance only after the shared virtue rewards have settled. */
export const dragonhunterCastCompleted = defineTriggerPoint<DragonhunterCastCompletion>(
  'guardian.dragonhunter-cast-completed',
  [TRAIT.HUNTERS_DETERMINATION]
);

/** An accepted control applied by the player. */
export interface DragonhunterControl {
  readonly cause: GuardianResolverEvent;
}

/** Dulled Senses' Crippled settles at the control timestamp before Heavy Light claims its Stability interval. */
export const dragonhunterControlAccepted = defineTriggerPoint<DragonhunterControl>(
  'guardian.dragonhunter-control-accepted',
  [TRAIT.DULLED_SENSES, TRAIT.HEAVY_LIGHT]
);
