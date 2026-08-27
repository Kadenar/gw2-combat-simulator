import type {
  BalanceProfile,
  Skill,
  SkillFragment,
  SkillHandlerStrategy,
  SkillId
} from '../../platform/engine/types.js';

export interface ProfessionModuleDataOptions<TContext extends object, TSkill extends Skill = Skill> {
  readonly skillMechanics: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly TSkill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly handlers?:
    | ReadonlyMap<string, SkillHandlerStrategy<TContext>>
    | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;
}

export type ProfessionWeaponHand = 'mh' | 'oh' | 'mh+oh' | '2h';

export interface ProfessionWeaponData {
  readonly weapons: readonly string[];
  readonly weaponHands: Readonly<Record<string, ProfessionWeaponHand>>;
}

/**
 * Defines the weapon catalog for a profession from a single source of truth.
 *
 * Object key insertion order determines the resulting `weapons` ordering.
 */
export function defineProfessionWeapons<const TWeaponHands extends Readonly<Record<string, ProfessionWeaponHand>>>(
  weaponHands: TWeaponHands
): ProfessionWeaponData {
  const frozenWeaponHands = Object.freeze({
    ...weaponHands
  });

  return Object.freeze({
    weapons: Object.freeze(Object.keys(frozenWeaponHands)),
    weaponHands: frozenWeaponHands
  });
}

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
