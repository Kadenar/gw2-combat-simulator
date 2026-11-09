/** Canonical Core ranger skill definitions grouped by their GW2 owner. */

import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { buildResolverBuff } from '#gw2/platform/effects/packet-builders.js';
import type { EffectReaction } from '#gw2/platform/effects/reactions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition, SkillId } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

const NATURES_STRENGTH = 'natures-strength';
const FORCE_OF_NATURE = 'force-of-nature';
const TAPPED_OUT = 'tapped-out';
const RESET_SKILLS: readonly SkillId[] = [ID.FLOURISH, ID.OAKEN_CUDGEL, ID.THISTLEGUARD, ID.WILD_STRIKES];

// Measured from 20261015-192637.zevtc with Quickness, rounded to the 40 ms action grid.
// Cast durations include normal recovery; impact offsets keep on-hit rewards ahead of that recovery.
export const RANGER_CORE_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.GERMINATE]: {
    name: 'Germinate',
    icon: 'https://render.guildwars2.com/file/A0B8C463DCB432B6FC5BDC3031A3F8B10C9B14B9/3256381.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 440,
    interruptCommitMs: 360,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.9, hits: 1 }
    ])
  },
  [ID.BURGEON]: {
    name: 'Burgeon',
    icon: 'https://render.guildwars2.com/file/632E78226233B20B4A16C2E42EC0280D470D2F09/3256382.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 440,
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1.1, hits: 1 }
    ])
  },
  [ID.CULTIVATE]: {
    name: 'Cultivate',
    icon: 'https://render.guildwars2.com/file/FCA9D855E86CAF0B069CB3FEC6F220125F164803/3256383.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 920,
    interruptCommitMs: 520,
    // Once the uppercut connects, cancelling its recovery does not release the player cast lane early.
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1.4, hits: 1, reactions: [naturesStrengthReaction()] },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 3,
        stacks: 1
      },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 }
    ])
  },
  [ID.FLOURISH]: {
    name: 'Flourish',
    icon: 'https://render.guildwars2.com/file/A3CAFE3F4F60F5BA30DBF3511AEF2EB03D75673E/3256384.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 800,
    interruptCommitMs: 480,
    // Once the ground is struck, its delayed bloom continues after the player leaves the cast.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        atMs: 480,
        name: 'Flourish - Initial Damage',
        reactions: [naturesStrengthReaction()]
      },
      { type: 'strike', coefficient: 1.275, hits: 1, atMs: 1480, name: 'Flourish - Delayed Damage' },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 4,
        stacks: 1,
        atMs: 480
      }
    ])
  },
  [ID.OAKEN_CUDGEL]: {
    name: 'Oaken Cudgel',
    icon: 'https://render.guildwars2.com/file/AF04C49117A8634CDDAA1AB3B35B25111B394FEC/3256385.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_3',
    cooldown: 12,
    // The leap remains 960 ms in this Quickness log; its animation is not accelerated.
    castTimeMs: 960,
    interruptCommitMs: 800,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 2, hits: 1, reactions: [naturesStrengthReaction()] },
      // Resolve the leap's stun alongside its impact so control-triggered effects can activate.
      { type: 'control', controlKind: CONTROL.STUN },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1
      }
    ])
  },
  [ID.THISTLEGUARD]: {
    name: 'Thistleguard',
    icon: 'https://render.guildwars2.com/file/D246F868FF56A5DA990D4C0593BC6FD4082456DD/3256386.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_4',
    cooldown: 12,
    castTimeMs: 280,
    interruptCommitMs: 240,
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1.2, hits: 1, reactions: [naturesStrengthReaction()] },
      { type: 'boon', boon: BOON.STABILITY, duration: 1, stacks: 1 }
    ])
  },
  [ID.WILD_STRIKES]: {
    name: 'Wild Strikes',
    icon: 'https://render.guildwars2.com/file/4063516E170663BE3C0B07A744F2A4A142E90FC3/3256387.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 1240,
    // Only the final surviving slam grants Nature's Strength; earlier slams survive a cancelled channel.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [280, 560, 800].map((atMs) => ({ atMs, coefficient: 0.85 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 1.7,
        hits: 1,
        atMs: 1200,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Wild Strikes - Final Slam Damage',
        reactions: [naturesStrengthReaction(2)]
      },
      {
        // The final slam disables its target, enabling control-triggered traits and relics.
        type: 'control',
        controlKind: CONTROL.DAZE,
        atMs: 1200,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
};

/** Only the authored qualifying hit grants stacks; secondary packets and pet attacks cannot advance the cycle. */
export function naturesStrengthReaction(stacks = 1): EffectReaction {
  return {
    on: 'damage.resolved',
    actor: ACTOR.PLAYER,
    packets: 'first',
    when: (_runtime, { event }) => Number(event.coefficient) > 0,
    do: [{ type: 'ranger.natures-strength', amount: stacks }]
  };
}

/** Force of Nature boosts the player's strikes across weapon swaps, without granting the bonus to pets. */
export const rangerForceOfNatureModifier: Gw2ModifierRule = {
  id: 'ranger.force-of-nature',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.1,
  when: (context) =>
    (context.event?.actorType === ACTOR.PLAYER || context.event?.ownerActorType === ACTOR.PLAYER) &&
    context.event.actorType !== ACTOR.SUMMON &&
    buffActive(context, FORCE_OF_NATURE)
};

/** Consume five live stacks on an eligible hit, reset mace recharge, then block gains through Force and Tapped Out. */
export const maceLifecycle = {
  // A reset earned at impact must survive the triggering cast's later recharge commitment.
  onCastCommit: preserveMaceImpactReset,
  onCastCancel: preserveMaceImpactReset,
  buffPolicies: () => [
    { kind: NATURES_STRENGTH, name: "Nature's Strength", maximumStacks: 5 },
    { kind: FORCE_OF_NATURE, name: 'Force of Nature', maximumStacks: 1 },
    { kind: TAPPED_OUT, name: 'Tapped Out', maximumStacks: 1 }
  ],
  sideEffectHandlers: {
    'ranger.natures-strength'(runtime, context, action) {
      if (context.kind !== 'effect') return;

      if (action.type !== 'ranger.natures-strength' || action.amount == null)
        throw new TypeError("Nature's Strength requires a stack grant.");

      if (
        runtime.combat.activeBuffStacks(FORCE_OF_NATURE, runtime.time) ||
        runtime.combat.activeBuffStacks(TAPPED_OUT, runtime.time)
      )
        return;

      runtime.effects.emit({
        kind: 'packet',
        event: buildResolverBuff({
          at: runtime.time,
          source: 'ranger',
          sourceId: context.skill.id,
          actorType: ACTOR.PLAYER,
          skillId: context.skill.id,
          skillName: "Nature's Strength",
          triggeredBy: context.skill.name,
          activationId: context.trigger.event.activationId,
          kind: NATURES_STRENGTH,
          duration: 25,
          stacks: sideEffectAmount(runtime, action.amount),
          audience: { recipients: RECIPIENT.SELF }
        })
      });
    }
  },
  reactions: {
    'buff.applied'(runtime, event) {
      // Cultivate and Rampant Growth may reach the cap, but only mace skills 2 through 5 can consume it.
      if (
        event.kind !== NATURES_STRENGTH ||
        !event.resolvedAudience?.includesSelf ||
        !RESET_SKILLS.includes(Number(event.skillId)) ||
        runtime.combat.activeBuffStacks(NATURES_STRENGTH, runtime.time) < 5
      )
        return;

      // Consume through the shared buff ledger so damage queries and observations see the same stack removal.
      runtime.combat.reviseBuffExpiry(
        NATURES_STRENGTH,
        () => true,
        (at) => Math.min(at, runtime.time)
      );
      for (const skillId of RESET_SKILLS) runtime.cooldownController.clear(skillId);
      // Queue Tapped Out at Force of Nature expiry, keeping stack gains blocked through both phases of the cycle.
      for (const [kind, name, at, duration, stacks] of [
        [FORCE_OF_NATURE, 'Force of Nature', runtime.time, 5, 1],
        [BOON.STABILITY, 'Force of Nature', runtime.time, 5, 5],
        [TAPPED_OUT, 'Tapped Out', runtime.time + 5, 10, 1]
      ] as const) {
        // State windows and their Stability grant share the skill's profile emission path.
        runtime.effects.emit({
          kind: 'profile',
          profile: requireSkill(runtime.helpers, event.skillId!),
          at,
          attribution: {
            source: 'ranger',
            sourceId: event.skillId!,
            actorType: ACTOR.PLAYER,
            skillId: event.skillId,
            skillName: name,
            triggeredBy: event.triggeredBy,
            activationId: event.activationId
          },
          effects: [{ type: 'buff', kind, duration, stacks, audience: { recipients: RECIPIENT.SELF } }],
          transform: (packet) => ({ ...packet, name })
        });
      }
    }
  }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

/** Match the actual triggering activation so later mace casts retain their own normal cooldowns. */
function preserveMaceImpactReset(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  if (
    RESET_SKILLS.includes(cast.skill.id) &&
    runtime.combat.buffApplications(FORCE_OF_NATURE).some((application) => application.event?.activationId === cast.id)
  )
    runtime.cooldownController.clear(cast.skill.id);
}
