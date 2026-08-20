import type { SkillId } from '../../platform/engine/types.js';

export interface FlipSkillLike {
  readonly id: SkillId;
  readonly flipSkillId?: SkillId | null;
  readonly nextChainId?: SkillId | null;
}

export interface CreateFlipParentMapOptions<TSkill extends FlipSkillLike> {
  /**
   * Optional profession-specific filter.
   *
   * Returning false prevents the parent/child relationship from being added.
   */
  readonly include?: (parent: TSkill, child: TSkill) => boolean;

  /**
   * Explicit child -> parent relationships.
   *
   * Overrides are applied after automatically discovered relationships and
   * therefore take precedence.
   */
  readonly overrides?: ReadonlyMap<SkillId, SkillId>;
}

/**
 * Builds the reverse lookup used by catalog normalization:
 *
 *   child skill id -> parent skill id
 *
 * A flip is only considered when:
 * - the parent declares a flipSkillId,
 * - the child exists in the supplied skill collection, and
 * - the flip is not the skill's ordinary next-chain link.
 *
 * Professions with additional rules can provide an include predicate and/or
 * explicit overrides.
 */
export function createFlipParentMap<TSkill extends FlipSkillLike>(
  skills: readonly TSkill[],
  { include, overrides }: CreateFlipParentMapOptions<TSkill> = {}
): Map<SkillId, SkillId> {
  const byId = new Map<SkillId, TSkill>(skills.map((skill) => [skill.id, skill]));

  const parents = new Map<SkillId, SkillId>();

  for (const parent of skills) {
    const childId = parent.flipSkillId;

    if (childId == null) continue;
    if (childId === parent.nextChainId) continue;

    const child = byId.get(childId);

    if (!child) continue;

    if (include && !include(parent, child)) {
      continue;
    }

    parents.set(childId, parent.id);
  }

  for (const [childId, parentId] of overrides || []) {
    parents.set(childId, parentId);
  }

  return parents;
}

/**
 * Converts specialization mechanic maps into specialization-only skill lists.
 *
 * Example:
 *
 * {
 *   Berserker: {
 *     123: {...},
 *     456: {...}
 *   }
 * }
 *
 * becomes:
 *
 * {
 *   Berserker: [123, 456]
 * }
 */
export function createSpecializationSkillIds<TMechanic>(
  mechanicsBySpecialization: Readonly<Record<string, Readonly<Record<string, TMechanic>>>>
): Readonly<Record<string, readonly SkillId[]>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanicsBySpecialization).map(([owner, mechanics]) => [
        owner,
        Object.freeze(Object.keys(mechanics).map(Number))
      ])
    )
  );
}

/**
 * Creates the reverse specialization ownership lookup expected by
 * createNativeModuleData:
 *
 *   skill id -> specialization name
 */
export function createSpecializationSkillOwners(
  skillsBySpecialization: Readonly<Record<string, readonly SkillId[]>>
): Readonly<Record<string, string>> {
  const owners: Record<string, string> = {};

  for (const [owner, skillIds] of Object.entries(skillsBySpecialization)) {
    for (const skillId of skillIds) {
      owners[String(skillId)] = owner;
    }
  }

  return Object.freeze(owners);
}
