import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Energy Meld arms its landing window before the independent in-combat Energy refund. */
export const energyMeldCompleted = defineTriggerPoint<{ readonly at: number }>('revenant.energy-meld-completed', [
  TRAIT.REAVERS_CURSE,
  TRAIT.ANGSIYANS_TRUST
]);

/** The landing strike captures the old damage window before renewing Forerunner. */
export const vindicatorLanded = defineTriggerPoint<{
  readonly profile: RevenantSkill;
  readonly activationId: string;
  readonly at: number;
}>('revenant.vindicator-landed', [TRAIT.FORERUNNER_OF_DEATH]);

/** The authored Energy Meld reward chooses its trait replacement before completion observers run. */
export const energyMeldEnduranceGranted = defineTriggerPoint<{ readonly cast: RuntimeCast<RevenantSkill> }>(
  'revenant.energy-meld-endurance-granted',
  [TRAIT.SONG_OF_ARBOREUM]
);
