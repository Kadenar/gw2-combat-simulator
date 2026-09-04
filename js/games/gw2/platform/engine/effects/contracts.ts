import type { EffectAudience, EffectMetadata } from '#gw2/platform/engine/events/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';

const RECIPIENT_SCOPES = new Set(['self', 'party', 'summons']);
const AUDIENCE_FIELDS = new Set(['recipients', 'affectsSelf', 'maximumRecipients', 'eligibleCompanionIds']);
const METADATA_VALUE_KINDS = Object.freeze({
  activeSpirits: 'number',
  affinityOnHit: 'boolean',
  anguishConditionalDamage: 'boolean',
  blightEmpowered: 'boolean',
  dhuumfireDuration: 'number',
  dhuumfireInterval: 'number',
  engineerMech: 'boolean',
  essenceBlastDamagePerSpirit: 'number',
  evtcSkillId: 'skillId',
  hitboxIndex: 'number',
  largeHitboxOnly: 'boolean',
  legendId: 'string',
  necromancerBlight: 'number',
  necromancerShroudSkillOne: 'boolean',
  packetKind: 'string',
  radiantWeapon: 'string',
  smallHitboxCap: 'number',
  spirit: 'string',
  spiritAttackType: 'string',
  trigger: 'string'
} satisfies Record<keyof EffectMetadata, 'boolean' | 'number' | 'skillId' | 'string'>);
const METADATA_FIELDS = new Set(Object.keys(METADATA_VALUE_KINDS));

/** Validates and freezes the one recipient-selection shape accepted by authored and procedural effects. */
export function normalizeEffectAudience(value: unknown): EffectAudience | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Effect audience must be an object.');
  }

  const audience = value as SchedulerRecord;
  const unknownFields = Object.keys(audience).filter((field) => !AUDIENCE_FIELDS.has(field));
  if (unknownFields.length) {
    throw new TypeError(
      `Effect audience has unsupported field${unknownFields.length === 1 ? '' : 's'}: ${unknownFields.join(', ')}`
    );
  }

  if (typeof audience.recipients !== 'string' || !RECIPIENT_SCOPES.has(audience.recipients)) {
    throw new TypeError('Effect audience recipients must be self, party, or summons.');
  }

  if (audience.affectsSelf != null && typeof audience.affectsSelf !== 'boolean') {
    throw new TypeError('Effect audience affectsSelf must be a boolean.');
  }

  const maximumRecipients = audience.maximumRecipients;
  if (
    maximumRecipients != null &&
    (typeof maximumRecipients !== 'number' || !Number.isInteger(maximumRecipients) || !(maximumRecipients > 0))
  ) {
    throw new TypeError('Effect audience maximumRecipients must be a positive integer.');
  }

  if (
    audience.eligibleCompanionIds != null &&
    (!Array.isArray(audience.eligibleCompanionIds) ||
      audience.eligibleCompanionIds.some((id) => typeof id !== 'string' || !id))
  ) {
    throw new TypeError('Effect audience eligibleCompanionIds must be non-empty strings.');
  }

  return Object.freeze({
    recipients: audience.recipients,
    ...(audience.affectsSelf == null ? {} : { affectsSelf: audience.affectsSelf }),
    ...(maximumRecipients == null ? {} : { maximumRecipients }),
    ...(audience.eligibleCompanionIds == null
      ? {}
      : { eligibleCompanionIds: Object.freeze([...new Set(audience.eligibleCompanionIds)]) })
  }) as EffectAudience;
}

/** Validates and freezes the closed annotation vocabulary without flattening it into its owner. */
export function normalizeEffectMetadata(value: unknown): EffectMetadata | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Effect metadata must be an object.');
  }

  const metadata = value as SchedulerRecord;
  const unknownFields = Object.keys(metadata).filter((field) => !METADATA_FIELDS.has(field));
  if (unknownFields.length) {
    throw new TypeError(
      `Effect metadata has unsupported field${unknownFields.length === 1 ? '' : 's'}: ${unknownFields.join(', ')}`
    );
  }

  for (const [field, fieldValue] of Object.entries(metadata)) {
    const kind = METADATA_VALUE_KINDS[field as keyof EffectMetadata];
    if (kind === 'string' && (typeof fieldValue !== 'string' || !fieldValue)) {
      throw new TypeError(`Effect metadata ${field} must be a non-empty string.`);
    }

    if (kind === 'number' && (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue))) {
      throw new TypeError(`Effect metadata ${field} must be a finite number.`);
    }

    if (kind === 'boolean' && typeof fieldValue !== 'boolean') {
      throw new TypeError(`Effect metadata ${field} must be a boolean.`);
    }

    if (kind === 'skillId' && typeof fieldValue !== 'string' && typeof fieldValue !== 'number') {
      throw new TypeError(`Effect metadata ${field} must be a skill id.`);
    }
  }

  return Object.freeze({ ...metadata }) as EffectMetadata;
}
