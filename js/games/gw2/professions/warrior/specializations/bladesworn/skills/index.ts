import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_SUPPLEMENTAL_SKILLS } from '#gw2/professions/warrior/data/warrior-supplemental-skills.js';
import { slashEffects } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { activeCartridgeWindow, bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Explicit PvE skill mechanics owned by the Bladesworn Warrior module. */

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

const CARTRIDGE_ACTIVATE = 'warrior.cartridges-activate';

const furyBeforeCast = new WeakSet<RuntimeCast<WarriorSkill>>();

/** Both action identities select the version owned by the equipped adept trait. */

export const BLADESWORN_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.UNSHEATHE_GUNSABER]: {
    // Successful commitment owns this transition or reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.gunsaber-enter' } }],
    // Gunsaber transitions use a five-second base recharge before recharge modifiers.
    cooldown: 5,
    castTimeMs: 0,
    effects: [],
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.DRAGON_TRIGGER]: {
    // Successful commitment owns this transition or reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.dragon-trigger-enter' } }],
    effects: [],
    castTimeMs: 0,
    canCastConcurrently: false,
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.SHEATHE_GUNSABER]: {
    // Successful commitment owns this transition or reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.gunsaber-exit' } }],
    cooldown: 5,
    castTimeMs: 0,
    effects: [],
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.TACTICAL_RELOAD]: {
    // Successful commitment owns this transition or reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.tactical-reload' } }],
    effects: [],
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    // Commitment grants the reload while the remaining animation retains its cast lockout.
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true
  },
  [ID.DRAGONSPIKE_MINE]: {
    // The completed activation refreshes its paired skill through the shared recharge owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.DRAGON_TRIGGER] } }],
    movementSkill: true,
    // Dragonspike Mine refreshes Dragon Trigger when its cast completes.
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 640,
    // Interrupted replay keeps the mine effects once their observed activation has committed.
    interruptCommitMs: 640
  },
  [ID.FLOW_STABILIZER]: {
    // Capture preexisting Fury before this skill applies its own boon.
    sideEffects: [
      { on: 'castStart', do: { type: 'warrior.flow-snapshot' } },
      { on: 'castCommit', do: { type: 'warrior.flow-stabilize' } }
    ],
    castTimeMs: 0,
    // Flow Stabilizer opens its passive-flow window and grants its conditional flow on completion.
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'buff',
        name: 'Positive Flow',
        kind: 'positive-flow',
        duration: 8,
        stacks: 2
      }
    ]
  },
  [ID.COMBAT_STIMULANT]: {
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      }
    ],
    castTimeMs: 500
  },
  [ID.OVERCHARGED_CARTRIDGES]: {
    // Activation precedes completion, so acceptance schedules its own guarded wake.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'warrior.cartridges-schedule' } }
    ],
    ammo: 2,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 1,
    effects: [],
    castTimeMs: 600,
    dualWieldCastTimeMs: 480,
    // Committed interrupted casts keep the cartridge window consumed by later explosions.
    interruptCommitMs: 480
  },
  // Only explicitly named explosion packets trigger explosion modifiers and traits; ordinary gunsaber hits do not.
  [ID.SWIFT_CUT]: {
    effects: [
      {
        type: 'strike',
        name: 'Swift Cut — Blade',
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'strike',
        name: 'Swift Cut — Shot',
        coefficient: 0.75 * 0.33,
        hits: 1
      }
    ],
    castTimeMs: 640,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.STEEL_DIVIDE]: {
    effects: [
      {
        type: 'strike',
        name: 'Steel Divide — Blade',
        coefficient: 1.1,
        hits: 1
      },
      {
        type: 'strike',
        name: 'Steel Divide — Shot',
        coefficient: 0.75 * 0.33,
        hits: 1
      }
    ],
    castTimeMs: 600,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.EXPLOSIVE_THRUST]: {
    effects: [
      {
        type: 'strike',
        name: 'Explosive Thrust — Blade',
        coefficient: 1.35,
        hits: 1
      },
      {
        type: 'strike',
        name: 'Explosive Thrust — Explosion',
        coefficient: 1.2 * 0.33,
        hits: 1,
        damageKind: 'explosion'
      }
    ],
    castTimeMs: 440,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.BLOOMING_FIRE]: {
    ammo: 2,
    ammoRecharge: 10,
    cooldown: 10,
    ammoCastLockout: 2,
    effects: [
      {
        type: 'strike',
        name: 'Blooming Fire — Blade',
        coefficient: 0.8,
        hits: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        name: 'Blooming Fire — Explosion',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 600,
    // Interrupted replay keeps every Blooming Fire packet after its observed activation commits.
    interruptCommitMs: 600,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.ARTILLERY_SLASH]: {
    // Capture every round before shared commitment spends the last reserved round.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.spend-magazine' } }],
    effectVariants: [
      {
        profileId: PROFILE.artillerySlash,
        when: () => true,
        transform: (runtime, cast) => artilleryEffects(runtime, cast, false)
      }
    ],
    ammo: 2,
    ammoRecharge: 15,
    cooldown: 15,
    ammoCastLockout: 2,
    effects: [],
    castTimeMs: 680,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.CYCLONE_TRIGGER]: {
    ammo: 2,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 400,
    // Interrupted replay keeps every Cyclone Trigger packet after its observed activation commits.
    interruptCommitMs: 240,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.BREAK_STEP]: {
    movementSkill: true,
    ammo: 2,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 320,
    // Interrupted replay keeps every Break Step packet after its observed activation commits.
    interruptCommitMs: 320,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.DRAGON_SLASH_FORCE]: {
    // Normal and Sharp releases share captured facts and their own interpolation endpoints.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.slash-release' } }],
    effectVariants: [{ when: () => true, transform: slashEffects }],
    effects: [],
    castTimeMs: 1040,
    // Force hits during its animation so expiring buffs are evaluated before recovery ends.
    dragonSlashImpactOffsetMs: 520,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 1.16,
    dragonSlashMaximumCoefficient: 20.4
  },
  [ID.DRAGON_SLASH_BOOST]: {
    // Normal and Sharp releases share captured facts and their own interpolation endpoints.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.slash-release' } }],
    effectVariants: [{ when: () => true, transform: slashEffects }],
    movementSkill: true,
    effects: [],
    castTimeMs: 1040,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.92,
    dragonSlashMaximumCoefficient: 16.3
  },
  [ID.DRAGON_SLASH_REACH]: {
    // Normal and Sharp releases share captured facts and their own interpolation endpoints.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.slash-release' } }],
    effectVariants: [{ when: () => true, transform: slashEffects }],
    effects: [],
    castTimeMs: 1040,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.56,
    dragonSlashMaximumCoefficient: 10.21
  },
  [ID.FLICKER_STEP]: {
    ammo: 3,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 0.5,
    castTimeMs: 0,
    effects: [],
    gunsaberSkill: true,
    dragonTriggerSkill: true,
    shadowstepSkill: true,
    peithaImpactDelayMs: 240,
    skillWeapon: 'Gunsaber'
  },
  [ID.TRIGGERGUARD]: {
    ammo: 2,
    ammoRecharge: 30,
    cooldown: 30,
    ammoCastLockout: 1,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 2,
        stacks: 1
      }
    ],
    gunsaberSkill: true,
    dragonTriggerSkill: true,
    skillWeapon: 'Gunsaber'
  }
});

/** Creates the hidden skill identity selected when Sharp as the Wind replaces a normal Gunsaber action. */
function sharpAsTheWindVariant(id: number, parentId: number, name: string, overrides: Partial<Skill>): Skill {
  const parent = WARRIOR_SUPPLEMENTAL_SKILLS.find((skill) => skill.id === parentId);

  return Object.freeze({
    id,
    name,
    description: 'Sharp as the Wind condition variant.',
    icon: parent?.icon || '',
    type: parent?.type || 'Bundle',
    slot: 'Action',
    specialization: 'Bladesworn',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    ...BLADESWORN_SKILL_MECHANICS[parentId],
    ...overrides,
    paletteAction: false,
    slotSelectable: false,
    simulatorExcluded: false
  });
}

export const BLADESWORN_SHARP_AS_THE_WIND_SKILLS: readonly Skill[] = Object.freeze([
  sharpAsTheWindVariant(ID.SHARP_SWIFT_CUT, ID.SWIFT_CUT, 'Swift Cut', {
    effects: [
      { type: 'strike', name: 'Swift Cut — Blade', coefficient: 0.3, hits: 1 },
      { type: 'strike', name: 'Swift Cut — Shot', coefficient: 0.1, hits: 1 },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 3 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_STEEL_DIVIDE, ID.STEEL_DIVIDE, 'Steel Divide', {
    effects: [
      { type: 'strike', name: 'Steel Divide — Blade', coefficient: 0.4, hits: 1 },
      { type: 'strike', name: 'Steel Divide — Shot', coefficient: 0.1, hits: 1 },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_EXPLOSIVE_THRUST, ID.EXPLOSIVE_THRUST, 'Explosive Thrust', {
    effects: [
      { type: 'strike', name: 'Explosive Thrust — Blade', coefficient: 0.6, hits: 1 },
      {
        type: 'strike',
        name: 'Explosive Thrust — Explosion',
        coefficient: 0.1,
        hits: 1,
        damageKind: 'explosion'
      },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_BLOOMING_FIRE, ID.BLOOMING_FIRE, 'Blooming Fire', {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        name: 'Blooming Fire — Blade',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'strike',
        name: 'Blooming Fire — Explosion',
        coefficient: 0.3,
        hits: 3,
        atMs: 0,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Burning', stacks: 3, duration: 3 }]
      }
    ])
  }),
  sharpAsTheWindVariant(ID.SHARP_ARTILLERY_SLASH, ID.ARTILLERY_SLASH, 'Artillery Slash', {
    effectVariants: [
      {
        profileId: PROFILE.sharpArtillerySlash,
        when: () => true,
        transform: (runtime, cast) => artilleryEffects(runtime, cast, true)
      }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_CYCLONE_TRIGGER, ID.CYCLONE_TRIGGER, 'Cyclone Trigger', {
    effects: [
      { type: 'strike', coefficient: 1, hits: 1, persistsAfterInterrupt: true },
      { type: 'boon', boon: 'aegis', duration: 5, stacks: 1, persistsAfterInterrupt: true },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 5,
        persistsAfterInterrupt: true
      }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_BREAK_STEP, ID.BREAK_STEP, 'Break Step', {
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        damageKind: 'explosion',
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Leap',
            fieldSelectionAnchor: 'castStart',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      { type: 'boon', boon: 'fury', duration: 5, stacks: 1, persistsAfterInterrupt: true },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 8,
        persistsAfterInterrupt: true
      }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_FORCE, ID.DRAGON_SLASH_FORCE, 'Dragon Slash—Force', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 3,
    dragonSlashMaximumCoefficient: 3,
    dragonSlashMinimumBurningDuration: 2,
    dragonSlashMaximumBurningDuration: 4
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_BOOST, ID.DRAGON_SLASH_BOOST, 'Dragon Slash—Boost', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 2.4,
    dragonSlashMaximumCoefficient: 2.4,
    dragonSlashMinimumBurningDuration: 1.5,
    dragonSlashMaximumBurningDuration: 3.25
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_REACH, ID.DRAGON_SLASH_REACH, 'Dragon Slash—Reach', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 1.5,
    dragonSlashMaximumCoefficient: 1.5,
    dragonSlashMinimumBurningDuration: 1,
    dragonSlashMaximumBurningDuration: 2
  })
]);

/** Artillery spends every captured round while the shared completion consumes its final reserved round. */
function artilleryEffects(runtime: Runtime, cast: RuntimeCast<WarriorSkill>, sharp: boolean): readonly SkillEffect[] {
  const rounds = warriorAmmunition.get(cast)!.rounds;
  const profile = requireBalanceProfileFromContext(
    runtime,
    sharp ? PROFILE.sharpArtillerySlash : PROFILE.artillerySlash
  );
  const strike = requireEffect(profile, 'strike', sharp ? 'Strike' : rounds >= 2 ? 'Two rounds' : 'One round');
  const effects: SkillEffect[] = [];
  if (strike)
    effects.push({
      type: 'strike',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      weapon: 'Gunsaber',
      damageKind: 'explosion',
      projectile: sharp,
      ...(sharp
        ? { comboFinishers: [{ ownerId: 'warrior', finisherType: 'Projectile', ambiguousFieldSelection: 'oldest' }] }
        : {})
    });
  const bleeding = sharp ? requireEffect(profile, 'condition', rounds >= 2 ? 'Two rounds' : 'One round') : undefined;
  if (bleeding)
    effects.push({
      type: 'condition',
      condition: String(bleeding.condition),
      stacks: effectNumber(profile, bleeding, 'stacks'),
      duration: effectNumber(profile, bleeding, 'duration')
    });
  if (requireEffect(profile, 'control', 'Control'))
    effects.push({ type: 'control', controlKind: sharp && rounds >= 2 ? 'stun' : 'daze' });
  return effects;
}

/** Actual activation upgrades a live cartridge window once; a supercharged window cannot be refreshed by another cast. */
function activateCartridges(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const state = bladeswornState.from(runtime);
  // Discard expired occurrences on the next grant so idle expiry needs no queued cleanup.
  state.overchargedCartridgeWindows = state.overchargedCartridgeWindows.filter(
    (window) => window.expiresAt > runtime.time
  );
  const active = activeCartridgeWindow(state.overchargedCartridgeWindows, runtime.time);
  if (active?.supercharged) return;
  const supercharged = Boolean(active);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.overchargedCartridges);
  const kind = supercharged ? 'supercharged-cartridges' : 'overcharged-cartridges';
  const buff = requireEffect(profile, 'buff', kind);
  if (!buff) return;
  const duration = effectNumber(profile, buff, 'duration');
  if (duration <= 0) return;
  if (active) active.expiresAt = runtime.time;
  const burning = requireEffect(profile, 'condition', supercharged ? 'Supercharged Burning' : 'Overcharged Burning');
  const expiresAt = gw2EffectExpiresAt(runtime.time, duration);
  state.overchargedCartridgeWindows.push({
    startedAt: runtime.time,
    expiresAt,
    supercharged,
    damageBonus: effectNumber(profile, buff, 'damageIncreasePerStack'),
    burningDuration: burning ? effectNumber(profile, burning, 'duration') : 0
  });
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Warrior',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name: supercharged ? 'Supercharged Cartridges' : 'Overcharged Cartridges',
      kind,
      stacks: effectNumber(profile, buff, 'stacks'),
      duration
    }
  });
}

/** Only resolved positive player explosions emit the selected cartridge condition; derived conditions cannot recurse. */
export function cartridgeExplosion(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;
  const state = bladeswornState.from(runtime);
  const window = activeCartridgeWindow(state.overchargedCartridgeWindows, runtime.time);
  if (!window || window.burningDuration <= 0) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.overchargedCartridges);
  const burning = requireEffect(
    profile,
    'condition',
    window.supercharged ? 'Supercharged Burning' : 'Overcharged Burning'
  );
  if (burning)
    runtime.effects.emit({
      kind: 'packet',
      cause: event,
      event: buildResolverCondition({
        at: runtime.time,
        source: 'Warrior',
        sourceId: ID.OVERCHARGED_CARTRIDGES,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: event.skillId,
        skillName: event.skillName,
        name: 'Overcharged Cartridges — Burning',
        condition: 'Burning',
        stacks: effectNumber(profile, burning, 'stacks'),
        duration: window.burningDuration
      })
    });
}

/** Successful commitment restores the longest-recharging round, clearing recharge when the pool becomes full. */
function tacticalReload(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  for (const id of runtime.cooldownController.ammoSkillIds()) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill?.specialization === 'Bladesworn') runtime.cooldownController.restoreAmmo(skill, 1, runtime.time);
  }

  const state = bladeswornState.from(runtime);
  state.tacticalReloadUntil = gw2EffectExpiresAt(runtime.time, 10);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Warrior',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name: 'Tactical Reload',
      kind: 'tactical-reload',
      stacks: 1,
      duration: 10
    }
  });
}

/** Intrinsic recipes execute at their declared phase; shared Flow and Trigger lifetimes remain separate. */
export const bladeswornSkillActions: RuntimeProfession<WarriorRuntimeState, WarriorSkill>['sideEffectHandlers'] = {
  'warrior.tactical-reload'(runtime, context) {
    if (context.kind === 'cast') tacticalReload(runtime, context.cast);
  },
  'warrior.cartridges-schedule'(runtime, context) {
    if (context.kind !== 'cast') return;
    const cast = context.cast;
    runtime.scheduleForCast(
      CARTRIDGE_ACTIVATE,
      canonicalTime(cast.start + (cast.fullEnd - cast.start) * (420 / 900)),
      cast
    );
  },
  'warrior.flow-snapshot'(runtime, context) {
    if (context.kind !== 'cast') return;
    const cast = context.cast;
    // Sample configured or executed self Fury before the cast emits its own application.
    if (runtime.combat.activeBoonStacks('fury', runtime.time, 1) > 0) furyBeforeCast.add(cast);
  },
  'warrior.flow-stabilize'(runtime, context) {
    if (context.kind !== 'cast') return;
    const cast = context.cast;
    if (furyBeforeCast.has(cast)) runtime.resourceController.grant('flow', 15);
    // The conditional instant grant is independent of the removable Positive Flow component.
    const effect = requireEffect(cast.skill, 'buff', 'Positive Flow');
    if (effect) {
      const expiresAt = gw2EffectExpiresAt(runtime.time, effectNumber(cast.skill, effect, 'duration'));
      if (expiresAt > runtime.time)
        bladeswornState.from(runtime).flowStabilizerWindows.push({ startedAt: runtime.time, expiresAt });
    }
  }
};

export const bladeswornSkillTasks: RuntimeProfession<WarriorRuntimeState, WarriorSkill>['tasks'] = {
  [CARTRIDGE_ACTIVATE](runtime, data) {
    activateCartridges(runtime, (data as { cast: RuntimeCast<WarriorSkill> }).cast);
  }
};

function cartridgeDamageBonus(context: Gw2ModifierContext): number {
  // A newer cartridge application replaces the older bonus, even after the newer one expires.
  let latest = { at: -Infinity, expiresAt: 0, kind: '' };
  for (const kind of ['overcharged-cartridges', 'supercharged-cartridges']) {
    for (const application of context.runtime?.boons?.get(kind) ?? []) {
      if (application.resolvedAudience.includesSelf && application.at <= context.time && application.at >= latest.at)
        latest = { at: application.at, expiresAt: application.expiresAt, kind };
    }
  }

  if (latest.expiresAt <= context.time) return 0;
  const profile = requireBalanceProfileFromContext(context, PROFILE.overchargedCartridges);
  const effect = requireEffect(profile, 'buff', latest.kind);
  return effect ? effectNumber(profile, effect, 'damageIncreasePerStack') : 0;
}

/** Cartridge explosions retain their live outgoing multiplier independently of the Burning component. */
export const cartridgeModifiers: readonly Gw2ModifierRule[] = [
  {
    id: 'warrior.overcharged-cartridges',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { baseFactor: 1 },
    factor: (context, _target, parameters) => parameters.baseFactor + cartridgeDamageBonus(context),
    when: (context) => context.event?.damageKind === 'explosion' && cartridgeDamageBonus(context) > 0
  }
];
