import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2TraitLookupContext } from '#gw2/platform/builds/selected-traits.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';

export function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as Gw2MutableStats & { ferocity: number };
  if (hasTrait(context, TRAIT.GUNS_AND_GLORY) && runtimeBuffActive(context, 'guns-and-glory')) {
    const gunsAndGloryProfile = requireBalanceProfileFromContext(context, TRAIT.GUNS_AND_GLORY);
    result.ferocity += balanceProfileNumber(gunsAndGloryProfile, 'attributeBonus');
  }

  return result;
}

// Trait windows count only live self applications, never an ally's or companion's copy.
export function runtimeBuffActive(context: Gw2ModifierContext, kind: string): boolean {
  return activeBuffStacks({ ...context, timeline: undefined }, kind, 1) > 0;
}

export function gunsaberEntryTraits(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  if (runtime.hasExplicitCombatStart && !runtime.combatActive) return;
  const state = bladeswornState.from(runtime);
  if (!isInternalCooldownReady(runtime.time, runtime.procs.deadline('warrior.bladesworn.gunsaberSwapTrait'))) return;
  const trait = [TRAIT.UNSEEN_SWORD, TRAIT.SHARP_AS_THE_WIND, TRAIT.RIVERS_FLOW].find((id) => hasTrait(runtime, id));
  if (trait == null || (trait === TRAIT.UNSEEN_SWORD && !runtime.combatActive)) return;
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
      runtime.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
          ...event,
          // Resolve damage and its modifiers at impact while the entry proc and cooldown start immediately.
          at: canonicalTime(runtime.time + effectNumber(profile, strike, 'atMs') / 1000),
          actorType: 'player',
          skillId: 62847,
          skillName: 'Unseen Sword',
          parentSkillName: cast.skill.name,
          weaponStrengthProfileId: 'nonweapon.unequipped',
          coefficient: effectNumber(profile, strike, 'coefficient')
        })
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
      runtime.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
          ...event,
          ownerActorType: 'player',
          name: 'Sharp as the Wind — Burning',
          condition: 'Burning',
          stacks: effectNumber(profile, burning, 'stacks'),
          duration: effectNumber(profile, burning, 'duration')
        })
      });
  } else {
    const might = requireEffect(profile, 'boon', 'might');
    if (might)
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...event,
          type: 'buff',
          name: "River's Flow — Might",
          kind: 'might',
          stacks: effectNumber(profile, might, 'stacks'),
          duration: effectNumber(profile, might, 'duration'),
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

export function ammoTraits(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const spent = warriorAmmunition.get(cast);
  if (!spent) return;
  {
    if (hasTrait(runtime, TRAIT.FIERCE_AS_FIRE)) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FIERCE_AS_FIRE);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'buff'),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FIERCE_AS_FIRE,
          actorType: 'effect',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        },
        transform: (event) => ({ ...event, name: traitProfile.name, stacks: spent.rounds, priority: 0 })
      });
    }
  }

  if (!spent.startedFull || cast.skill.id === ID.ARTILLERY_SLASH || !hasTrait(runtime, TRAIT.LUSH_FOREST)) return;
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

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Explosions extend the granted Glory window before cartridge reactions run. */
export function gunsAndGloryExplosion(runtime: Runtime, event: Gw2ResolverEvent): void {
  const state = bladeswornState.from(runtime);
  if (hasTrait(runtime, TRAIT.GUNS_AND_GLORY)) {
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

export function maximumDragonCharges(context: Gw2TraitLookupContext): number {
  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? balanceProfileNumber(dragonTriggerProfile, 'minimumStacks')
    : balanceProfileNumber(dragonTriggerProfile, 'maximumStacks');
}

export function dragonFlowPerInterval(context: Gw2TraitLookupContext): number {
  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  const cost = balanceProfileNumber(dragonTriggerProfile, 'resourceCost');
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? cost *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DARING_DRAGON), 'resourceCostMultiplier')
    : cost;
}

const SHARP_AS_THE_WIND_VARIANTS = new Map<number, number>([
  [ID.SWIFT_CUT, ID.SHARP_SWIFT_CUT],
  [ID.STEEL_DIVIDE, ID.SHARP_STEEL_DIVIDE],
  [ID.EXPLOSIVE_THRUST, ID.SHARP_EXPLOSIVE_THRUST],
  [ID.BLOOMING_FIRE, ID.SHARP_BLOOMING_FIRE],
  [ID.ARTILLERY_SLASH, ID.SHARP_ARTILLERY_SLASH],
  [ID.CYCLONE_TRIGGER, ID.SHARP_CYCLONE_TRIGGER],
  [ID.BREAK_STEP, ID.SHARP_BREAK_STEP],
  [ID.DRAGON_SLASH_FORCE, ID.SHARP_DRAGON_SLASH_FORCE],
  [ID.DRAGON_SLASH_BOOST, ID.SHARP_DRAGON_SLASH_BOOST],
  [ID.DRAGON_SLASH_REACH, ID.SHARP_DRAGON_SLASH_REACH]
]);

const SHARP_AS_THE_WIND_PARENTS = new Map(
  [...SHARP_AS_THE_WIND_VARIANTS].map(([parentId, variantId]) => [variantId, parentId])
);

export function resolveSharpAsTheWindSkillId(
  context: import('#gw2/platform/profession-definition/runtime-context.js').TraitSelectionContext,
  skillId: SkillId
): SkillId {
  const parentId = SHARP_AS_THE_WIND_PARENTS.get(Number(skillId)) ?? Number(skillId);
  const variantId = SHARP_AS_THE_WIND_VARIANTS.get(parentId);
  if (!variantId) return skillId;
  return context.hasTrait(TRAIT.SHARP_AS_THE_WIND) ? variantId : parentId;
}

/** Dragon Slash refunds its captured Flow pool using the elite tuning. */
export function burstMasteryDragonSlash(
  runtime: MechanicContext<WarriorRuntimeState, WarriorSkill>,
  cast: RuntimeCast<WarriorSkill>,
  release: { flowSpent: number }
): void {
  if (hasTrait(runtime, TRAIT.BURST_MASTERY)) {
    runtime.resourceController.grant(
      'flow',
      release.flowSpent *
        balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, 'warrior.bladesworn.burst-mastery'),
          'resourceGain'
        )
    );
    {
      if (hasTrait(runtime, TRAIT.BURST_MASTERY)) {
        const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BURST_MASTERY);
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: traitProfile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'buff'),
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BURST_MASTERY,
            actorType: 'effect',
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            activationId: cast.id
          },
          transform: (event) => ({ ...event, name: traitProfile.name, stacks: event.stacks, priority: 5 })
        });
      }
    }
  }
}
