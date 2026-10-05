import { validateComboOwnership } from '#gw2/platform/combos/ownership.js';
import {
  validateActionIds,
  validateEffectReactions,
  validateSideEffectAction
} from '#gw2/platform/effects/action-validation.js';
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
import type { CanonicalCatalog, Skill, SkillId, SkillLockout } from '#gw2/platform/skills/types.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
/** Validate skill declarations and cross-catalog references before runtime selection. */

/** Reject retired or misspelled skill fields at the catalog boundary, including profession-owned authoring. */
const SKILL_FIELDS = new Set([
  'adrenalineCost',
  'affinityOnHit',
  'ambush',
  'ammo',
  'ammoCastLockout',
  'ammoRecharge',
  'armedAtStart',
  'arrowCost',
  'arrowsRestored',
  'artifactKind',
  'attunement',
  'aura',
  'autoattack',
  'backfire',
  'beastmodeSkill',
  'blade',
  'blightGain',
  'burst',
  'canCastConcurrently',
  'castTimeMs',
  'categories',
  'celestialAvatarSkill',
  'chainRoot',
  'chainStep',
  'clone',
  'comboFields',
  'comboFinishers',
  'conditionsTransferred',
  'consume',
  'consumes',
  'cooldown',
  'cost',
  'countsAsToolbeltSkill',
  'createsClone',
  'cycloneBowSkill',
  'damageAtMs',
  'defaultInterruptMs',
  'description',
  'dhuumfireDuration',
  'displayName',
  'dragonSlash',
  'dragonSlashImpactOffsetMs',
  'dragonSlashMaximumBurningDuration',
  'dragonSlashMaximumCoefficient',
  'dragonSlashMinimumBurningDuration',
  'dragonSlashMinimumCoefficient',
  'dragonTriggerSkill',
  'dualWieldCastTimeMs',
  'dualWieldOpener',
  'duration',
  'durationMultiplier',
  'effectVariants',
  'effects',
  'energyCost',
  'evades',
  'facet',
  'flipDelay',
  'flipDuration',
  'flipParent',
  'flipParentId',
  'requiresArmedFlip',
  'flipSkillId',
  'forgeSkill',
  'gunsaberSkill',
  'heatGain',
  'heatLoss',
  'hotkeyAction',
  'icon',
  'id',
  'impactDelay',
  'independentCast',
  'independentCastCanOverlap',
  'initialStateOnly',
  'initiativeCost',
  'inputCategory',
  'instrument',
  'interruptCommitMs',
  'interruptMode',
  'kitId',
  'kitTransition',
  'kneelSkill',
  'legendId',
  'lifeForceCost',
  'loadoutSkillId',
  'lockouts',
  'malicious',
  'manualReleaseCooldown',
  'maximumConditions',
  'maximumStacks',
  'mechanicSlot',
  'mesmerMechanic',
  // Mesmer skills own intrinsic summon, shatter, flip, and performance recipes.
  'flipArm',
  'phantasmTiming',
  'phantasmDisplayNames',
  'shatter',
  'mirrorPayload',
  'crescendoProfileId',
  'tale',
  'minimumShroudLifeForcePercent',
  'minionKey',
  'movementSkill',
  'name',
  'nextChainId',
  'overload',
  'paletteAction',
  'paletteFlip',
  'paletteFlipSkillId',
  'paletteTileId',
  'weaponVariantRootId',
  'paletteTileOrder',
  'parentCooldownIncrease',
  'parentId',
  'patchAuthoringExcluded',
  'peithaImpactAnchor',
  'peithaImpactDelayMs',
  'petAutonomousSkill',
  'petFamilySkill',
  'petNames',
  'petSkill',
  'phantasm',
  'phantasmSummonProgress',
  'player',
  'preservesStealth',
  'primalBurst',
  'pulseInterval',
  'quicknessCastTimeMs',
  'radiantForgeSkill',
  'radiantWeapon',
  'rechargeAnchor',
  'rechargeBuffAudience',
  'rechargeIgnoresAlacrity',
  'rechargeOffsetMs',
  'rechargeProgress',
  'rechargeOnMinionDeath',
  'rechargeReduction',
  'removedEffectKeys',
  'requiredMainHand',
  'requiredOffHand',
  'resource',
  'resourceCost',
  'resourceGain',
  'retainsCastLockoutAfterInterrupt',
  'selfStunMs',
  'shadowShroudSkill',
  'shadowShroudTransition',
  'shadowstepSkill',
  'shroud',
  'shroudEntry',
  'shroudExit',
  'shroudProfileId',
  'shroudSlot',
  'sideEffects',
  'simulatorExcluded',
  'skillFamily',
  'skillWeapon',
  'slot',
  'slotSelectable',
  'spearStealthAttack',
  'specialization',
  'starvationCooldown',
  'stealRechargeMode',
  'stealTraitSkill',
  'stealthAttack',
  'stunbreak',
  'summonAttack',
  'summonDuration',
  'summonInterval',
  'summons',
  'tags',
  'tasks',
  'tome',
  'toolbeltParentId',
  'trackedHitDamage',
  'triggerIntervalMs',
  'type',
  'unleashedAmbushSkill',
  'unleashedPetSkill',
  'upkeepConsumeByLegendId',
  'upkeepCost',
  'upkeepPulse',
  'usableInShroud',
  'usableWhileRecharging',
  'variantBadge',
  'vulnerability',
  'weapon',
  'weaponBarChainRootId',
  'weaponBarChainStep',
  'windForceApplyMs',
  'windForceGain'
]);

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
  // Stable cast action identities and owner validators use the actual authored execution stage.
  validateActionIds(
    (skill.sideEffects ?? []).map((rule) => rule.do),
    `Skill ${skill.id} casts`
  );
  for (const { do: action, on } of skill.sideEffects ?? []) {
    validateSideEffectAction(catalog, skill, action, on);
  }

  for (const effect of skill.effects ?? []) validateEffectReactions(catalog, skill, effect);
  for (const variant of skill.effectVariants ?? [])
    if (variant.profileId != null && !catalog.balanceProfilesById.has(variant.profileId))
      throw new TypeError(`Skill ${skill.id} effect variant references missing profile ${variant.profileId}.`);
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

  for (const profile of catalog.balanceProfiles)
    for (const effect of profile.effects ?? []) validateEffectReactions(catalog, profile, effect);
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

/** Validate and normalize one merged skill before immutable catalog indexing. */
export function normalizeSkill<TSkill extends Skill>(
  id: SkillId,
  mergedSource: Partial<TSkill>,
  skillNormalizer?: (skill: Partial<TSkill>) => Partial<TSkill>
): TSkill {
  for (const field of Object.keys(mergedSource)) {
    if (!SKILL_FIELDS.has(field)) throw new TypeError(`Skill ${id} has unsupported field: ${field}.`);
  }

  const merged = skillNormalizer ? skillNormalizer(mergedSource) : mergedSource;
  // Direct catalog consumers must enforce ownership even without a profession-specific normalizer.
  validateComboOwnership(merged, `Skill ${id} (${merged.name})`);
  const quicknessCastTimeMs = merged.quicknessCastTimeMs == null ? null : Number(merged.quicknessCastTimeMs);
  if (quicknessCastTimeMs != null && (!(quicknessCastTimeMs >= 0) || !Number.isFinite(quicknessCastTimeMs))) {
    throw new TypeError(`Skill ${id} has an invalid quicknessCastTimeMs.`);
  }

  // Only summon metadata supplies quicknessCastTimeMs and needs a derived base duration.
  const castTimeMs = Number(
    merged.castTimeMs ?? (quicknessCastTimeMs == null ? 0 : quicknessCastTimeMs * QUICKNESS_ACTION_RATE)
  );
  if (!(castTimeMs >= 0) || !Number.isFinite(castTimeMs)) {
    throw new TypeError(`Skill ${id} requires a non-negative finite castTimeMs.`);
  }

  const interruptCommitMs = merged.interruptCommitMs == null ? null : Number(merged.interruptCommitMs);
  if (interruptCommitMs != null && (!(interruptCommitMs >= 0) || !Number.isFinite(interruptCommitMs))) {
    throw new TypeError(`Skill ${id} has an invalid interruptCommitMs.`);
  }

  // Commit is the safe default; only explicitly classified channels retain packets individually.
  const interruptMode = merged.interruptMode == null ? 'commit' : String(merged.interruptMode);
  if (interruptMode !== 'commit' && interruptMode !== 'per-packet') {
    throw new TypeError(`Skill ${id} has invalid interruptMode "${interruptMode}".`);
  }

  const effects = normalizeSkillEffects(merged.effects || [], `skill=${id}`);
  // Cost declarations select one payment owner and reject fields outside the canonical shape.
  if (
    merged.cost != null &&
    (typeof merged.cost !== 'object' ||
      Array.isArray(merged.cost) ||
      Object.keys(merged.cost).some((key) => !['resource', 'profileAmount', 'spendOn'].includes(key)) ||
      (merged.cost.spendOn != null && !['castStart', 'castCommit'].includes(merged.cost.spendOn)))
  )
    throw new TypeError(`Skill ${id} has an invalid cost declaration.`);
  // Reject obsolete or misspelled task anchors before scheduling can silently choose the full cast end.
  if (!Array.isArray(merged.tasks ?? [])) throw new TypeError(`Skill ${id} tasks must be an array.`);
  for (const task of merged.tasks ?? [])
    if (
      !task ||
      typeof task.type !== 'string' ||
      (task.timingAnchor != null && !['castStart', 'castEnd', 'castCommit'].includes(task.timingAnchor))
    )
      throw new TypeError(`Skill ${id} has an invalid task.`);

  // Declarative activation phases and variant selectors must be executable before they enter a live catalog.
  if (!Array.isArray(merged.sideEffects ?? [])) throw new TypeError(`Skill ${id} side effects must be an array.`);
  for (const sideEffect of merged.sideEffects ?? []) {
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

  if (!Array.isArray(merged.effectVariants ?? [])) throw new TypeError(`Skill ${id} effect variants must be an array.`);
  for (const variant of merged.effectVariants ?? []) {
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

  if (merged.retainsCastLockoutAfterInterrupt != null && typeof merged.retainsCastLockoutAfterInterrupt !== 'boolean') {
    throw new TypeError(`Skill ${id} has an invalid retainsCastLockoutAfterInterrupt.`);
  }

  if (merged.rechargeAnchor != null && !RECHARGE_ANCHORS.has(merged.rechargeAnchor)) {
    throw new TypeError(`Skill ${id} has invalid rechargeAnchor ` + `"${merged.rechargeAnchor}".`);
  }

  // A cast-scaled recharge boundary must stay inside the selected interval.
  if (
    merged.rechargeProgress != null &&
    (typeof merged.rechargeProgress !== 'number' ||
      !Number.isFinite(merged.rechargeProgress) ||
      merged.rechargeProgress < 0 ||
      merged.rechargeProgress > 1)
  )
    throw new TypeError(`Skill ${id} requires rechargeProgress between zero and one.`);

  const rechargeOffsetMs = Number(merged.rechargeOffsetMs ?? 0);
  if (!(rechargeOffsetMs >= 0) || !Number.isFinite(rechargeOffsetMs)) {
    throw new TypeError(`Skill ${id} requires a non-negative finite rechargeOffsetMs.`);
  }

  const baseSkill = {
    ...merged,
    castTimeMs,
    ...(rechargeOffsetMs ? { rechargeOffsetMs } : {}),
    ...(quicknessCastTimeMs == null ? {} : { quicknessCastTimeMs }),
    interruptMode,
    ...(interruptCommitMs == null ? {} : { interruptCommitMs }),
    lockouts: normalizeLockouts(merged.lockouts, id)
  };
  const normalized: Partial<TSkill> = {
    ...baseSkill,
    effects,
    ...(merged.sideEffects
      ? { sideEffects: Object.freeze([...merged.sideEffects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) }
      : {}),
    tags: Object.freeze([...(baseSkill.tags || [])])
  };
  // Assembly validates required shared fields below; profession fields retain their authored types.
  return normalized as TSkill;
}
