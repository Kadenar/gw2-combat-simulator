import { ATTRIBUTE_NAMES } from '#gw2/platform/attributes/inputs.js';
import { validateComboOwnership } from '#gw2/platform/combos/ownership.js';
import { snapshotActionDeclaration } from '#gw2/platform/effects/action-declarations.js';
import {
  validateActionIds,
  validateEffectReactions,
  validateSideEffectAction
} from '#gw2/platform/effects/action-validation.js';
import { skillActions } from '#gw2/platform/effects/actions.js';
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
import { fieldValue, validateFieldValues, type FieldSpecs } from '#gw2/platform/skills/field-specs.js';
import { INPUT_CONTROL_IDS } from '#gw2/platform/skills/input-controls.js';
import { normalizeSkillModifiers } from '#gw2/platform/skills/modifiers.js';
import { catalogSkillFields } from '#gw2/platform/skills/shared-fields.js';
import type { BalanceProfile, CanonicalCatalog, Skill, SkillId, SkillLockout } from '#gw2/platform/skills/types.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';

/** Validate skill declarations and cross-catalog references before runtime selection. */

const RECHARGE_ANCHORS = new Set(['castStart', 'castEnd']);

// Summons retain both timelines; player fragments supply their effective castTimeMs directly.
const QUICKNESS_ACTION_RATE = 1.5;

/**
 * Validates the skill-family lockouts applied when a skill activates.
 */
function normalizeLockouts(lockouts: unknown, skillId: SkillId): readonly SkillLockout[] {
  if (lockouts == null) return Object.freeze([]);

  if (!Array.isArray(lockouts)) {
    throw new TypeError(`Skill ${skillId} lockouts must be an array.`);
  }

  const candidates = lockouts as unknown[];
  const groups = new Set<string>();
  return Object.freeze(
    candidates.map((lockout, index) => {
      if (!lockout || typeof lockout !== 'object' || Array.isArray(lockout)) {
        throw new TypeError(`Skill ${skillId} lockout ${index + 1} must be an object.`);
      }

      const candidate = lockout as UnvalidatedFields;
      const group = String(candidate.group || '').trim();
      const durationMs = Number(candidate.durationMs);

      if (!group) {
        throw new TypeError(`Skill ${skillId} lockout ${index + 1} requires a group.`);
      }

      if (!(durationMs > 0) || !Number.isFinite(durationMs)) {
        throw new TypeError(`Skill ${skillId} lockout ${group} requires a positive durationMs.`);
      }

      if (groups.has(group)) {
        throw new TypeError(`Skill ${skillId} declares duplicate lockout group ${group}.`);
      }

      groups.add(group);
      return Object.freeze({ group, durationMs });
    })
  );
}

/** References can cross module contributions, so validate after the complete catalog exists. */
function validateSkillDeclarations(catalog: CanonicalCatalog, skill: Skill): void {
  validateSkillTuning(skill, catalogSkillFields(catalog), `skill=${skill.id}`);

  // Selector metadata is a cross-catalog contract, never a second source of executable packets.
  if (skill.selector) {
    const choices = Object.values(skill.selector);

    if (!choices.length || skill.effects?.length || skill.sideEffects?.length)
      throw new TypeError('Skill selector must have choices and no payload: ' + skill.id);

    // Input identity walks each choice back to its root, so both directions of the family must agree.
    for (const id of choices) {
      const choice = catalog.skillsById.get(id);

      if (!choice || choice.selector || choice.loadoutSkillId !== skill.id)
        throw new TypeError('Invalid skill selector choice: ' + id);
    }
  }

  // Stable cast action identities and owner validators use the actual authored execution stage.
  validateActionIds(skillActions(skill), `Skill ${skill.id}`);
  for (const { do: action, on } of skill.sideEffects ?? []) {
    validateSideEffectAction(catalog, skill, action, on);
  }

  for (const effect of skill.effects ?? []) validateEffectReactions(catalog, skill, effect);
  for (const variant of skill.effectVariants ?? [])
    if (variant.profileId != null && !catalog.balanceProfilesById.has(variant.profileId))
      throw new TypeError(`Skill ${skill.id} effect variant references missing profile ${variant.profileId}.`);
}

/** State lifetimes and duration additions use finite, nonnegative seconds, including explicit zero. */
function validateDurationFields(owner: object, label: string): void {
  for (const field of ['duration', 'baseDuration', 'durationPerTier', 'durationExtension', 'flipDuration']) {
    if (!Object.hasOwn(owner, field)) continue;

    const value = fieldValue(owner, field);

    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      throw new TypeError(`${label} field=${field} expected=finite nonnegative seconds.`);
  }
}

const attributeGroupsByFields = new WeakMap<FieldSpecs, readonly string[]>();

/** Compile grant groups once per schema so catalog validation does not rescan every field for every owner. */
function attributeGroups(fields: FieldSpecs): readonly string[] {
  let groups = attributeGroupsByFields.get(fields);

  if (!groups) {
    groups = Object.entries(fields).flatMap(([group, spec]) =>
      spec.kind === 'data' && spec.attributes ? [group] : []
    );
    attributeGroupsByFields.set(fields, groups);
  }

  return groups;
}

/**
 * Patched catalogs skip normalization, so declared numeric fields are checked with the other declarations against the
 * catalog's own field table. Attribute grants are closed to canonical attributes, so a misspelled grant fails instead
 * of silently granting nothing; each attribute amount is then bounded by its own numeric declaration.
 */
function validateSkillTuning(skill: Skill | BalanceProfile, fields: FieldSpecs, label: string): void {
  // Each declared grant group uses the same closed attribute vocabulary.
  for (const group of attributeGroups(fields)) {
    const bonuses = fieldValue(skill, group);

    if (bonuses === undefined) continue;

    if (!bonuses || typeof bonuses !== 'object' || Array.isArray(bonuses))
      throw new TypeError(`${label} field=${group} must be an object.`);

    for (const attribute of Object.keys(bonuses))
      if (!Object.hasOwn(ATTRIBUTE_NAMES, attribute))
        throw new TypeError(`${label} field=${group} unsupported attribute: ${attribute}.`);
  }

  validateFieldValues(skill, fields, label);
}

/**
 * Enforces referential integrity and shape rules for a canonical catalog.
 */
export function validateCanonicalCatalog(catalog: CanonicalCatalog): void {
  const validWeaponHands = new Set(['mh', 'oh', 'mh+oh', '2h', '-']);
  for (const [weapon, wielding] of catalog?.weaponHands || []) {
    if (!catalog.weapons?.has(weapon)) {
      throw new Error(`Weapon hand metadata references unknown weapon ${weapon}.`);
    }

    if (!validWeaponHands.has(wielding)) {
      throw new Error(`Weapon ${weapon} has invalid wielding metadata ${wielding}.`);
    }
  }

  // Selected and patched catalogs retain the same profile identity and trait-reference contract.
  const profileIds = new Set<SkillId>();
  const procRateIds = new Set<string>();
  for (const profile of catalog.balanceProfiles) {
    if (profileIds.has(profile.id)) {
      throw new TypeError(`Duplicate balance profile id: ${String(profile.id)}`);
    }

    profileIds.add(profile.id);

    if (!String(profile.name || '')) {
      throw new TypeError(`Balance profile ${String(profile.id)} has no name.`);
    }

    // Proc declarations compose with Core/elite catalogs and must not silently share an override key.
    if (profile.procRate) {
      const { id: procRateId, traitId, field, opportunity } = profile.procRate;
      const chance = profile[field];

      if (
        !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(procRateId) ||
        procRateIds.has(procRateId) ||
        !catalog.traits.some((trait) => trait.id === traitId) ||
        !opportunity ||
        typeof chance !== 'number' ||
        !Number.isFinite(chance) ||
        chance < 0 ||
        chance > 1
      ) {
        throw new TypeError(`Balance profile ${String(profile.id)} has an invalid or duplicate procRate declaration.`);
      }

      procRateIds.add(procRateId);
    }

    // Profiles obey their selected profession's declarations on authored and patched catalogs alike.
    for (const field of Object.keys(profile))
      if (!Object.hasOwn(catalog.profileFields, field))
        throw new TypeError(`Profile ${profile.id} has unsupported field: ${field}.`);
    validateSkillTuning(profile, catalog.profileFields, `profile=${profile.id}`);
    for (const effect of profile.effects ?? []) validateEffectReactions(catalog, profile, effect);
  }

  const ids = new Set();
  for (const skill of catalog?.skills || []) {
    if (skill.id === undefined || skill.id === null || ids.has(skill.id)) {
      throw new Error(`Duplicate or missing skill id: ${skill.id}`);
    }

    ids.add(skill.id);

    if (!String(skill.name || '')) throw new Error(`Skill ${skill.id} has no name.`);

    validateSkillDeclarations(catalog, skill);
    for (const reference of [skill.parentId, skill.flipParentId]) {
      if (reference != null && !catalog.skillsById.has(reference)) {
        throw new Error(`Skill ${skill.id} references missing parent ${reference}.`);
      }
    }

    // Weapon validation only runs when the catalog declares a weapon set; professions
    // that don't restrict weapons leave the set empty and skip this check.
    if (skill.weapon && catalog.weapons.size && !catalog.weapons.has(skill.weapon)) {
      throw new Error(`Skill ${skill.id} uses invalid weapon ${skill.weapon}.`);
    }

    if (
      skill.slot != null &&
      !Number.isInteger(Number(skill.slot)) &&
      !/^(?:Weapon_[1-5]|Profession_[1-5]|Heal|Utility|Elite|Action)$/.test(String(skill.slot))
    ) {
      throw new Error(`Skill ${skill.id} has invalid slot metadata.`);
    }
  }

  // Track catalog identities separately so duplicate trait definitions fail fast.
  const seenTraitIds = new Set();
  for (const trait of catalog?.traits || []) {
    if (trait.id === undefined || trait.id === null || seenTraitIds.has(trait.id)) {
      throw new Error(`Duplicate or missing trait id: ${trait.id}`);
    }

    if (!String(trait.name || '')) {
      throw new Error(`Trait ${trait.id} has no name.`);
    }

    seenTraitIds.add(trait.id);
  }

  const specializationIds = new Set();
  for (const specialization of catalog?.specializations || []) {
    if (specialization.id === undefined || specialization.id === null || specializationIds.has(specialization.id)) {
      throw new Error(`Duplicate or missing specialization id: ${specialization.id}`);
    }

    if (!String(specialization.name || '')) {
      throw new Error(`Specialization ${specialization.id} has no name.`);
    }

    specializationIds.add(specialization.id);
  }
}

/**
 * Validate and normalize one declared skill before immutable catalog indexing. The closed skill types reject unknown
 * and misspelled fields at compile time; this checks the values those types cannot express.
 */
export function normalizeSkill<TSkill extends Skill>(source: TSkill): TSkill {
  const id = source.id;
  validateDurationFields(source, `skill=${id}`);

  // Input observations accept only canonical control identifiers.
  if (source.inputControl != null && !INPUT_CONTROL_IDS.includes(source.inputControl))
    throw new TypeError(`Skill ${id} has invalid inputControl.`);

  // Direct catalog consumers must enforce ownership even without a profession-specific normalizer.
  validateComboOwnership(source, `Skill ${id} (${source.name})`);
  const quicknessCastTimeMs = source.quicknessCastTimeMs == null ? null : Number(source.quicknessCastTimeMs);

  if (quicknessCastTimeMs != null && (!(quicknessCastTimeMs >= 0) || !Number.isFinite(quicknessCastTimeMs))) {
    throw new TypeError(`Skill ${id} has an invalid quicknessCastTimeMs.`);
  }

  // Only summon metadata supplies quicknessCastTimeMs and needs a derived base duration.
  const castTimeMs = Number(
    source.castTimeMs ?? (quicknessCastTimeMs == null ? 0 : quicknessCastTimeMs * QUICKNESS_ACTION_RATE)
  );

  if (!(castTimeMs >= 0) || !Number.isFinite(castTimeMs)) {
    throw new TypeError(`Skill ${id} requires a non-negative finite castTimeMs.`);
  }

  const interruptCommitMs = source.interruptCommitMs == null ? null : Number(source.interruptCommitMs);

  if (interruptCommitMs != null && (!(interruptCommitMs >= 0) || !Number.isFinite(interruptCommitMs))) {
    throw new TypeError(`Skill ${id} has an invalid interruptCommitMs.`);
  }

  // Commit is the safe default; only explicitly classified channels retain packets individually.
  const interruptMode = source.interruptMode == null ? 'commit' : String(source.interruptMode);

  if (interruptMode !== 'commit' && interruptMode !== 'per-packet') {
    throw new TypeError(`Skill ${id} has invalid interruptMode "${interruptMode}".`);
  }

  const effects = normalizeSkillEffects(source.effects || [], `skill=${id}`);
  const modifiers = source.modifiers == null ? undefined : normalizeSkillModifiers(source.modifiers, `Skill ${id}`);

  // A cost names one resource and one amount; the `cost.amount` field declaration bounds the value.
  if (
    source.cost != null &&
    (Object.keys(source.cost).some((key) => !['resource', 'amount', 'spendOn'].includes(key)) ||
      typeof source.cost.amount !== 'number')
  )
    throw new TypeError(`Skill ${id} has an invalid cost declaration.`);

  // Reject obsolete or misspelled task anchors before scheduling can silently choose the full cast end.
  if (!Array.isArray(source.tasks ?? [])) throw new TypeError(`Skill ${id} tasks must be an array.`);

  for (const task of source.tasks ?? [])
    if (
      !task ||
      typeof task.type !== 'string' ||
      (task.timingAnchor != null && !['castStart', 'castEnd', 'castCommit'].includes(task.timingAnchor))
    )
      throw new TypeError(`Skill ${id} has an invalid task.`);

  // Declarative activation phases and variant selectors must be executable before they enter a live catalog.
  if (!Array.isArray(source.sideEffects ?? [])) throw new TypeError(`Skill ${id} side effects must be an array.`);

  for (const sideEffect of source.sideEffects ?? []) {
    if (
      !sideEffect ||
      !['castStart', 'castCommit'].includes(sideEffect.on) ||
      typeof sideEffect.do?.type !== 'string' ||
      Array.isArray(sideEffect.do) ||
      (sideEffect.when != null && typeof sideEffect.when !== 'function') ||
      (sideEffect.order != null && !Number.isFinite(sideEffect.order))
    )
      throw new TypeError(`Skill ${id} has an invalid side effect.`);
  }

  if (!Array.isArray(source.effectVariants ?? [])) throw new TypeError(`Skill ${id} effect variants must be an array.`);

  for (const variant of source.effectVariants ?? []) {
    if (
      !variant ||
      typeof variant.when !== 'function' ||
      (variant.profileId == null && typeof variant.transform !== 'function') ||
      (variant.transform != null && typeof variant.transform !== 'function')
    )
      throw new TypeError(`Skill ${id} has an invalid effect variant.`);
  }

  // Every persistent effect needs an explicit launch cutoff, either on itself
  // or inherited from the skill, before future packets may survive an interrupt.
  if (
    effects.some(
      (effect) =>
        effect.persistsAfterInterrupt === true && effect.interruptCommitMs == null && interruptCommitMs == null
    )
  ) {
    throw new TypeError(`Skill ${id} retains future packets but has no interruptCommitMs.`);
  }

  if (source.retainsCastLockoutAfterInterrupt != null && typeof source.retainsCastLockoutAfterInterrupt !== 'boolean') {
    throw new TypeError(`Skill ${id} has an invalid retainsCastLockoutAfterInterrupt.`);
  }

  // Actor-owned recharge must explicitly opt out of player cast completion.
  if (source.rechargeOwner != null && source.rechargeOwner !== 'actor')
    throw new TypeError(`Skill ${id} has invalid rechargeOwner.`);

  if (source.rechargeAnchor != null && !RECHARGE_ANCHORS.has(source.rechargeAnchor)) {
    throw new TypeError(`Skill ${id} has invalid rechargeAnchor ` + `"${source.rechargeAnchor}".`);
  }

  // A cast-scaled recharge boundary must stay inside the selected interval.
  if (
    source.rechargeProgress != null &&
    (typeof source.rechargeProgress !== 'number' ||
      !Number.isFinite(source.rechargeProgress) ||
      source.rechargeProgress < 0 ||
      source.rechargeProgress > 1)
  )
    throw new TypeError(`Skill ${id} requires rechargeProgress between zero and one.`);

  const rechargeOffsetMs = Number(source.rechargeOffsetMs ?? 0);

  // Negative offsets start recharge before the selected anchor; cast execution clamps the result to cast start.
  if (!Number.isFinite(rechargeOffsetMs)) {
    throw new TypeError(`Skill ${id} requires a finite rechargeOffsetMs.`);
  }

  const baseSkill = {
    ...source,
    castTimeMs,
    ...(rechargeOffsetMs ? { rechargeOffsetMs } : {}),
    ...(quicknessCastTimeMs == null ? {} : { quicknessCastTimeMs }),
    interruptMode,
    ...(interruptCommitMs == null ? {} : { interruptCommitMs }),
    lockouts: normalizeLockouts(source.lockouts, id)
  };
  const normalized: Partial<TSkill> = {
    ...baseSkill,
    effects,
    ...(modifiers ? { modifiers } : {}),
    ...(source.sideEffects
      ? {
          sideEffects: snapshotActionDeclaration(
            [...source.sideEffects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
            normalizeSkillEffects
          )
        }
      : {}),
    tags: Object.freeze([...(baseSkill.tags || [])])
  };
  // Assembly validates required shared fields below; profession fields retain their authored types.
  return normalized as TSkill;
}
