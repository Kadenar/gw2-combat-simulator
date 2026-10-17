import { BOON } from '#gw2/platform/effects/boons.js';
import { CONDITION } from '#gw2/platform/effects/conditions.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { conditionEffectTicks, effectFirstAtMs, strikeEffectCoefficient } from '#gw2/platform/effects/authoring.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
/** Owns Legendary Demon Stance skill fragments and its Unyielding Impact follow-up. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

// Align measured impacts and their attached effects on the nearest 40 ms action tick.
export const REVENANT_DEMON_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RESIST_THE_DARKNESS]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-upkeep' } }],
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDemon'
  },
  [ID.PAIN_ABSORPTION]: {
    // Grant the base boons without assuming any allied conditions were absorbed.
    castTimeMs: 360,
    cooldown: 0,
    energyCost: 30,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        audience: { recipients: 'party', maximumRecipients: 5 },
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.RESOLUTION,
        duration: 5,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.BANISH_ENCHANTMENT]: {
    // Banish Enchantment commits at 400 ms, preserving the launched multi-hit sequence after interruption.
    interruptCommitMs: 400,
    castTimeMs: 440,
    cooldown: 0,
    energyCost: 20,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 400 + index * 120, coefficient: 1.2 / 3 })),
        name: 'Banish Enchantment',
        actorType: 'player',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 400 + index * 120,
          condition: CONDITION.CHILLED,
          stacks: 1,
          duration: 1
        })),
        metadata: {},
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 400 + index * 120,
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 3
        })),
        metadata: {},
        actorType: 'player'
      }
    ]),
    legendId: 'LegendaryDemon'
  },
  [ID.CALL_TO_ANGUISH]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.UNYIELDING_IMPACT, durationSec: null } }],
    // Call to Anguish completes on its 800 ms impact, which also commits its effects.
    interruptCommitMs: 800,
    castTimeMs: 800,
    cooldown: 3,
    energyCost: 30,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 1.2,
          hits: 1,
          name: 'Call to Anguish',
          actorType: 'player',
          metadata: {}
        },
        {
          type: 'condition',
          condition: CONDITION.CHILLED,
          stacks: 1,
          duration: 2,
          actorType: 'player',
          metadata: {}
        },
        {
          type: 'control',
          actorType: 'player',
          controlKind: 'pull'
        }
      ]
    ),
    legendId: 'LegendaryDemon'
  },
  [ID.EMPOWERING_MISERY]: {
    castTimeMs: 520,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.EMBRACE_THE_DARKNESS]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.embrace-opening' } }
    ],
    // Shared upkeep owns the drain; upkeep-pulses.ts schedules the legend-owned payload below.
    castTimeMs: 440,
    interruptCommitMs: 400,
    cooldown: 3,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Embrace the Darkness',
        actorType: 'player',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 5,
        actorType: 'player',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 2,
        duration: 5,
        actorType: 'player',
        persistsAfterInterrupt: true,
        metadata: { trigger: 'empowered-upkeep-pulse' }
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.UNYIELDING_IMPACT]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.UNYIELDING_IMPACT } }],
    // The reviewed activation ends after the existing 560 ms impact packets.
    castTimeMs: 680,
    cooldown: 0,
    energyCost: 5,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Unyielding Impact',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 4,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]),
    legendId: 'LegendaryDemon'
  }
});

/** Demon follow-ups retain their specific denial before generic legend or resource gates. */
export function demonAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill
): AvailabilityResult | null {
  const flips = runtime.profession.core.availableFlips;
  const now = runtime.time;

  if (skill.id === ID.UNYIELDING_IMPACT && !skillFlipReady(flips[ID.UNYIELDING_IMPACT], now))
    return denySkillCast(skill, 'revenant.unyielding-impact-inactive', 'cast Call to Anguish first.');

  if (skill.id === ID.CALL_TO_ANGUISH && skillFlipReady(flips[ID.UNYIELDING_IMPACT], now))
    return denySkillCast(skill, 'revenant.unyielding-impact-ready', 'use Unyielding Impact first.');

  return null;
}

// Emit one Embrace the Darkness pulse; an armed empowered pulse selects the stronger Torment packet once.
export function embracePulse(runtime: RevenantRuntime, skill: RevenantSkill, at: number, empowered: boolean): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const torment = skill.effects?.find(
    (effect) =>
      effect.type === 'condition' && (effect.metadata?.trigger || '') === (empowered ? 'empowered-upkeep-pulse' : '')
  );

  if (strike?.type !== 'strike' || torment?.type !== 'condition')
    throw new Error('Embrace the Darkness is missing its pulse effects.');

  const tick = conditionEffectTicks(torment)[0];
  const common = {
    at,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name
  };
  runtime.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      ...common,
      name: skill.name,
      coefficient: strikeEffectCoefficient(strike),
      skillWeapon: 'Unequipped'
    })
  });
  runtime.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      ...common,
      // Label empowered applications in chart attribution while keeping the shared skill identity.
      name: empowered ? `${skill.name} — Empowered Torment` : `${skill.name} — Torment`,
      ...(torment.metadata ? { metadata: torment.metadata } : {}),
      condition: CONDITION.TORMENT,
      stacks: tick?.stacks || 0,
      duration: tick?.duration || 0
    })
  });
}

/** A committed Embrace activation lands its opening pulse at the authored offset, before drain begins. */
export function startRevenantEmbrace(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;

  if (activeRevenantUpkeep(runtime, skill.id)) return;

  const strike = skill.effects?.find((effect) => effect.type === 'strike');

  if (!strike) throw new Error('Embrace the Darkness is missing its strike effect.');

  embracePulse(runtime, skill, canonicalTime(cast.start + (effectFirstAtMs(strike) || 0) / 1000), false);
}

/** A committed paid skill, including Embrace's own activation, arms Embrace's next pulse. */
export function empowerRevenantEmbrace(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;

  if (skill.id === ID.RESIST_THE_DARKNESS) return;

  // Activation already enabled Embrace, so its cost query now describes a free toggle.
  if (skill.id !== ID.EMBRACE_THE_DARKNESS && !(revenantEnergyCost(runtime, skill) > 0)) return;

  const embrace = activeRevenantUpkeep(runtime, ID.EMBRACE_THE_DARKNESS);

  if (embrace) embrace.empoweredNextPulse = true;
}
