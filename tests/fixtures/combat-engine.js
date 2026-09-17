/**
 * Minimal synthetic encounters for the new combat engine's focused contracts.
 *
 * Builders emit the upstream gw2combat JSON shape with small, hand-checkable
 * numbers. They are profession neutral: the shared kernel must not rely on any
 * Guardian (or other profession) content to exercise a contract.
 */

/** Empty-handed weapon strength is the mean of 656..725. */
export const EMPTY_HANDED_STRENGTH = 690.5;

/** Armor that makes a coefficient-1 empty-handed strike deal exactly power / 2. */
export const HALF_POWER_ARMOR = 1381;

/** An instant skill with no recharge; overrides add mechanics. */
export function skill(key, overrides = {}) {
  return { skill_key: key, cast_duration: [0, 0], cooldown: [0, 0], ...overrides };
}

/** An instant empty-handed strike that cannot critically hit. */
export function flatStrike(key, flatDamage, overrides = {}) {
  return skill(key, {
    weapon_type: 'empty_handed',
    flat_damage: flatDamage,
    can_critical_strike: false,
    strike_on_tick_list: [[0], [0]],
    ...overrides
  });
}

/** Overrides default attribute pairs by name, since builds may not repeat an attribute. */
function mergeAttributes(defaults, overrides) {
  return [...new Map([...defaults, ...overrides])];
}

/** Builds a player-versus-target encounter; casts are `[skill, castTimeMs]` pairs or skill names at 0 ms. */
export function encounter({
  skills = [],
  casts = [],
  playerAttributes = [],
  playerBuild = {},
  targetAttributes = [],
  targetBuild = {},
  terminationConditions = [{ type: 'ROTATION', actor: 'player' }],
  ...rest
} = {}) {
  return {
    actors: [
      {
        name: 'player',
        team: 1,
        build: {
          attributes: mergeAttributes([['precision', 895]], playerAttributes),
          skills,
          ...playerBuild
        },
        rotation: {
          skill_casts: casts.map((cast) =>
            Array.isArray(cast) ? { skill: cast[0], cast_time_ms: cast[1] } : { skill: cast, cast_time_ms: 0 }
          )
        }
      },
      {
        name: 'golem',
        team: 2,
        build: {
          attributes: mergeAttributes(
            [
              ['max_health', 1_000_000_000],
              ['armor', HALF_POWER_ARMOR]
            ],
            targetAttributes
          ),
          ...targetBuild
        }
      }
    ],
    termination_conditions: terminationConditions,
    ...rest
  };
}

export const damageEvents = (result) => result.events.filter((event) => event.type === 'damage');
