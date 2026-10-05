import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { applyRangerWeaponSwapTraits } from '#gw2/professions/ranger/core/traits/behavior.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { cloudburstBlusterReset } from '#gw2/professions/ranger/specializations/galeshot/traits/behavior.js';
import type { RangerSkill, RangerRuntime } from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Explicit PvE skill mechanics owned by the Galeshot Ranger module. */

// Cyclone Bow entry and exit are state-selected variants of one F5 UI tile.
const CYCLONE_BOW_PALETTE_TILE = 'galeshot-cyclone-bow';
// Keen Shot flips to Hawkeye at full Wind Force without creating a second weapon tile.
const CYCLONE_BOW_ONE_PALETTE_TILE = 'galeshot-cyclone-bow-one';

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const GALESHOT_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WHIRLWIND]: {
    evades: true,
    effects: [],
    castTimeMs: 500
  },
  [ID.MISTRAL]: {
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      // Open the enhancement before restoring arrows, matching the activation ordering.
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.mistral' } },
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ],
    castTimeMs: 320,
    effects: [],
    arrowsRestored: 1
  },
  [ID.SUMMON_CYCLONE_BOW]: {
    // Change bars and notify shared swap observers only after commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.cyclone-bow-enter' } }],
    castTimeMs: 0,
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [],
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.PERFECT_STORM]: {
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2 }],
        name: 'Perfect Storm - Traveling Tornado Damage'
      },
      {
        type: 'strike',
        ticks: [680, 1200, 1720, 2240, 2760, 3280, 3800, 4320, 4840, 5360, 5880, 6400].map((atMs) => ({
          atMs,
          coefficient: 0.7
        })),
        name: 'Perfect Storm - Stationary Tornado Damage'
      },
      {
        type: 'control',
        atMs: 600,
        controlKind: 'launch'
      }
    ]),
    castTimeMs: 600,
    arrowsRestored: 2
  },
  [ID.WIND_SHEAR]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.DISMISS_CYCLONE_BOW]: {
    // Change bars and notify shared swap observers only after commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.cyclone-bow-dismiss' } }],
    castTimeMs: 0,
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.PIERCING_GALES]: {
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ],
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [480, 480, 520, 520, 600].map((atMs) => ({
          atMs,
          coefficient: 0.7
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6
      }
    ],
    castTimeMs: 640,
    arrowsRestored: 1
  },
  [ID.SOOTHING_BREEZE]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.KEEN_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 480, coefficient: 0.75 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 0,
    castTimeMs: 480
  },
  [ID.HAWKEYE]: {
    // An accepted Hawkeye attempt consumes Wind Force even when interrupted.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.hawkeye' } }],
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [800, 920, 1040, 1160, 1280].map((atMs) => ({
          atMs,
          coefficient: 1.36
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 0,

    castTimeMs: 880
  },
  [ID.BLUSTER]: {
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ],
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [520, 600, 640].map((atMs) => ({
          atMs,
          coefficient: 0.64
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 1,

    castTimeMs: 680,
    windForceGain: 1,
    windForceApplyMs: 480
  },
  [ID.FLEETING_ZEPHYR]: {
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ],
    evades: true,
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ],
    arrowCost: 1,

    castTimeMs: 520,
    windForceGain: 1,
    windForceApplyMs: 240
  },
  [ID.QUARRYS_PERIL]: {
    // Committed shortened casts retain Cloudburst's reset at their effective completion boundary.
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } },
      cloudburstBlusterReset
    ],
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      }
    ],
    arrowCost: 2,

    castTimeMs: 680,
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    windForceGain: 1,
    windForceApplyMs: 280
  },
  [ID.PELT]: {
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ],
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 1,

    castTimeMs: 680,
    windForceGain: 1,
    windForceApplyMs: 280
  },
  [ID.SUPERSONIC_ARROW]: {
    // Committed shortened casts retain Cloudburst's reset at their effective completion boundary.
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } },
      cloudburstBlusterReset
    ],
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ],
    arrowCost: 3,

    castTimeMs: 1000,
    windForceGain: 2,
    windForceApplyMs: 760
  }
});

/** Schedule at acceptance because authored tasks are registered too late for precommit Wind Force. */
export function scheduleWindForce(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const skill = cast.skill;
  if (!(Number(skill.windForceGain) > 0)) return;
  const at = canonicalTime(cast.start + Number(skill.windForceApplyMs ?? skill.castTimeMs) / 1000);
  if (!castWasInterrupted(cast) || at <= cast.effectiveEnd)
    runtime.schedule('ranger.wind-force', at, Number(skill.windForceGain));
}

/** Later projectiles consume this live window through the shared Mistral observer. */
export function activateMistral(runtime: RangerRuntime): void {
  galeshotState.from(runtime).mistralUntil = canonicalTime(
    runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.mistral), 'durationMultiplier')
  );
}

/** Keep bar state, dismiss-only resource clearing, chain reset, and swap notification ordered together. */
export function setCycloneBow(runtime: RangerRuntime, skill: Skill, active: boolean): void {
  const state = galeshotState.from(runtime);
  state.cycloneBowActive = active;
  if (!active) runtime.resourceController.replace('windForce', 0);
  resetAutoattackChains(runtime);
  runtime.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      { at: runtime.time, skillId: skill.id, skillName: skill.name, weaponSet: runtime.activeWeaponSet },
      'weapon_set'
    )
  });
  applyRangerWeaponSwapTraits(runtime, skill);
}

/** Piercing Gales reads live vulnerability in addition to the ordinary platform multiplier. */
export const piercingGalesModifier: Gw2ModifierRule = {
  id: 'ranger.piercing-gales-vulnerability',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  // Piercing Gales applies its own doubled vulnerability multiplier (2% per
  // stack) in addition to the standard vulnerability already baked into the
  // platform strikeMultiplier, effectively tripling the vulnerability bonus
  // for this skill.
  parameters: {
    baseFactor: 1,
    vulnerabilityPerStack: 0.02
  },
  factor: (context, _target, parameters) =>
    parameters.baseFactor +
    (context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) *
      parameters.vulnerabilityPerStack,
  when: (context) => Number(context.event?.skillId ?? context.skillId) === ID.PIERCING_GALES
};
