import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { isGw2WeaponSkillEquipped } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { AnyNativeModule } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import type { NativePatchAuthoringMetadata } from '#gw2/integrations/patches/authoring/module-types.js';
import type { ProfessionPatchPreview } from '#gw2/integrations/patches/authoring/patches.js';

/** Limit authored notes to selected traits, equipped weapons and skills, and effects observed in either comparison. */
export function buildRelevantPatch(
  patch: ProfessionPatchPreview,
  config: Gw2Config,
  observedIds: readonly SkillId[],
  catalog: Readonly<CanonicalCatalog>,
  modules: readonly AnyNativeModule[],
  metadata: NativePatchAuthoringMetadata,
  weaponMatcher?: Gw2WeaponSkillMatcher
): ProfessionPatchPreview {
  const traits = new Set(config.selectedTraitIds);
  const relevantIds = new Set([...selectedSkillIdSet(config.selectedSkillIds), ...observedIds, ...traits]);
  for (const skill of catalog.skills) {
    if (
      skill.type === 'Weapon' &&
      skill.weapon &&
      [1, 2].some(
        (weaponSet) =>
          gw2ConfiguredWeaponSet(config, weaponSet === 2 ? 2 : 1).some(Boolean) &&
          isGw2WeaponSkillEquipped(
            { config, weaponSet, specialization: config.specialization, catalog },
            skill,
            weaponMatcher
          )
      )
    )
      relevantIds.add(skill.id);
  }

  const selectedModules = new Set(['Core', config.specialization ?? 'Core']);
  const profileOwners = new Map<SkillId, SkillId>();
  const modifierOwners = new Map<string, SkillId>();
  // Intrinsic rules inherit skill relevance instead of appearing for every build using the owning module.
  const skillModifierOwners = new Map<string, SkillId>();
  for (const skill of catalog.skills) {
    for (const rule of [
      ...(skill.modifiers ?? []),
      ...(skill.effects ?? []).flatMap((effect) => (effect.type === 'strike' ? (effect.modifiers ?? []) : []))
    ])
      skillModifierOwners.set(rule.id, skill.id);
  }

  for (const module of modules) {
    for (const trait of module.traitDefinitions ?? []) {
      if (trait.balance) profileOwners.set(trait.balance.id ?? trait.id, trait.id);
      for (const profile of trait.profiles ?? []) profileOwners.set(profile.id, trait.id);
      for (const rule of trait.modifierRules ?? []) modifierOwners.set(rule.id, trait.id);
    }
  }

  const profileIds = new Set<string>();
  const ruleIds = new Set<string>();
  for (const module of metadata.modules) {
    if (!selectedModules.has(module.id)) continue;
    for (const entry of [...module.balanceProfiles, ...module.skillVariants]) {
      const owner = profileOwners.get(entry.id);
      if (owner != null && !traits.has(owner)) continue;
      const parentId = entry.profile.parentId;
      if ((typeof parentId === 'string' || typeof parentId === 'number') && !relevantIds.has(parentId)) continue;
      if (entry.profile.profileKind === 'trait' && owner == null && !relevantIds.has(entry.id)) continue;
      profileIds.add(String(entry.id));
      profileIds.add(entry.name);
    }

    for (const rule of module.modifierRules) {
      const skillOwner = skillModifierOwners.get(rule.id);
      if (skillOwner != null && !relevantIds.has(skillOwner)) continue;
      const owner = modifierOwners.get(rule.id);
      if (owner == null || traits.has(owner)) ruleIds.add(rule.id);
    }
  }

  const skillIds = new Set<string>();
  for (const id of relevantIds) {
    const skill = catalog.skillsById.get(id);
    if (!skill) continue;
    skillIds.add(String(id));
    skillIds.add(skill.name);
  }

  return {
    skills: Object.fromEntries(Object.entries(patch.skills ?? {}).filter(([id]) => skillIds.has(id))),
    balanceProfiles: Object.fromEntries(
      Object.entries(patch.balanceProfiles ?? {}).filter(([id]) => profileIds.has(id))
    ),
    modifierRules: Object.fromEntries(Object.entries(patch.modifierRules ?? {}).filter(([id]) => ruleIds.has(id)))
  };
}
