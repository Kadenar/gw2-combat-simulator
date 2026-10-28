import type { RotationActionKind } from '#gw2/integrations/logs/shared/rotation/model.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { canonicalGw2SkillId } from '#gw2/platform/skills/external-skill-ids.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import { VINDICATOR_DODGE_MS } from '#gw2/professions/revenant/data/vindicator-dodge.js';
import {
  resolveWarriorDualWieldSkill,
  warriorDualWieldingActive
} from '#gw2/professions/warrior/data/dual-wielding.js';

export type RotationCatalog = Pick<CanonicalCatalog, 'skills' | 'skillsById'>;

interface RecordedActionIdentity {
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
}

interface RotationCatalogContext {
  readonly catalog: RotationCatalog | null;
  readonly profile: RotationProfessionProfile;
}

export interface ResolvedRotationIdentity {
  readonly skill: Skill | null;
  readonly name: string;
  readonly skillId: SkillId;
}

/** Applies a catalog match after adapter-specific selection, preserving canonical or raw identity when unmatched. */
export function resolvedActionIdentity(action: RecordedActionIdentity, skill: Skill | null): ResolvedRotationIdentity {
  return {
    skill,
    name: skill?.name || action.canonicalName || action.rawName,
    skillId: skill?.id ?? action.canonicalSkillId ?? action.rawSkillId
  };
}

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
          Number(left.parentId != null) - Number(right.parentId != null)
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

/** Resolves external skill identities through the canonical catalog index. */
export function catalogSkillById(catalog: RotationCatalog | null, rawSkillId: number): Skill | null {
  if (!catalog) return null;

  const skillId = canonicalGw2SkillId(rawSkillId);
  return catalog.skillsById.get(skillId) ?? null;
}

/** Resolves and canonicalizes a recorded identity without depending on either combat-log format. */
export function findRotationSkill(
  rawSkillId: number,
  rawName: string,
  catalog: RotationCatalog | null,
  profile: RotationProfessionProfile
): Skill | null {
  if (!catalog) return null;

  const aliasedName = profile.skillNameAliases[normalizedName(rawName)] || rawName.trim();
  const aliasedSkillId = canonicalGw2SkillId(profile.skillIdAliases[rawSkillId] ?? rawSkillId);
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

/** Resolves either log format's action, preferring reconstruction-provided canonical identity. */
export function recordedActionSkill(action: RecordedActionIdentity, context: RotationCatalogContext): Skill | null {
  return findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile
  );
}

/** Resolve conditional cutoffs from the replay's equipped set, sharing the simulation's profession rule. */
export function createRotationSkillResolver(
  context: RotationCatalogContext & {
    readonly professionConfig?: Readonly<Record<string, unknown>>;
    readonly recordedActions: readonly (RecordedActionIdentity & {
      readonly start: number;
      readonly eventIndex: number;
    })[];
  }
): (
  action: RecordedActionIdentity & { readonly start: number; readonly eventIndex: number },
  skill?: Skill | null
) => Skill | null {
  // Only actual equipped-weapon swaps change the offhand; temporary profession bars do not.
  const swaps =
    context.profile.professionId === 'warrior'
      ? context.recordedActions.filter((action) => {
          const skill = recordedActionSkill(action, context);
          return (
            skill?.inputCategory === 'weapon-swap' ||
            ['swap weapons', 'weapon swap'].includes(normalizedName(action.rawName))
          );
        })
      : [];
  return (action, skill = recordedActionSkill(action, context)) => {
    // Core's shared input has no jump metadata; replay must occupy the same lane as Vindicator's runtime hook.
    if (context.profile.specializationId === 'vindicator' && skill?.id === SHARED_SKILL_IDS.DODGE)
      return { ...skill, castTimeMs: VINDICATOR_DODGE_MS };

    if (!skill || context.profile.professionId !== 'warrior') return skill;

    let activeSet = context.professionConfig?.startingWeaponSet === 2 ? 2 : 1;
    for (const swap of swaps) {
      if (swap.start < action.start || (swap.start === action.start && swap.eventIndex < action.eventIndex))
        activeSet = activeSet === 1 ? 2 : 1;
    }

    const resolved = resolveWarriorDualWieldSkill(skill, context.professionConfig, activeSet);
    const durationMs = Number(resolved.dualWieldCastTimeMs);
    // Wait projection must use the same active-offhand duration as replay or faster casts erase recorded idle gaps.
    return durationMs > 0 && warriorDualWieldingActive(context.professionConfig, activeSet)
      ? { ...resolved, castTimeMs: durationMs }
      : resolved;
  };
}

export function findNamedRotationSkill(
  name: string,
  catalog: RotationCatalog | null,
  profile: RotationProfessionProfile
): Skill | null {
  return findRotationSkill(Number.NaN, name, catalog, profile);
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

export function skillIdentity(
  skill: Skill | null,
  fallback: { readonly name: string; readonly skillId: SkillId }
): { readonly name: string; readonly skillId: SkillId } {
  return skill ? { name: skill.name, skillId: skill.id } : { name: fallback.name, skillId: fallback.skillId };
}
