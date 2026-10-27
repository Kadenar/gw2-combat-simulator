import { attributeFields } from '#gw2/platform/skills/attribute-fields.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
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
 * Skill fields read by platform, application, or integration code. A field read only by one profession's code is
 * declared by that profession's module instead, so this table never grows with profession vocabulary.
 */
export const SHARED_SKILL_FIELDS: FieldSpecs = defineFields(
  {
    // Identity, presentation, and palette placement.
    id: dataField,
    name: dataField,
    description: dataField,
    displayName: dataField,
    icon: dataField,
    variantBadge: dataField,
    type: dataField,
    slot: dataField,
    slotSelectable: dataField,
    specialization: dataField,
    categories: dataField,
    tags: dataField,
    skillFamily: dataField,
    attunement: dataField,
    weapon: dataField,
    skillWeapon: dataField,
    requiredMainHand: dataField,
    requiredOffHand: dataField,
    kitId: dataField,
    kitTransition: dataField,
    mechanicSlot: dataField,
    loadoutSkillId: dataField,
    weaponVariantRootId: dataField,
    paletteFlip: dataField,
    paletteTileId: dataField,
    paletteTileOrder: dataField,
    patchAuthoringExcluded: dataField,
    simulatorExcluded: dataField,

    // Chains, flips, and parent relationships.
    autoattack: dataField,
    chainRoot: dataField,
    chainStep: dataField,
    nextChainId: dataField,
    parentId: dataField,
    flipParentId: dataField,
    flipSkillId: dataField,
    weaponBarChainRootId: dataField,
    weaponBarChainStep: dataField,

    // Input, activation, and interruption.
    inputCategory: dataField,
    inputControl: dataField,
    castTimeMs: numberField({ label: 'cast time', unit: 'milliseconds', patch: 'primary' }),
    quicknessCastTimeMs: numberField({ label: 'Summon Quickness cast time', unit: 'milliseconds', runtimeOnly: true }),
    dualWieldCastTimeMs: numberField({ unit: 'milliseconds' }),
    dualWieldEffectOffsetsMs: dataField,
    independentCast: dataField,
    independentCastCanOverlap: dataField,
    canCastConcurrently: dataField,
    lockouts: dataField,
    defaultInterruptMs: numberField({ unit: 'milliseconds' }),
    interruptMode: dataField,
    interruptCommitMs: numberField({ unit: 'milliseconds', runtimeOnly: true }),
    dualWieldInterruptCommitMs: numberField({ unit: 'milliseconds' }),
    retainsCastLockoutAfterInterrupt: dataField,
    selfStunMs: numberField({ unit: 'milliseconds', runtimeOnly: true }),
    stunbreak: dataField,
    evades: dataField,
    movementSkill: dataField,
    shadowstepSkill: dataField,
    stealthAttack: dataField,
    ambush: dataField,
    unleashedAmbushSkill: dataField,
    dragonSlash: dataField,
    petAutonomousSkill: dataField,
    cycloneBowSkill: dataField,
    shroud: dataField,
    shroudEntry: dataField,
    shroudExit: dataField,
    shadowShroudSkill: dataField,
    shadowShroudTransition: dataField,
    peithaImpactDelayMs: numberField({ unit: 'milliseconds' }),
    peithaImpactAnchor: dataField,

    // Recharge and ammunition.
    cooldown: numberField({ unit: 'seconds', patch: 'primary' }),
    rechargeReduction: numberField({ unit: 'seconds', patch: 'primary' }),
    rechargeAnchor: dataField,
    rechargeOwner: dataField,
    rechargeOffsetMs: numberField({ unit: 'milliseconds', minimum: -Infinity, runtimeOnly: true }),
    rechargeProgress: numberField({ maximum: 1, runtimeOnly: true }),
    rechargeBuffAudience: dataField,
    rechargeIgnoresAlacrity: dataField,
    usableWhileRecharging: dataField,
    ammo: numberField({ patch: 'primary' }),
    ammoRecharge: numberField({ unit: 'seconds', patch: 'primary' }),
    ammoCastLockout: numberField({ unit: 'seconds', runtimeOnly: true }),

    // Resources and costs.
    resource: dataField,
    resourceCost: numberField({ patch: 'primary' }),
    resourceGain: numberField({ patch: 'primary' }),
    cost: dataField,

    // Effects, follow-up windows, and skill-owned tuning.
    effects: dataField,
    removedEffectKeys: dataField,
    effectVariants: dataField,
    sideEffects: dataField,
    tasks: dataField,
    modifiers: dataField,
    comboFields: dataField,
    comboFinishers: dataField,
    duration: numberField({ unit: 'seconds', patch: 'primary' }),
    flipDuration: numberField({ unit: 'seconds', patch: 'primary' }),
    maximumStacks: numberField({ patch: 'primary' }),
    internalCooldown: numberField({ unit: 'seconds', patch: 'primary' }),
    [RECIPIENT.SUMMONS]: numberField({ patch: 'advanced' }),

    // Attribute grants: the group is closed to canonical attributes, and each attribute is its own patch leaf.
    attributeMultiplier: numberField({ patch: 'primary' }),
    ...attributeFields()
  },
  'Shared skill fields'
);

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
  return fields;
}

/** A catalog built without profession declarations accepts exactly the shared vocabulary. */
export function catalogSkillFields(catalog: Pick<CanonicalCatalog, 'skillFields'> | null | undefined): FieldSpecs {
  return catalog?.skillFields ?? SHARED_SKILL_FIELDS;
}
