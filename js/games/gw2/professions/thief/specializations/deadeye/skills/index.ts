import { MODIFIER_TARGET, type Gw2ModifierRule, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/modifiers.js';
import type { DeadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefSimulationEvent } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { grantThiefEndurance } from '#gw2/professions/thief/core/mechanics/resources.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { deadeyeCastFacts } from '#gw2/professions/thief/specializations/deadeye/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';

/** Rewrites only poison durations, keeping each malicious attack's formula and other effects intact. */
function mapPoisonDurations(effects: readonly SkillEffect[], scaled: (duration: unknown) => number): SkillEffect[] {
  return effects.map((effect) =>
    effect.type !== 'condition'
      ? effect
      : effect.ticks?.length
        ? {
            ...effect,
            ticks: effect.ticks.map((tick) =>
              tick.condition === 'Poisoned' ? { ...tick, duration: scaled(tick.duration) } : tick
            )
          }
        : effect.condition === 'Poisoned'
          ? { ...effect, duration: scaled(effect.duration) }
          : effect
  );
}

// Share each impact's timing while preserving effect order and effect-local payloads.
export const DEADEYE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.STEAL_WARMTH]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, hits: 1, name: 'Steal Warmth', actorType: 'player' },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      { type: 'boon', boon: 'vigor', duration: 10, stacks: 1, audience: { recipients: 'party', maximumRecipients: 5 } },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 3, actorType: 'player' }
    ])
  },
  [ID.STEAL_RESISTANCE]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, hits: 1, name: 'Steal Resistance', actorType: 'player' },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      { type: 'condition', condition: 'Torment', stacks: 3, duration: 8, actorType: 'player' }
    ])
  },
  [ID.STEAL_PRECISION]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, hits: 1, name: 'Steal Precision', actorType: 'player' },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      { type: 'boon', boon: 'fury', duration: 8, stacks: 1, audience: { recipients: 'party', maximumRecipients: 5 } },
      { type: 'blind', actorType: 'player', duration: 6 }
    ])
  },
  [ID.STEAL_HEALTH]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, hits: 1, name: 'Steal Health', actorType: 'player' },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      { type: 'condition', condition: 'Bleeding', stacks: 5, duration: 8, actorType: 'player' }
    ])
  },
  [ID.STEAL_STRENGTH]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, hits: 1, name: 'Steal Strength', actorType: 'player' },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      { type: 'boon', boon: 'might', duration: 12, stacks: 5, audience: { recipients: 'party', maximumRecipients: 5 } },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 8, actorType: 'player' }
    ])
  },
  [ID.SHADOW_FLARE]: {
    // A committed Flare opens the follow-up through the shared flip lifecycle.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'flipArm',
          skillId: ID.SHADOW_SWAP,
          durationSec: { profile: PROFILE.shadowFlare, field: 'durationMultiplier' }
        }
      }
    ],
    castTimeMs: 480,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        // Scale the observed cast-end hit from cast start so Quickness preserves packet alignment.
        ticks: [{ atMs: 480, coefficient: 1 }],
        name: 'Shadow Flare',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BINDING_SHADOW]: {
    castTimeMs: 520,
    cooldown: 20,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Binding Shadow',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 15,
        duration: 10,
        actorType: 'player'
      }
    ])
  },
  [ID.MERCY]: {
    // The fixed reset belongs to the skill; Malice consumption and its scaled refund remain stateful.
    sideEffects: [
      { on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.DEADEYES_MARK] } },
      { on: 'castCommit', do: { type: 'thief.mercy' } }
    ],
    castTimeMs: 0,
    cooldown: 1,
    ammo: 2,
    ammoRecharge: 30,
    ammoCastLockout: 1,
    initiativeCost: 0,
    effects: []
  },
  [ID.STEAL_TIME]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Steal Time',
        actorType: 'player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      { type: 'condition', condition: 'Slow', stacks: 1, duration: 3, actorType: 'player' }
    ])
  },
  [ID.STEAL_DURABILITY]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, hits: 1, name: 'Steal Durability', actorType: 'player' },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      { type: 'condition', condition: 'Vulnerability', stacks: 10, duration: 5, actorType: 'player' }
    ])
  },
  [ID.DEADEYES_MARK]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.deadeyes-mark' } }],
    stealTraitSkill: true,
    movementSkill: true,

    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.STEAL_DEFENSES]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, hits: 1, name: 'Steal Defenses', actorType: 'player' },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      { type: 'boon', boon: 'aegis', duration: 5, stacks: 1, audience: { recipients: 'party', maximumRecipients: 5 } },
      { type: 'condition', condition: 'Poisoned', stacks: 2, duration: 8, actorType: 'player' }
    ])
  },
  [ID.MALICIOUS_DEATHS_JUDGMENT]: {
    castTimeMs: 600,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.67 }],
        name: "Malicious Death's Judgment — Packet 1",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Rifle',
    stealthAttack: true,
    malicious: true
  },
  [ID.STEAL_MOBILITY]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Sample Malice at acceptance; authored boons share their impact with the party.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, hits: 1, name: 'Steal Mobility', actorType: 'player' },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice >= 3
      },
      { type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1.5, actorType: 'player' }
    ])
  },
  [ID.MALICIOUS_RESTORATION]: {
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.SHADOW_MELD]: {
    // Clear Revealed before selecting the stealth grant; only commitment applies it.
    sideEffects: [
      { on: 'castStart', do: { type: 'thief.clear-revealed' } },
      { on: 'castCommit', do: { type: 'thief.stealth' } }
    ],

    castTimeMs: 440,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 25,
    ammoCastLockout: 5,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SHADOW_SWAP]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SHADOW_SWAP } }],
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Shadow Swap',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SHADOW_GUST]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }],
    castTimeMs: 360,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.4 }],
        name: 'Shadow Gust',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback'
      }
    ]
  },
  [ID.MALICIOUS_SURPRISE_SHOT]: {
    castTimeMs: 200,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Malicious Surprise Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]),
    requiredMainHand: 'Shortbow',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_SNEAK_ATTACK]: {
    // Only a completed channel emits the Torment using its accepted malice.
    sideEffects: [
      { on: 'castCommit', when: (_runtime, cast) => !castWasInterrupted(cast), do: { type: 'thief.sneak-torment' } }
    ],

    castTimeMs: 680,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 1.8 / 5 })),
        name: 'Malicious Sneak Attack',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 5,
          duration: 5,
          actorType: 'player'
        }
        // Malice-scaled Torment is emitted from its removable balance profile at completion.
      ])
    ],
    requiredMainHand: 'Pistol',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_BACKSTAB]: {
    castTimeMs: 440,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.5 }],
        name: 'Front damage',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Dagger',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_TACTICAL_STRIKE]: {
    castTimeMs: 440,
    cooldown: 1,
    initiativeCost: 0,
    // All companions resolve at cast completion; handlers retain stealth, control, and recipient rules.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 2, hits: 1, name: 'Malicious Tactical Strike', actorType: 'player' },
      { type: 'control', actorType: 'player', controlKind: 'daze' },
      { type: 'control', actorType: 'player', controlKind: 'daze' },
      { type: 'condition', condition: 'Vulnerability', stacks: 10, duration: 5, actorType: 'player' }
    ]),
    requiredMainHand: 'Sword',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_SHADOWSQUALL]: {
    // Transform the selected base packet so coefficient and duration patches remain authoritative.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, cast, effects) => {
          const malice = deadeyeCastFacts.get(cast)?.markedMalice ?? 0;
          const scaled = (duration: unknown) => Number(duration || 0) * (1 + 0.2 * malice);
          return mapPoisonDurations(effects, scaled);
        }
      }
    ],

    castTimeMs: 1680,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [200, 440, 640, 840, 1040, 1280, 1480, 1680].map((atMs) => ({ atMs, coefficient: 1.6 / 8 })),
        name: 'Malicious Shadowsquall',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Poisoned', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        duration: 2.5,
        stacks: 1
      }
    ],
    requiredMainHand: 'Scepter',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_HOOK_STRIKE]: {
    // Zero accepted marked malice suppresses Quickness; later malice changes cannot change this payload.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, cast, effects) => {
          const malice = deadeyeCastFacts.get(cast)?.markedMalice ?? 0;
          return effects.flatMap((effect): SkillEffect[] => {
            const quickness =
              (effect.type === 'boon' && String(effect.boon).toLowerCase() === 'quickness') ||
              (effect.type === 'buff' && effect.kind === 'quickness');
            return !quickness ? [effect] : malice > 0 ? [{ ...effect, duration: (effect.duration || 0) * malice }] : [];
          });
        }
      }
    ],

    castTimeMs: 0,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.65 }],
        name: 'Malicious Hook Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 0.75,
        stacks: 1
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockdown'
      }
    ],
    requiredMainHand: 'Staff',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_CUNNING_SALVO]: {
    // Transform the selected base packet so coefficient and duration patches remain authoritative.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, cast, effects) => {
          const malice = deadeyeCastFacts.get(cast)?.markedMalice ?? 0;
          const scaled = (duration: unknown) => Number(duration || 0) + malice;
          return mapPoisonDurations(effects, scaled);
        }
      }
    ],

    castTimeMs: 360,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Each accepted axe packet contributes one expiring ground axe.
        reactions: [{ on: 'damage.resolved', actor: 'player', packets: 'each', do: { type: 'thief.ground-axe' } }],
        coefficient: 1.5,
        hits: 1,
        name: 'Malicious Cunning Salvo',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]),
    requiredMainHand: 'Axe',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_ASHEN_ASSAULT]: {
    // Snapshot rewards commit before the shared lifecycle releases the acceptance facts.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.spear-chain' } },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'initiative',
          amount: { profile: PROFILE.maliciousAshenAssault, field: 'resourceGain' }
        }
      },
      {
        on: 'castCommit',
        when: (_runtime, cast) => (deadeyeCastFacts.get(cast)?.malice ?? 0) > 0,
        do: { type: 'thief.ashen-torment' }
      }
    ],
    effectVariants: [
      {
        when: () => true,
        transform: (runtime, cast, effects) => {
          const factor =
            1 +
            (deadeyeCastFacts.get(cast)?.malice ?? 0) *
              balanceProfileNumber(
                requireBalanceProfileFromContext(runtime, PROFILE.maliciousAshenAssault),
                'coefficientMultiplier'
              );
          return effects.map((effect) =>
            effect.type !== 'strike' || effect.name !== 'Malicious Ashen Assault — Final Strike'
              ? effect
              : effect.ticks?.length
                ? {
                    ...effect,
                    ticks: effect.ticks.map((tick) => ({ ...tick, coefficient: tick.coefficient * factor }))
                  }
                : { ...effect, coefficient: (effect.coefficient || 0) * factor }
          );
        }
      }
    ],
    preservesStealth: true,
    spearStealthAttack: true,

    castTimeMs: 400,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520, 680, 880].map((atMs) => ({
          atMs,
          coefficient: 1.5 / 5
        })),
        name: 'Malicious Ashen Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.3,
          hits: 1,
          name: 'Malicious Ashen Assault — Final Strike',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 5,
          duration: 8,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 3,
          duration: 4,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Poisoned',
          stacks: 3,
          duration: 4,
          actorType: 'player'
        }
      ])
    ],
    requiredMainHand: 'Spear',
    stealthAttack: true,
    malicious: true
  }
});

const SHADOW_FLARE_SKILL_IDS: ReadonlySet<number> = new Set([ID.SHADOW_FLARE, ID.SHADOW_SWAP]);
const MALICIOUS_DAMAGE_SCALING_SKILL_IDS: ReadonlySet<number> = new Set([
  ID.MALICIOUS_BACKSTAB,
  ID.MALICIOUS_DEATHS_JUDGMENT
]);

export function markedTarget(context: Gw2ModifierContext): boolean {
  const state = thiefRuntimeSpecializationState<DeadeyeState>(context, 'Deadeye');
  return Boolean(state.markedTargetId) && (state.markExpiresAt || Infinity) > context.time;
}

/** Intrinsic damage rules retain live mark eligibility and additive malice composition. */
export const deadeyeSkillModifiers: readonly Gw2ModifierRule[] = [
  {
    id: 'thief.shadow-flare-marked',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      markedTarget(context) &&
      SHADOW_FLARE_SKILL_IDS.has(Number(eventSkill(context)?.id))
  },
  {
    id: 'thief.malicious-backstab-position',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    // Malicious Backstab belongs to Deadeye; its rear-position rule stays out of the base Thief modifier set.
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      eventSkill(context)?.id === ID.MALICIOUS_BACKSTAB &&
      Boolean(context.config?.target?.defiant)
  },
  {
    id: 'thief.malicious-stealth-attack',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // Malice at cast start is snapshotted onto the event so each hit sees the pre-consumption value after malice is spent
    parameters: { damagePerMalice: 0.1 },
    amount: (context, _target, parameters) =>
      Math.max(0, (context.event as ThiefSimulationEvent | undefined)?.deadeyeMaliceSnapshot || 0) *
      parameters.damagePerMalice,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      markedTarget(context) &&
      MALICIOUS_DAMAGE_SCALING_SKILL_IDS.has(Number(eventSkill(context)?.id))
  }
];

/** Called after Core observers and the shared first-landed latch, before malice consumption. */
export function refundMaliciousTacticalStrike(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  if (event.skillId === ID.MALICIOUS_TACTICAL_STRIKE)
    grantThiefEndurance(runtime, Number(event.deadeyeMaliceSnapshot || 0) * 10);
}
