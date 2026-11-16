/** Profession declarations retain typed, readonly metadata through ordinary event property access. */
import type { EffectMetadata, SimulationEventBase } from '#gw2/platform/events/events.js';
import type { MetadataFromFields } from '#gw2/platform/events/metadata.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MESMER_METADATA_FIELDS } from '#gw2/professions/mesmer/metadata.js';

const metadata: EffectMetadata = { cloneId: 0, blade: false, recallSkillId: 'fixture', triggeredByAlly: 0 };
const event: SimulationEventBase = {
  type: 'damage',
  at: 0,
  source: 'fixture',
  sourceId: 1,
  actorType: 'player',
  metadata
};
const cloneId: number | undefined = event.metadata?.cloneId;
void cloneId;

// @ts-expect-error Profession fields retain their declared value types.
const invalidClone: EffectMetadata = { cloneId: '1' };
// @ts-expect-error Skill IDs cannot contain objects.
const invalidRecall: EffectMetadata = { recallSkillId: { id: 1 } };
// @ts-expect-error Fields not declared by any owner are rejected.
const unknown: EffectMetadata = { foreignFlag: true };
// @ts-expect-error Packet annotations remain readonly.
metadata.blade = true;
// @ts-expect-error Shared annotations retain their types.
const invalidAlly: EffectMetadata = { triggeredByAlly: true };
void [invalidClone, invalidRecall, unknown, invalidAlly];

type MesmerMetadata = MetadataFromFields<typeof MESMER_METADATA_FIELDS>;
// @ts-expect-error The family's mapped fields contain only its own declarations.
const foreign: MesmerMetadata = { recallSkillId: 1 };
void foreign;

// Summon combat inputs belong to the platform packet contract, not its open extension keys.
const summon: Gw2ResolverEvent = {
  ...event,
  type: 'damage',
  coefficient: 1,
  summonCriticalChance: 0,
  summonCriticalDamage: 1,
  summonStrikeMultiplier: 0
};
const chance: number | undefined = summon.summonCriticalChance;
const damage: number | undefined = summon.summonCriticalDamage;
const multiplier: number | undefined = summon.summonStrikeMultiplier;
// @ts-expect-error Native summon critical chance is a number.
const badChance: Gw2ResolverEvent = { ...summon, summonCriticalChance: '0' };
// @ts-expect-error Native summon critical damage is a number.
const badDamage: Gw2ResolverEvent = { ...summon, summonCriticalDamage: '1' };
// @ts-expect-error Native summon strike multipliers are numbers.
const badMultiplier: Gw2ResolverEvent = { ...summon, summonStrikeMultiplier: '1' };
void [chance, damage, multiplier, badChance, badDamage, badMultiplier];
