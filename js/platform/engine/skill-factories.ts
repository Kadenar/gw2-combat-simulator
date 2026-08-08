/**
 * The shared, engine-recognized part of a skill-mechanics fragment.
 *
 * Every property is optional because mechanics are merged with generated
 * catalog metadata later. Profession hooks may add their own typed properties
 * by passing a subtype of this definition.
 *
 * Times ending in `Ms` are milliseconds. Other durations are seconds.
 *
 * @typedef {object} SkillMechanicDefinition
 * @property {number} [id] Catalog skill id.
 * @property {string} [name] Display name.
 * @property {string} [description] Display description.
 * @property {string} [icon] Icon URL.
 * @property {string} [type] Skill type, such as `"Weapon"` or `"Utility"`.
 * @property {string | number} [slot] Canonical slot name or numeric slot.
 * @property {string} [weapon] Weapon name.
 * @property {string} [specialization] Required specialization name.
 * @property {number} [castTimeMs] Base cast duration in milliseconds.
 * @property {number} [quicknessCastTimeMs] Measured Quickness cast duration in
 * milliseconds; when omitted, the GW2 scheduler calculates it.
 * @property {readonly {group: string, durationMs: number}[]} [lockouts]
 * Skill-family availability lockouts applied at activation. Only skills
 * declaring the same group block one another.
 * @property {"castStart"|"castEnd"} [rechargeAnchor] Point from which recharge
 * begins. Defaults to cast completion.
 * @property {number} [rechargeOffsetMs] Fixed delay from the recharge anchor
 * before recharge begins.
 * @property {number} [cooldown] Recharge duration in seconds.
 * @property {number} [recharge] Legacy alias for `cooldown`.
 * @property {number} [ammo] Maximum charge count.
 * @property {number} [ammoRecharge] Per-charge recharge duration in seconds.
 * @property {number} [defaultInterruptMs] Default interruption point in
 * milliseconds.
 * @property {number} [paletteInterruptMs] Suggested interruption point when
 * adding the skill through the rotation palette's interrupt action.
 * @property {number} [interruptCommitMs] Minimum interrupted-cast duration
 * required for persistent effects to resolve.
 * @property {readonly object[]} [effects] Declarative effects created by
 * `effect-factories.js`. An empty array is valid for handler-only skills.
 * @property {string} [handlerId] Id of a handler registered in the canonical
 * catalog. The registered strategy explicitly augments or replaces declarative
 * effect scheduling; replacing strategies require an empty effects list.
 * @property {number} [parentId] Id of an existing parent skill.
 * @property {number | null} [flipParentId] Id of an existing flip parent.
 * @property {number | null} [flipSkillId] Id exposed after this skill is used.
 * @property {number} [nextChainId] Next skill id in an autoattack chain.
 * @property {readonly string[]} [tags] Searchable catalog tags.
 * @property {true} [implemented] Allowed when re-wrapping an already
 * implemented fragment; the factory always emits `true`.
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
 * @template {SkillMechanicDefinition} Definition
 * @param {Definition} definition Skill metadata/mechanics to mark implemented.
 * @returns {Definition & {implemented: true}}
 */
export const implemented = <Definition extends SkillFragment>(
  definition: Definition,
): Definition & { implemented: true } => ({
  ...definition,
  implemented: true,
});
import type { SkillFragment } from "./types.js";
