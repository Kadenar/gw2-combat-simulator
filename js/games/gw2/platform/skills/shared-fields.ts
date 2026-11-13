import { attributeFields } from '#gw2/platform/skills/attribute-fields.js';
import {
  assertFieldGroups,
  combineFields,
  dataField,
  defineFields,
  numberField,
  type FieldSpecs
} from '#gw2/platform/skills/field-specs.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';

/**
 * Defines numeric skill fields read by platform, application, or integration code, including bounds, units, and patch tiers.
 * Each profession declares fields read only by its own code. Skill types declare non-numeric fields. This table
 * contains group records only for nested numeric fields and preserves literal keys so `Skill` can derive its numeric properties.
 */
export const SHARED_SKILL_FIELDS = defineFields(
  {
    // Input, activation, and interruption.
    /** Effective player cast duration; independent summons retain their base duration. */
    castTimeMs: numberField({ label: 'cast time', unit: 'milliseconds', patch: 'primary' }),
    /** Summon-only measured duration under Quickness. Player skills use castTimeMs. */
    quicknessCastTimeMs: numberField({ label: 'Summon Quickness cast time', unit: 'milliseconds', runtimeOnly: true }),
    defaultInterruptMs: numberField({ unit: 'milliseconds' }),
    interruptCommitMs: numberField({ unit: 'milliseconds', runtimeOnly: true }),
    /** Fixed time from cast start at which an interruption releases retained lockout; requires retention enabled. */
    interruptLockoutReleaseMs: numberField({ unit: 'milliseconds', runtimeOnly: true }),
    /**
     * Self-inflicted stun applied to the player when this serial cast completes (e.g. Berserker Head Butt). The
     * player's cast lane is blocked for this many milliseconds after the cast unless the next serial skill is a
     * `stunbreak`, or the player has stability when the cast ends.
     */
    selfStunMs: numberField({ unit: 'milliseconds', runtimeOnly: true }),
    /**
     * Fixed milliseconds from `peithaImpactAnchor` to the Relic of Peitha projectile impact, including launch latency
     * and travel. Skills without a measured value use the relic's default impact delay.
     */
    peithaImpactDelayMs: numberField({ unit: 'milliseconds' }),

    // Recharge and ammunition.
    cooldown: numberField({ unit: 'seconds', patch: 'primary' }),
    rechargeReduction: numberField({ unit: 'seconds', patch: 'primary' }),
    rechargeOffsetMs: numberField({ unit: 'milliseconds', minimum: -Infinity, runtimeOnly: true }),
    /** Fraction of the accepted interval to the recharge anchor, before any fixed offset. */
    rechargeProgress: numberField({ maximum: 1, runtimeOnly: true }),
    ammo: numberField({ patch: 'primary' }),
    /** Minimum delay between consecutive casts of an ammo skill, in seconds. */
    ammoCastLockout: numberField({ unit: 'seconds', patch: 'primary' }),

    // Resources and costs.
    /** Amount of the resource selected by the consuming profession mechanic. */
    resourceGain: numberField({ patch: 'primary' }),
    cost: dataField,
    'cost.amount': numberField({ label: 'resource cost', patch: 'primary' }),

    // Effects, follow-up windows, and skill-owned tuning.
    /** Duration in seconds of a skill-owned form or state, including a preparation's arming phase. */
    duration: numberField({ unit: 'seconds', patch: 'primary' }),
    /** Seconds a completed parent keeps its follow-up window open; professions supply their default when absent. */
    flipDuration: numberField({ unit: 'seconds', patch: 'primary' }),
    maximumStacks: numberField({ patch: 'primary' }),
    /** Seconds between accepted procs owned by this skill; independent of activation recharge. */
    internalCooldown: numberField({ unit: 'seconds', patch: 'primary' }),

    // Attribute grants: the group is closed to canonical attributes, and each attribute is its own patch leaf.
    ...attributeFields(),
    // Active skill states grant the same attribute shape as passives; professions own their eligibility windows.
    ...attributeFields('activeAttributeBonuses', 'Active ')
  },
  'Shared skill fields'
);

/**
 * Skill types declare non-numeric fields, so a skill table's data entry exists only to own dotted numeric leaves. A
 * plain data entry would restore an allowlist the closed types already enforce.
 */
function assertSkillDataFieldsAreGroups(fields: FieldSpecs): void {
  const keys = Object.keys(fields);
  for (const [field, spec] of Object.entries(fields))
    if (spec.kind === 'data' && !keys.some((key) => key.startsWith(`${field}.`)))
      throw new TypeError(`Skill field ${field} belongs on its skill type, not in a field table.`);
}

/**
 * Combine one profession's module declarations with the shared vocabulary. Redeclaring a shared field is an error:
 * a field has one owner, whichever profession reads it.
 */
export function professionSkillFields(professionFields: FieldSpecs | undefined): FieldSpecs {
  const fields = combineFields([
    { owner: 'Shared skill fields', fields: SHARED_SKILL_FIELDS },
    { owner: 'Profession skill fields', fields: professionFields }
  ]);
  assertFieldGroups(fields);
  assertSkillDataFieldsAreGroups(fields);
  return fields;
}

/** A catalog built without profession declarations validates and patches against the shared declarations. */
export function catalogSkillFields(catalog: Pick<CanonicalCatalog, 'skillFields'> | null | undefined): FieldSpecs {
  return catalog?.skillFields ?? SHARED_SKILL_FIELDS;
}
