import { RECIPIENT } from '#gw2/platform/constants.js';
import type { EffectAudience } from '#gw2/platform/events/events.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';

const RECIPIENT_SCOPES: ReadonlySet<string> = new Set(Object.values(RECIPIENT));

const AUDIENCE_FIELDS = new Set([
  'recipients',
  'alliedPlayerIndex',
  'affectsSelf',
  'maximumRecipients',
  'eligibleCompanionIds'
]);

/** Validates and freezes the one recipient-selection shape accepted by authored and procedural effects. */
export function normalizeEffectAudience(value: unknown): EffectAudience | undefined {
  if (value == null) return undefined;

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Effect audience must be an object.');
  }

  const audience = value as UnvalidatedFields;
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

  // Named recipients must identify an actual party slot; other scopes cannot select allied players.
  const alliedPlayerIndex = audience.alliedPlayerIndex;

  if (
    alliedPlayerIndex != null &&
    (audience.recipients !== RECIPIENT.PARTY ||
      typeof alliedPlayerIndex !== 'number' ||
      !Number.isInteger(alliedPlayerIndex) ||
      alliedPlayerIndex < 1 ||
      alliedPlayerIndex > 4)
  ) {
    throw new TypeError('Effect audience alliedPlayerIndex must be a party-player index from 1 to 4.');
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
    ...(alliedPlayerIndex == null ? {} : { alliedPlayerIndex }),
    ...(audience.affectsSelf == null ? {} : { affectsSelf: audience.affectsSelf }),
    ...(maximumRecipients == null ? {} : { maximumRecipients }),
    ...(audience.eligibleCompanionIds == null
      ? {}
      : { eligibleCompanionIds: Object.freeze([...new Set(audience.eligibleCompanionIds)]) })
  }) as EffectAudience;
}
