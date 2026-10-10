import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerInstrument } from '#gw2/professions/mesmer/types.js';
interface InstrumentImpact {
  readonly skill: MesmerSkill;
  readonly data: MesmerInstrument;
  readonly damageAt: number;
  readonly source: string;
  readonly actorType: 'player' | 'summon';
  readonly delivery: EffectDelivery;
}
/** Each boundary stays separated by the native instrument packets that precede the next reaction. */
export const troubadourInstrumentStrike = defineTriggerPoint<InstrumentImpact>('mesmer.troubadour-instrument-strike', [
  TRAIT.SHREDDING
]);
/** Trait conditions follow Shredding and the native afterimage conditions. */
export const troubadourInstrumentConditions = defineTriggerPoint<InstrumentImpact>(
  'mesmer.troubadour-instrument-conditions',
  [TRAIT.MAYHEM]
);
/** The delayed wave follows native control, before Lute's party grants. */
export const troubadourInstrumentControl = defineTriggerPoint<InstrumentImpact>(
  'mesmer.troubadour-instrument-control',
  [TRAIT.SYNCOPATE, TRAIT.LIFE_OF_THE_PARTY]
);
/** Committed note spending is captured before any afterimage reward can mutate resources. */
export const troubadourInstrumentCommitted = defineTriggerPoint<{
  readonly skill: MesmerSkill;
  readonly data: MesmerInstrument;
  readonly at: number;
  readonly spent: number;
  readonly delivery: EffectDelivery;
}>('mesmer.troubadour-instrument-committed', [TRAIT.CALL_AND_RESPONSE]);
/** Recharge reduction remains after the instrument marker and uses the committed spend. */
export const troubadourInstrumentAnnounced = defineTriggerPoint<{ readonly spent: number; readonly at: number }>(
  'mesmer.troubadour-instrument-announced',
  [TRAIT.ALTERED_CHORD]
);
/** Crescendo captures the last instrument and preserves post-strike reward ordering. */
export const troubadourCrescendoResolved = defineTriggerPoint<{
  readonly skill: MesmerSkill;
  readonly damageAt: number;
  readonly at: number;
  readonly delivery: EffectDelivery;
  readonly lastInstrument: string;
}>('mesmer.troubadour-crescendo-resolved', [TRAIT.LIFE_OF_THE_PARTY, TRAIT.ALTERED_CHORD, TRAIT.FORTISSIMO]);
/** Tale boons and the admitted note gain precede Raconteur. */
export const troubadourTaleResolved = defineTriggerPoint<{ readonly skill: MesmerSkill; readonly at: number }>(
  'mesmer.troubadour-tale-resolved',
  [TRAIT.RACONTEUR]
);

/** Accepted dodge completion admits Mayhem without coupling the skill to a selected trait task. */
export const troubadourDodgeCompleted = defineTriggerPoint<{ readonly cast: RuntimeCast<MesmerSkill> }>(
  'mesmer.troubadour-dodge-completed',
  [TRAIT.MAYHEM]
);
