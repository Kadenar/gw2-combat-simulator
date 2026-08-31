import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/types.js';
import type { RotationActionKind } from '#gw2/integrations/logs/lib/rotation/model.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/lib/rotation/profiles.js';

export type RotationCatalog = Pick<CanonicalCatalog, 'skills'> &
  Partial<Pick<CanonicalCatalog, 'skillsById' | 'skillsByName'>>;

export function normalizedName(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function activeSpecializationScore(skill: Skill, profile: RotationProfessionProfile): number {
  const specialization = normalizedName(skill.specialization);
  if (!specialization) return 1;
  if (specialization === normalizedName(profile.specializationName)) return 2;
  // Weaponmaster Training exposes elite-specialization weapons profession-wide.
  return normalizedName(skill.type) === 'weapon' ? 1 : 0;
}

function bestCandidate(candidates: readonly Skill[], profile: RotationProfessionProfile): Skill | null {
  return (
    [...candidates]
      .filter((skill) => activeSpecializationScore(skill, profile) > 0)
      .sort(
        (left, right) =>
          activeSpecializationScore(right, profile) - activeSpecializationScore(left, profile) ||
          Number(left.parentId != null) - Number(right.parentId != null) ||
          Number(right.implemented === true) - Number(left.implemented === true)
      )[0] || null
  );
}

function parentSkill(skill: Skill, catalog: RotationCatalog, profile: RotationProfessionProfile): Skill {
  if (skill.parentId == null) return skill;
  const parent = bestCandidate(
    catalog.skills.filter((candidate) => String(candidate.id) === String(skill.parentId)),
    profile
  );
  return parent || skill;
}

/** Resolves a recorded source identity to the active simulator catalog without depending on either log format. */
export function findRotationSkill(
  rawSkillId: number,
  rawName: string,
  catalog: RotationCatalog | null,
  profile: RotationProfessionProfile
): Skill | null {
  if (!catalog) return null;
  const aliasedName = profile.skillNameAliases[normalizedName(rawName)] || rawName.trim();
  const aliasedSkillId = profile.skillIdAliases[rawSkillId] ?? rawSkillId;
  const byId = bestCandidate(
    catalog.skills.filter((skill) => typeof skill.id === 'number' && Number(skill.id) === aliasedSkillId),
    profile
  );
  if (byId) return parentSkill(byId, catalog, profile);
  const byName = bestCandidate(
    catalog.skills.filter((skill) => normalizedName(skill.name) === normalizedName(aliasedName)),
    profile
  );
  return byName ? parentSkill(byName, catalog, profile) : null;
}

export function findNamedRotationSkill(
  name: string,
  catalog: RotationCatalog | null,
  profile: RotationProfessionProfile
): Skill | null {
  return findRotationSkill(Number.NaN, name, catalog, profile);
}

export function isDirectPlayerSkill(skill: Skill): boolean {
  if (skill.simulatorExcluded === true || skill.parentId != null) return false;
  const type = normalizedName(skill.type);
  const slot = normalizedName(skill.slot);
  return (
    ['action', 'elite', 'heal', 'profession', 'utility', 'weapon'].includes(type) ||
    /^(downed|elite|heal|profession|utility|weapon)/.test(slot)
  );
}

export function actionKind(skill: Skill | null, name: string): RotationActionKind {
  const normalizedActionName = normalizedName(name);
  if (normalizedActionName === 'swap weapons') return 'weapon-swap';
  if (normalizedActionName.includes('dodge') || normalizedActionName === 'mirage cloak') return 'dodge';

  const type = normalizedName(skill?.type);
  if (type === 'weapon') return 'weapon-skill';
  if (type === 'profession') return 'profession-skill';
  if (type === 'utility') return 'utility';
  if (type === 'heal') return 'heal';
  if (type === 'elite') return 'elite';
  if (type === 'action') return 'action';
  return 'unknown';
}

export function effectWindowMs(skill: Skill): number {
  let maximum = 0;
  for (const effect of skill.effects || []) {
    const at = Math.max(0, Number(effect.atMs || 0));
    const applications = Math.max(1, Number(effect.applications || 1));
    const interval = Math.max(0, Number(effect.intervalMs || 0));
    const lastTickAt = Array.isArray(effect.ticks)
      ? Math.max(0, ...effect.ticks.map((tick) => Number(tick.atMs || 0)))
      : 0;
    maximum = Math.max(maximum, lastTickAt, at + (applications - 1) * interval);
  }

  return Math.max(100, Math.min(maximum + 100, 10_000));
}

export function skillIdentity(
  skill: Skill | null,
  fallback: { readonly name: string; readonly skillId: SkillId }
): { readonly name: string; readonly skillId: SkillId } {
  return skill ? { name: skill.name, skillId: skill.id } : { name: fallback.name, skillId: fallback.skillId };
}
