import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';

import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { warriorActiveBuffStacks } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { ammunitionCommitted, explosionAccepted } from '#gw2/professions/warrior/specializations/bladesworn/hooks.js';
import { dragonSlashRelease } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { gunsaberEntered } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import {
  resolveSharpAsTheWindSkillId,
  runtimeBuffActive
} from '#gw2/professions/warrior/specializations/bladesworn/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Owns this trait's tuning and selected contributions. */
export const unseenSword = defineTrait({
  triggers: [
    onTriggerPoint(gunsaberEntered, {
      run: (runtime, input: TriggerPointInput<typeof gunsaberEntered>) =>
        gunsaberEntryReward(runtime, input.cast, TRAIT.UNSEEN_SWORD)
    })
  ],
  id: TRAIT.UNSEEN_SWORD,
  name: 'Unseen Sword',
  balance: {
    internalCooldown: 4,
    // Entry traits declare their own flow window so patches can remove it independently.
    effects: [
      // The entry proc grants Flow immediately, but its sword lands after the observed 720 ms delay.
      { name: 'Strike', type: 'strike', coefficient: 1.2, hits: 1, atMs: 720 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 2, duration: 5 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const sharpAsTheWind = defineTrait({
  triggers: [
    onTriggerPoint(gunsaberEntered, {
      run: (runtime, input: TriggerPointInput<typeof gunsaberEntered>) =>
        gunsaberEntryReward(runtime, input.cast, TRAIT.SHARP_AS_THE_WIND)
    })
  ],
  id: TRAIT.SHARP_AS_THE_WIND,
  name: 'Sharp as the Wind',
  balance: {
    internalCooldown: 4,
    effects: [
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 3 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 2, duration: 5 }
    ]
  },
  hooks: { modifySkillId: resolveSharpAsTheWindSkillId }
});

/** Owns this trait's tuning and selected contributions. */
export const riversFlow = defineTrait({
  triggers: [
    onTriggerPoint(gunsaberEntered, {
      run: (runtime, input: TriggerPointInput<typeof gunsaberEntered>) =>
        gunsaberEntryReward(runtime, input.cast, TRAIT.RIVERS_FLOW)
    })
  ],
  id: TRAIT.RIVERS_FLOW,
  name: "River's Flow",
  balance: {
    internalCooldown: 4,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 8 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 2, duration: 5 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const dragonscaleDefense = defineTrait({
  id: TRAIT.DRAGONSCALE_DEFENSE,
  name: 'Dragonscale Defense',
  balance: {
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 0,

      emit: TRAIT.DRAGONSCALE_DEFENSE,
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.DRAGON_TRIGGER,
      effects: (effect) => effect.type === 'boon' || effect.type === 'buff',
      attribution: { priority: 0 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const fierceAsFire = defineTrait({
  triggers: [
    onTriggerPoint(ammunitionCommitted, {
      run: (runtime, input: TriggerPointInput<typeof ammunitionCommitted>) =>
        fierceAsFireAmmo(runtime, input.cast, input.spent)
    })
  ],
  id: TRAIT.FIERCE_AS_FIRE,
  name: 'Fierce as Fire',
  balance: {
    // Damage, presentation, and tooltip consumers share this trait's balance values.
    maximumStacks: 10,
    damageIncreasePerStack: 0.01,
    effects: [{ name: 'fierce-as-fire', type: 'buff', kind: 'fierce-as-fire', stacks: 1, duration: 15 }]
  },
  modifierRules: [
    {
      order: 10,
      id: 'warrior.fierce-as-fire',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      // Apply profile tuning to live self stacks, preserving Core Warrior's stack and expiry policy.
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.FIERCE_AS_FIRE);
        return (
          warriorActiveBuffStacks(context, 'fierce-as-fire', balanceProfileNumber(profile, 'maximumStacks')) *
          balanceProfileNumber(profile, 'damageIncreasePerStack')
        );
      }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const lushForest = defineTrait({
  triggers: [
    onTriggerPoint(ammunitionCommitted, {
      run: (runtime, input: TriggerPointInput<typeof ammunitionCommitted>) =>
        lushForestAmmo(runtime, input.cast, input.spent)
    })
  ],
  id: TRAIT.LUSH_FOREST,
  name: 'Lush Forest',
  balance: {
    rechargeReduction: 0.75
  }
});

/** Owns this trait's tuning and selected contributions. */
export const daringDragon = defineTrait({
  id: TRAIT.DARING_DRAGON,
  name: 'Daring Dragon',
  balance: {
    resourceCostMultiplier: 2,
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        stacks: 1,
        duration: 10,
        audience: { recipients: 'party' },
        packetLabel: 'on Dragon Slash release'
      }
    ]
  },
  triggers: [
    {
      order: 1,

      emit: TRAIT.DARING_DRAGON,
      on: 'castCommit',
      when: (runtime, cast) => dragonSlashRelease(runtime, cast) != null,
      effects: (effect) => effect.type === 'boon' || effect.type === 'buff',
      attribution: { priority: 0, audience: { recipients: 'party' } }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const gunsAndGlory = defineTrait({
  // Only live self applications enable Guns and Glory.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.GUNS_AND_GLORY);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled: runtimeBuffActive(context, 'guns-and-glory')
        }
      ]
    };
  },

  triggers: [
    onTriggerPoint(explosionAccepted, {
      run: (runtime, input: TriggerPointInput<typeof explosionAccepted>) => gunsAndGloryExplosion(runtime, input.event)
    })
  ],
  id: TRAIT.GUNS_AND_GLORY,
  name: 'Guns and Glory',
  balance: {
    attributeBonus: 250,
    maximumStacks: 12,
    resourceGain: 3
  }
});

/** Native specialization prerequisite; intrinsic resource state remains shared with the mode owner. */
export const gunXSword = defineTrait({ id: TRAIT.GUN_X_SWORD, name: 'Gun X Sword' });

/** Add the selected stun to the authored Dragon Slash release. */
export const unyieldingDragon = defineTrait({
  id: TRAIT.UNYIELDING_DRAGON,
  name: 'Unyielding Dragon',
  hooks: {
    modifyEffects(runtime, cast, effects) {
      if (!cast.skill.dragonSlash || !hasTrait(runtime, TRAIT.UNYIELDING_DRAGON)) return effects;
      const strike = effects.find((effect) => effect.type === 'strike');
      return [
        ...effects,
        {
          type: 'control',
          source: 'Trait',
          sourceId: TRAIT.UNYIELDING_DRAGON,
          controlKind: 'stun',
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          atMs: strike?.atMs
        }
      ];
    }
  }
});

/** Register native owners once in declaration order. */
export const warriorBladeswornTraits = [
  unyieldingDragon,
  gunXSword,
  unseenSword,
  sharpAsTheWind,
  riversFlow,
  dragonscaleDefense,
  fierceAsFire,
  lushForest,
  daringDragon,
  gunsAndGlory
] as const;

function gunsaberEntryReward(runtime: Runtime, cast: RuntimeCast<WarriorSkill>, trait: number): void {
  if (runtime.hasExplicitCombatStart && !runtime.combatActive) return;
  const state = bladeswornState.from(runtime);
  if (!isInternalCooldownReady(runtime.time, runtime.procs.deadline('warrior.bladesworn.gunsaberSwapTrait'))) return;
  if (trait === TRAIT.UNSEEN_SWORD && !runtime.combatActive) return;
  const profile = requireBalanceProfileFromContext(runtime, trait);
  const event = {
    at: runtime.time,
    source: 'Trait',
    sourceId: trait,
    actorType: 'effect' as const,
    activationId: cast.id,
    skillId: ID.UNSHEATHE_GUNSABER,
    skillName: 'Unsheathe Gunsaber'
  };
  if (trait === TRAIT.UNSEEN_SWORD) {
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike)
      emitTraitProfile(runtime, trait, trait, undefined, {
        // The shared materializer applies the authored impact offset once, after entry rewards.
        at: runtime.time,
        fullEnd: runtime.time,
        effect: { type: 'strike', name: 'Strike' },
        attribution: {
          source: 'Trait',
          sourceId: trait,
          actorType: 'player',
          activationId: cast.id,
          skillId: 62847,
          skillName: 'Unseen Sword',
          parentSkillName: cast.skill.name,
          name: 'Unseen Sword'
        },
        transform: (packet) => ({ ...packet, weaponStrengthProfileId: 'nonweapon.unequipped' })
      });
    runtime.effects.emit({
      kind: 'announcement',
      log: true,
      attribution: { ...event },
      announcement: { name: 'Unseen Sword', sourceSkill: cast.skill.name, type: 'trait', at: event.at }
    });
  } else if (trait === TRAIT.SHARP_AS_THE_WIND) {
    const burning = requireEffect(profile, 'condition', 'Burning');
    if (burning)
      emitTraitProfile(runtime, trait, trait, undefined, {
        at: runtime.time,
        fullEnd: runtime.time,
        effect: { type: 'condition', name: 'Burning' },
        attribution: {
          source: 'Trait',
          sourceId: trait,
          actorType: 'effect' as const,
          activationId: cast.id,
          skillId: ID.UNSHEATHE_GUNSABER,
          skillName: 'Unsheathe Gunsaber',
          ownerActorType: 'player',
          name: 'Sharp as the Wind — Burning'
        }
      });
  } else {
    const might = requireEffect(profile, 'boon', 'might');
    if (might)
      emitTraitProfile(runtime, trait, trait, undefined, {
        at: runtime.time,
        fullEnd: runtime.time,
        effect: { type: 'boon', name: 'might' },
        attribution: {
          source: 'Trait',
          sourceId: trait,
          actorType: 'effect' as const,
          activationId: cast.id,
          skillId: ID.UNSHEATHE_GUNSABER,
          skillName: 'Unsheathe Gunsaber',
          name: "River's Flow — Might",
          audience: { recipients: 'party' }
        }
      });
  }

  runtime.procs.setDeadline(
    'warrior.bladesworn.gunsaberSwapTrait',
    canonicalTime(runtime.time + balanceProfileNumber(profile, 'internalCooldown'))
  );
  const flow = requireEffect(profile, 'buff', 'positive-flow');
  if (!flow) return;
  if (state.traitPositiveFlowUntil <= runtime.time) state.traitPositiveFlowStartedAt = runtime.time;
  const duration = effectNumber(profile, flow, 'duration');
  state.traitPositiveFlowUntil = gw2EffectExpiresAt(runtime.time, duration);
  state.traitPositiveFlowStacks = effectNumber(profile, flow, 'stacks');
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...event,
      type: 'buff',
      name: 'Positive Flow',
      kind: 'positive-flow',
      stacks: state.traitPositiveFlowStacks,
      duration
    }
  });
}

/** Accepted ammunition spend grants Fire stacks before recharge reduction. */
function fierceAsFireAmmo(
  runtime: Runtime,
  cast: RuntimeCast<WarriorSkill>,
  spent: { readonly rounds: number; readonly startedFull: boolean }
): void {
  {
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FIERCE_AS_FIRE);
      emitTraitProfile(runtime, TRAIT.FIERCE_AS_FIRE, TRAIT.FIERCE_AS_FIRE, undefined, {
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FIERCE_AS_FIRE,
          actorType: 'effect',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        },
        // Each spent round grants the selected authored stack count.
        transform: (event) => ({
          ...event,
          name: traitProfile.name,
          stacks: Number(event.stacks) * spent.rounds,
          priority: 0
        }),
        effects: (effect) => effect.type === 'boon' || effect.type === 'buff'
      });
    }
  }
}

/** Full magazines reduce only the currently visible bar after committed spend. */
function lushForestAmmo(
  runtime: Runtime,
  cast: RuntimeCast<WarriorSkill>,
  spent: { readonly rounds: number; readonly startedFull: boolean }
): void {
  if (!spent.startedFull || cast.skill.id === ID.ARTILLERY_SLASH) return;
  const state = bladeswornState.from(runtime);
  const weapons = new Set(
    gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet === 2 ? 2 : 1).filter(Boolean)
  );
  const selected = selectedSkillIdSet(runtime.config.selectedSkillIds);
  const onBar = (skill: Skill) => {
    if (
      [ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER, ID.DRAGON_TRIGGER, ID.ARTILLERY_SLASH].some((id) => id === skill.id)
    )
      return false;
    if (skill.gunsaberSkill) return state.gunsaberActive || state.dragonTriggerActive;
    if (skill.type === 'Weapon' || skill.weapon)
      return !state.gunsaberActive && !state.dragonTriggerActive && (!weapons.size || weapons.has(skill.weapon ?? ''));
    return (
      !['Heal', 'Utility', 'Elite'].includes(String(skill.type)) ||
      runtime.config.selectedSkillIds === undefined ||
      selected.has(skill.id)
    );
  };

  const reduction = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.LUSH_FOREST),
    'rechargeReduction'
  );
  let reduced = 0;
  for (const id of new Set([
    ...runtime.cooldownController.cooldownSkillIds(),
    ...runtime.cooldownController.ammoSkillIds()
  ])) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill && onBar(skill))
      reduced += runtime.cooldownController.reduceSkillRecharge(skill, reduction, runtime.time);
  }

  runtime.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.LUSH_FOREST,
      actorType: 'effect',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    announcement: { at: runtime.time, name: 'Lush Forest', cooldownReduction: reduced, type: 'trait' }
  });
}

/** Explosions extend the granted Glory window before cartridge reactions run. */
function gunsAndGloryExplosion(runtime: Runtime, event: Gw2ResolverEvent): void {
  const state = bladeswornState.from(runtime);
  {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.GUNS_AND_GLORY);
    const duration = Math.min(
      balanceProfileNumber(profile, 'maximumStacks'),
      Math.max(0, state.gunsAndGloryUntil - runtime.time) + balanceProfileNumber(profile, 'resourceGain')
    );
    if (duration > 0) {
      // Tick rounding must not extend a full duration pool beyond its configured ceiling.
      state.gunsAndGloryUntil = Math.min(
        gw2EffectExpiresAt(runtime.time, duration),
        runtime.time + balanceProfileNumber(profile, 'maximumStacks')
      );
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: {
          type: 'buff',
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.GUNS_AND_GLORY,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName,
          name: 'Guns and Glory',
          kind: 'guns-and-glory',
          stacks: 1,
          duration
        }
      });
    }
  }
}

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
