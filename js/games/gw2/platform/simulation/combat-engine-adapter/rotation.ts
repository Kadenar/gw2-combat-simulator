/** Adapts editor mechanics into ordinary skills, effects and rotation entries; the engine has no UI command model. */
import { readCommands, rejectPreviewInput } from '#gw2/platform/simulation/combat-engine-adapter/input.js';
import type { AdaptedEngineRequest } from '#gw2/platform/simulation/combat-engine-adapter/input.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

type JsonObject = Record<string, unknown>;
const objects = (value: unknown) => (value ?? []) as JsonObject[];
const strings = (value: unknown) => (value ?? []) as string[];
const pair = (value: unknown) => (value ?? [0, 0]) as [number, number];

/** Pin authored action offsets before shortening a cast so a variant does not accelerate its remaining packets. */
function fixedTicks(source: JsonObject, quickness: boolean): JsonObject[] {
  const ticks = structuredClone(objects(source.skill_ticks));
  const duration = pair(source.cast_duration);
  for (const [field, action] of [
    ['pulse_on_tick_list', 'pulse'],
    ['strike_on_tick_list', 'strike'],
    ['whirl_finisher_on_tick_list', 'whirl_finisher']
  ]) {
    const lists = (source[field] ?? [[], []]) as number[][];
    const normalSpan = Math.max(duration[0], lists[0].at(-1) ?? 0);
    const quickSpan = Math.max(duration[1], lists[1].at(-1) ?? 0);
    for (const at of lists[0]) {
      ticks.push({
        on_tick: quickness && normalSpan > 0 ? Math.ceil((at * quickSpan) / normalSpan) : at,
        [action]: true,
        ...(action === 'strike'
          ? {
              weapon_type: source.weapon_type,
              flat_damage: source.flat_damage ?? 0,
              damage_coefficient: source.damage_coefficient ?? 0,
              can_critical_strike: source.can_critical_strike ?? true,
              num_targets: source.num_targets ?? 1,
              on_strike_effect_applications: source.on_strike_effect_applications ?? []
            }
          : action === 'pulse'
            ? { on_pulse_effect_applications: source.on_pulse_effect_applications ?? [] }
            : {})
      });
    }
  }

  return ticks.sort((a, b) => Number(a.on_tick) - Number(b.on_tick));
}

/** Existing hook predicates can follow variant identity through tags, without changing the engine's key comparisons. */
function adaptHookKeys(
  value: unknown,
  baseKeys: ReadonlySet<string>,
  variants: ReadonlyMap<string, string[]>
): unknown {
  if (Array.isArray(value)) return value.map((entry) => adaptHookKeys(entry, baseKeys, variants));
  if (!value || typeof value !== 'object') return value;
  const replacements: Readonly<Record<string, string>> = {
    only_applies_on_finished_casting_skill: 'only_applies_on_finished_casting_skill_with_tag',
    only_applies_on_begun_casting_skill: 'only_applies_on_begun_casting_skill_with_tag',
    only_applies_on_strikes_by_skill: 'only_applies_on_strikes_by_skill_with_tag'
  };
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (key === 'cooldown_modifiers') {
        // A recharge refund must reach the same synchronized copies as an ordinary cast's cooldown.
        return [
          key,
          objects(entry).flatMap((modifier) =>
            [String(modifier.skill_key), ...(variants.get(String(modifier.skill_key)) ?? [])].map((skill_key) =>
              adaptHookKeys({ ...modifier, skill_key }, baseKeys, variants)
            )
          )
        ];
      }

      return replacements[key] && typeof entry === 'string' && baseKeys.has(entry)
        ? [replacements[key], `adapter.base:${entry}`]
        : [key, adaptHookKeys(entry, baseKeys, variants)];
    })
  );
}

export function adaptRotation(
  build: JsonObject,
  rotation: readonly unknown[],
  skillKeys: ReadonlyMap<number, string>,
  catalog: ReadonlyMap<SkillId, Skill>,
  quickness: boolean
): {
  build: JsonObject;
  rotation: { skill_casts: JsonObject[] };
  commandSkills: AdaptedEngineRequest['commandSkills'];
  damageSources: AdaptedEngineRequest['damageSources'];
} {
  const commands = readCommands(rotation);
  const sourceSkills = new Map(objects(build.skills).map((skill) => [String(skill.skill_key), skill]));
  const skills: JsonObject[] = [];
  const effects: JsonObject[] = [];
  const casts: JsonObject[] = [];
  const metadata: Array<AdaptedEngineRequest['commandSkills'][number]> = [];
  const damageSources: Record<string, AdaptedEngineRequest['damageSources'][string]> = {};
  for (const [id, key] of skillKeys) damageSources[key] = { name: catalog.get(id)?.name ?? key, skillId: id };
  const variants = new Map<string, string[]>();
  let previousCast: JsonObject | undefined;
  let previousDuration = 0;
  let childSequence = 0;

  /** Off-target variants retain self/team effects and recursively remove hostile packets from their children. */
  const withoutTarget = (source: JsonObject, suffix: string): JsonObject => {
    const variant = structuredClone(source);
    variant.skill_key = `${String(source.skill_key)} ${suffix}`;
    variant.tags = [...strings(variant.tags), `adapter.base:${String(source.skill_key)}`];
    variant.strike_on_tick_list = [[], []];
    variant.whirl_finisher_on_tick_list = [[], []];
    const friendly = (value: unknown) =>
      objects(value).filter((effect) => effect.direction === 'SELF' || effect.direction === 'TEAM');
    variant.on_pulse_effect_applications = friendly(variant.on_pulse_effect_applications);
    variant.on_strike_effect_applications = [];
    const children = (keys: unknown) =>
      strings(keys).map((key) => {
        const child = sourceSkills.get(key);
        if (!child) rejectPreviewInput('content.skills', `Missing child skill ${key}.`);
        const copy = withoutTarget(child, suffix);
        skills.push(copy);
        return String(copy.skill_key);
      });
    variant.child_skill_keys = children(variant.child_skill_keys);
    variant.skill_ticks = objects(variant.skill_ticks).map((tick) => ({
      ...tick,
      strike: false,
      whirl_finisher: false,
      on_strike_effect_applications: [],
      on_pulse_effect_applications: friendly(tick.on_pulse_effect_applications),
      child_skill_keys: children(tick.child_skill_keys)
    }));
    return variant;
  };

  for (const [sourceIndex, command] of commands.entries()) {
    const path = `rotation[${sourceIndex}]`;
    const type = String(command.type);
    const id = typeof command.skillId === 'number' ? command.skillId : undefined;
    const baseKey = id === undefined ? undefined : skillKeys.get(id);
    const source = baseKey === undefined ? undefined : sourceSkills.get(baseKey);
    const authored = id === undefined ? undefined : catalog.get(id);
    if (type === 'cast' && (!source || !authored))
      rejectPreviewInput(`${path}.skillId`, `Unsupported skill ID ${String(command.skillId)}.`);
    const key = `adapter.command.${sourceIndex}:${baseKey ?? type}`;
    let variant: JsonObject;
    let duration = 0;
    let fullCastMs = 0;
    let cancelled = false;
    let remainingLaneDuration: number | undefined;
    if (source && authored && baseKey) {
      variant =
        command.offTarget === true ? withoutTarget(source, `[off-target ${sourceIndex}]`) : structuredClone(source);
      duration = pair(source.cast_duration)[quickness ? 1 : 0];
      fullCastMs = duration;
      variant.skill_ticks = fixedTicks(variant, quickness);
      for (const field of ['strike_on_tick_list', 'pulse_on_tick_list', 'whirl_finisher_on_tick_list'])
        variant[field] = [[], []];
      // Base skills retain passive modifiers once; aliases contain only the action and its conditions.
      for (const field of [
        'attribute_modifiers',
        'attribute_conversions',
        'counter_modifiers',
        'cooldown_modifiers',
        'effect_removals',
        'skill_triggers',
        'unchained_skill_triggers',
        'source_actor_skill_triggers'
      ])
        delete variant[field];
      if (command.interruptAfterMs !== undefined && Number(command.interruptAfterMs) < duration) {
        duration = Number(command.interruptAfterMs);
        const committed =
          authored.interruptMode !== 'per-packet' &&
          authored.interruptCommitMs !== undefined &&
          duration >= authored.interruptCommitMs;
        cancelled = authored.interruptMode !== 'per-packet' && !committed;
        variant.skill_ticks = committed
          ? variant.skill_ticks
          : authored.interruptMode === 'per-packet'
            ? objects(variant.skill_ticks).filter((tick) => Number(tick.on_tick) <= duration)
            : [];
        if (!committed) variant.child_skill_keys = [];
        if (authored.interruptMode !== 'per-packet' && !committed) variant.tags = [];
      }

      variant.cast_duration = [duration, duration];
      variant.tags = [...strings(variant.tags), ...(cancelled ? [] : [`adapter.base:${baseKey}`])];
      variants.set(baseKey, [...(variants.get(baseKey) ?? []), key]);
    } else {
      // A wait occupies the ordinary cast lane. A marker is an inert instant skill gated behind that lane.
      duration = type === 'wait' ? Number(command.durationMs) : 0;
      variant = {
        cast_duration: [duration, duration],
        cooldown: [0, 0],
        instant_cast_only_when_not_in_animation: true
      };
    }

    variant.skill_key = key;
    if (baseKey) {
      // Clone child packets per activation so overlapping casts retain their causal source in generic audits.
      const copyChildren = (parent: JsonObject, ancestry: string[]): void => {
        const children = (keys: unknown): string[] =>
          strings(keys).map((childKey) => {
            if (ancestry.includes(childKey)) rejectPreviewInput(path, 'Recursive child skill graph.');
            const child = skills.find((entry) => entry.skill_key === childKey) ?? sourceSkills.get(childKey);
            if (!child) rejectPreviewInput(path, `Missing child skill ${childKey}.`);
            const copy = structuredClone(child);
            // Child side effects would register again on the root actor; this content slice has packet-only children.
            if (
              Object.entries(copy).some(
                ([field, value]) =>
                  /_(?:modifiers|conversions|removals|triggers)$/.test(field) && Array.isArray(value) && value.length
              )
            )
              rejectPreviewInput(`${path}.skillId`, `Child skill ${childKey} has unsupported passive side effects.`);
            if (sourceSkills.has(childKey)) copy.tags = [...strings(copy.tags), `adapter.base:${childKey}`];
            const generatedKey = `${key}:child:${childSequence++}`;
            copy.skill_key = generatedKey;
            copy.attribute_damage_to_skill = generatedKey;
            copyChildren(copy, [...ancestry, childKey]);
            skills.push(copy);
            damageSources[generatedKey] = {
              ...damageSources[baseKey],
              name: String(child.attribute_damage_to_skill || childKey).replace(/ \[off-target \d+\]$/, ''),
              parentSkill: authored?.name ?? baseKey,
              sourceIndex
            };
            return generatedKey;
          });
        parent.child_skill_keys = children(parent.child_skill_keys);
        for (const tick of objects(parent.skill_ticks)) tick.child_skill_keys = children(tick.child_skill_keys);
      };

      copyChildren(variant, [baseKey]);
      variant.attribute_damage_to_skill = key;
      damageSources[key] = { ...damageSources[baseKey], sourceIndex };
    }

    // An ordinary instant action after an explicit wait must respect that wait's cast lane.
    if (commands[sourceIndex - 1]?.type === 'wait' || commands[sourceIndex - 1]?.concurrentOffsetMs !== undefined)
      variant.instant_cast_only_when_not_in_animation = true;
    skills.push(variant);
    metadata.push({
      sourceIndex,
      ...(id === undefined ? {} : { skillId: id }),
      skillKey: key,
      type,
      fullCastMs,
      interrupted: duration < fullCastMs,
      cancelledBeforeCommit: cancelled
    });
    if (command.concurrentOffsetMs !== undefined) {
      const offset = Number(command.concurrentOffsetMs);
      if (!previousCast || offset < 2 || (type === 'cast' && duration !== 0))
        rejectPreviewInput(
          `${path}.concurrentOffsetMs`,
          'Concurrent commands require a preceding cast, an offset of at least 2 ms, and an instant action.'
        );
      variant.instant_cast_only_when_not_in_animation = false;
      remainingLaneDuration = Math.max(0, previousDuration - offset);
      const markerKey = `${key}:ready`;
      // A one-tick self marker queues the instant skill on the original actor, preserving live ammo/weapon checks.
      const ticks = objects(previousCast.skill_ticks);
      ticks.push({
        on_tick: offset - 1,
        pulse: true,
        on_pulse_effect_applications: [
          {
            direction: 'SELF',
            base_duration_ms: 1,
            unique_effect: { unique_effect_key: markerKey }
          }
        ]
      });
      previousCast.skill_ticks = ticks.sort((a, b) => Number(a.on_tick) - Number(b.on_tick));
      effects.push({
        unique_effect_key: `${key}:trigger`,
        source_actor_skill_triggers: [
          {
            condition: { unique_effect_on_source: markerKey },
            skill_key: key
          }
        ]
      });
      // If the offset outlasts the preceding animation, an inert skill keeps later serial commands behind it.
      const fenceKey = `${key}:delay`;
      const delay = Math.max(0, offset - previousDuration + 2);
      skills.push({
        skill_key: fenceKey,
        cast_duration: [delay, delay],
        cooldown: [0, 0],
        instant_cast_only_when_not_in_animation: true
      });
      casts.push({ skill: fenceKey, cast_time_ms: 0 });
    } else casts.push({ skill: key, cast_time_ms: 0 });
    if (type === 'cast') {
      previousCast = variant;
      previousDuration = remainingLaneDuration ?? duration;
    } else if (type === 'wait') previousCast = undefined;
  }

  // Existing conditional groups synchronize ammo and cooldowns across each original and all of its cast variants.
  const groups = [
    ...objects(build.conditional_skill_groups),
    ...[...variants].map(([baseKey, keys]) => ({
      skill_key: `adapter.recharge:${baseKey}`,
      conditional_skill_keys: [baseKey, ...keys].map((skill_key) => ({ skill_key }))
    }))
  ];
  const taggedOriginals = [...sourceSkills].map(([key, skill]) => ({
    ...skill,
    // Every supported UI action needs a terminal castability report, including non-weapon utility skills.
    ...(damageSources[key]?.skillId === undefined ? {} : { executable: true }),
    tags: [...strings(skill.tags), `adapter.base:${key}`]
  }));
  const adapted = adaptHookKeys(
    {
      ...build,
      skills: [...taggedOriginals, ...skills],
      conditional_skill_groups: groups,
      permanent_unique_effects: [...objects(build.permanent_unique_effects), ...effects]
    },
    new Set(sourceSkills.keys()),
    variants
  ) as JsonObject;
  return { build: adapted, rotation: { skill_casts: casts }, commandSkills: metadata, damageSources };
}
