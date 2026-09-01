/**
 * Skill-mechanics authoring factory. Documents the engine-recognized
 * `SkillMechanicDefinition` shape and exposes `implemented()`, which marks a
 * hand-authored skill-mechanics fragment as implemented while passing through
 * profession-specific extensions untouched. Field validation happens later
 * during canonical catalog assembly.
 */

/**
 * The shared, engine-recognized part of a skill-mechanics fragment.
 *
 * Every property is optional because mechanics are merged with generated
 * catalog metadata later. Profession hooks may add their own typed properties
 * by passing a subtype of this definition.
 *
 * Times ending in `Ms` are milliseconds. Other durations are seconds.
 */

/**
 * Marks a skill-mechanics fragment as implemented.
 *
 * `definition` must be an object matching {@link SkillMechanicDefinition}.
 * There are no required properties: `implemented({})` is valid. The function
 * makes a new, shallow object, copies every own enumerable property unchanged,
 * and sets `implemented` to `true`. It does not freeze or runtime-validate the
 * fragment; canonical catalog assembly validates fields such as effects,
 * handler ids, parent ids, weapons, and slots.
 *
 * The generic preserves additional profession-specific properties and their
 * types. Those extensions are passed through for profession hooks; the shared
 * engine does not interpret them.
 *
 * @example A declarative strike skill
 * const skill = implemented({
 *   castTimeMs: 750,
 *   cooldown: 8,
 *   effects: [strike(1.5)],
 * });
 * // => { implemented: true, castTimeMs: 750, cooldown: 8, effects: [...] }
 *
 * @example A handler-only skill with a profession-specific resource cost
 * const resourceSkill = implemented({
 *   castTimeMs: 0,
 *   handlerId: "example.resource",
 *   resourceCost: 21,
 *   effects: [],
 * });
 * // `resourceCost` is retained for the profession handler.
 *
 * @example Layering a correction over generated/default mechanics
 * const corrected = implemented({
 *   ...defaults[skillId],
 *   castTimeMs: 500,
 *   effects: [condition("Burning", 1, 3)],
 * });
 * // Later properties follow normal object-spread rules and win.
 *
 * }
 */
export const implemented = <Definition extends SkillFragment>(
  definition: Definition
): Definition & { implemented: true } => ({
  ...definition,
  implemented: true
});
import type { SkillFragment } from '#gw2/platform/engine/types.js';
