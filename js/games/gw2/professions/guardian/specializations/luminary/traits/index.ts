// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { boonKey } from '#gw2/platform/combat/boons.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, AURA, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { latestRadiantArmaments } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { refreshGuardianVirtues } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { AURA_GRANT } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import {
  lightAuraGranting,
  luminaryCastStarted,
  luminaryVirtueCompleted,
  radiantVirtueArmed,
  radiantWeaponDrawn,
  radiantWeaponEquipped,
  type LightAuraGrant,
  type LuminaryCast,
  type RadiantVirtueArming
} from '#gw2/professions/guardian/specializations/luminary/mechanics/trigger-points.js';
import { luminaryImpactAt } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntime, GuardianSkill } from '#gw2/professions/guardian/types.js';

const AURA_DETONATE = 'guardian.luminary.aura-detonate';
const VIRTUES: readonly number[] = [ID.RADIANT_JUSTICE, ID.RADIANT_RESOLVE, ID.RADIANT_COURAGE];

/** Completed stance casts emit the surviving party boon and hostile Blind components. */
const shimmeringStances = defineTrait({
  name: 'Shimmering Stances',
  id: TRAIT.SHIMMERING_STANCES,
  balance: {
    effects: [
      {
        type: 'boon',
        name: boonKey(BOON.PROTECTION),
        boon: BOON.PROTECTION,
        duration: 3,
        audience: { recipients: RECIPIENT.PARTY }
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3,
        name: 'Blind'
      }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SHIMMERING_STANCES,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Stance')),
      attribution: (_runtime, cast) => ({
        source: 'guardian',
        skillId: TRAIT.SHIMMERING_STANCES,
        skillName: 'Shimmering Stances',
        offTarget: cast.command.offTarget === true
      })
    }
  ]
});

/** Consumes only a live aura with a surviving strike, preserving detonation priority and already-scheduled work. */
const sovereignOfLight = defineTrait({
  name: 'Sovereign of Light',
  id: TRAIT.SOVEREIGN_OF_LIGHT,
  balance: {
    // Forge entry grants this trait's aura; detonation selects only its independent strike.
    effects: [
      { type: 'strike', name: 'Strike', coefficient: 1.5, hits: 1 },
      { type: 'aura', name: AURA.LIGHT, aura: AURA.LIGHT, duration: 4 }
    ]
  },
  triggers: [
    onTriggerPoint(luminaryCastStarted, {
      run(runtime: GuardianRuntime, input: LuminaryCast) {
        const { cast } = input;

        if (detonator(cast.skill)) scheduleDetonation(runtime, input);

        // Forge entry admits its replacement aura after detonation, through the same isolated producer.
        if (cast.skill.id === ID.ENTER_RADIANT_FORGE)
          runtime.schedule(
            AURA_GRANT,
            cast.start,
            {
              cause: { ...guardianCastCause(runtime, cast), offTarget: cast.command.offTarget === true },
              traitId: TRAIT.SOVEREIGN_OF_LIGHT
            },
            undefined,
            -10
          );
      }
    }),
    onTriggerPoint(lightAuraGranting, {
      when: (runtime, { cause }: LightAuraGrant) => {
        const skill = cause.skillId == null ? undefined : runtime.helpers.skillsById.get(cause.skillId);
        return Boolean(skill && detonator(skill));
      },
      run: (runtime: GuardianRuntime, { cause }: LightAuraGrant) => detonate(runtime, cause)
    })
  ],
  lifetime: { tasks: { [AURA_DETONATE]: (runtime, data) => detonate(runtime, data as Gw2ResolverEvent) } }
});

/** Accepted equips install the weapon-tagged window; only its latest live hammer grants damage. */
const radiantArmaments = defineTrait({
  name: 'Radiant Armaments',
  id: TRAIT.RADIANT_ARMAMENTS,
  balance: {
    damageIncrease: 0.07,
    effects: [{ type: 'buff', name: 'radiant-armaments', kind: 'guardian-radiant-armaments', duration: 10 }]
  },
  modifierRules: [
    {
      requiresSelection: false,
      order: -1,
      id: 'guardian.radiant-armaments',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.RADIANT_ARMAMENTS, 'damageIncrease'),
      when: (context) => {
        const armament = latestRadiantArmaments(context);
        // The buff is emitted for every radiant weapon, but the +7% bonus is
        // exclusive to the hammer (Dazzling Hammer). The shared effect-clock expiry check is
        // necessary because latestRadiantArmaments returns the most-recently
        // applied record regardless of whether it has expired.
        return (
          armament?.metadata?.radiantWeapon === 'hammer' &&
          gw2EffectExpiresAt(armament.at, armament.duration || 0) > context.time
        );
      }
    }
  ],
  triggers: [onTriggerPoint(radiantWeaponDrawn, { run: startRadiantArmaments })]
});

/** Successful equips extend the capped damage window without revoking already-applied buffs. */
const empoweredArmaments = defineTrait({
  name: 'Empowered Armaments',
  id: TRAIT.EMPOWERED_ARMAMENTS,
  balance: {
    damageIncrease: 0.1,
    maximumStacks: 20,
    resourceGain: 6
  },
  modifierRules: [
    {
      requiresSelection: false,
      order: -2,
      id: 'guardian.empowered-armaments',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.EMPOWERED_ARMAMENTS, 'damageIncrease'),
      when: (context) => buffActive(context, 'guardian-empowered-armaments')
    }
  ],
  triggers: [onTriggerPoint(radiantWeaponEquipped, { run: extendEmpoweredArmaments })]
});

/** Successful equips grant the authored party boon package at the equip timestamp. */
const resplendentWeaponry = defineTrait({
  name: 'Resplendent Weaponry',
  id: TRAIT.RESPLENDENT_WEAPONRY,
  balance: {
    effects: [
      { type: 'boon', name: boonKey(BOON.ALACRITY), boon: BOON.ALACRITY, duration: 4 },
      { type: 'boon', name: boonKey(BOON.MIGHT), boon: BOON.MIGHT, duration: 8, stacks: 1 },
      { type: 'boon', name: boonKey(BOON.FURY), boon: BOON.FURY, duration: 5 }
    ]
  },
  triggers: [onTriggerPoint(radiantWeaponEquipped, { run: grantResplendentWeaponry })]
});

/** Completed equips reduce real virtue recharge and refresh the shared readiness projection. */
const illuminatingInspiration = defineTrait({
  name: 'Illuminating Inspiration',
  id: TRAIT.ILLUMINATING_INSPIRATION,
  balance: { rechargeReduction: 4 },
  triggers: [onTriggerPoint(radiantWeaponEquipped, { run: reduceVirtueRecharge })]
});

/** Supplies eligible Vitality before build conversions. */
const lightsGift = defineTrait({
  name: "Light's Gift",
  id: TRAIT.LIGHTS_GIFT,
  balance: { attributeBonuses: { vitality: 180 } },
  attributes: traitAttributeEffects(TRAIT.LIGHTS_GIFT, [{ kind: 'flat', to: 'Vitality', feedsConversions: 'all' }])
});

/** Virtue reset targets and reporting share this behavior-only trait owner. */
const masterAtArms = defineTrait({
  name: 'Master-at-Arms',
  id: TRAIT.MASTER_AT_ARMS,
  triggers: [
    onTriggerPoint(radiantVirtueArmed, { run: rechargeRadiantWeapons }),
    onTriggerPoint(luminaryVirtueCompleted, { run: reportMasterAtArms })
  ]
});

export const luminaryTraits = [
  empoweredArmaments,
  radiantArmaments,
  shimmeringStances,
  sovereignOfLight,
  resplendentWeaponry,
  illuminatingInspiration,
  lightsGift,
  masterAtArms
];

/** Luminary activation sources detonate a live aura at their impact, ahead of any replacement aura. */
function scheduleDetonation(runtime: GuardianRuntime, { cast }: LuminaryCast): void {
  const skill = cast.skill;
  const at =
    skill.radiantForgeSkill || skill.id === ID.PIERCING_STANCE || skill.id === ID.DARING_ADVANCE
      ? luminaryImpactAt(cast)
      : cast.start;
  runtime.schedule(
    AURA_DETONATE,
    at,
    { ...guardianCastCause(runtime, cast), offTarget: cast.command.offTarget === true },
    undefined,
    -20
  );
}

/** The accepted equip animation grants its armament window after earlier cast-start effects. */
function startRadiantArmaments(runtime: GuardianRuntime, { cast }: LuminaryCast): void {
  // Armament damage starts with the accepted equip animation, independently of its completion rewards.
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.RADIANT_ARMAMENTS);
  const effect = requireEffect(profile, 'buff', 'radiant-armaments');

  if (!effect) return;

  // The weapon-specific window retains equip identity while its payload stays profile-owned.
  const cause = guardianCastCause(runtime, cast);
  emitTraitProfile(runtime, TRAIT.RADIANT_ARMAMENTS, TRAIT.RADIANT_ARMAMENTS, cause, {
    at: runtime.time,
    effect: { type: 'buff', name: 'radiant-armaments' },
    attribution: {
      source: cause.source,
      sourceId: cause.sourceId,
      actorType: ACTOR.PLAYER,
      metadata: { radiantWeapon: cast.skill.radiantWeapon },
      name: cast.skill.name
    }
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Radiant Armaments',
      at: runtime.time,
      sourceSkill: cast.skill.name,
      detail: cast.skill.radiantWeapon,
      icon: guardianTraitIcon(TRAIT.RADIANT_ARMAMENTS)
    }
  });
}

/** Each virtue recharges the radiant weapons it arms. */
const MASTER_AT_ARMS_WEAPONS: Readonly<Record<number, readonly SkillId[]>> = {
  [ID.RADIANT_COURAGE]: [ID.GLEAMING_BLADE, ID.RADIANT_BULWARK],
  [ID.RADIANT_RESOLVE]: [ID.LUMINOUS_STAFF],
  [ID.RADIANT_JUSTICE]: [ID.DAZZLING_HAMMER]
};

/** The committed virtue resets its matching radiant weapons right after arming them. */
function rechargeRadiantWeapons(runtime: GuardianRuntime, { context }: RadiantVirtueArming): void {
  const skillIds = MASTER_AT_ARMS_WEAPONS[Number(context.skill.id)];

  if (skillIds) applySideEffect(runtime, context, { type: 'rechargeReset', skillIds: [...skillIds] });
}

/** Reports the selected virtue reset after its Core activation traits have run. */
function reportMasterAtArms(runtime: GuardianRuntime, { cast }: LuminaryCast): void {
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Master-at-Arms',
      at: runtime.time,
      sourceSkill: cast.skill.name,
      detail: 'Radiant weapons recharged',
      icon: guardianTraitIcon(TRAIT.MASTER_AT_ARMS)
    }
  });
}

/** Successful equips grant the authored party boon package at the equip timestamp. */
function grantResplendentWeaponry(runtime: GuardianRuntime, { cast }: LuminaryCast): void {
  // The accepted equip is the cause; the profile owns the party boon package.
  const cause = guardianCastCause(runtime, cast);
  emitTraitProfile(runtime, TRAIT.RESPLENDENT_WEAPONRY, TRAIT.RESPLENDENT_WEAPONRY, cause, {
    at: runtime.time,
    effects: (effect) => effect.type === 'boon',
    attribution: {
      source: cause.source,
      actorType: ACTOR.PLAYER,
      skillName: 'Resplendent Weaponry',
      name: 'Resplendent Weaponry',
      audience: { recipients: RECIPIENT.PARTY }
    }
  });
}

/** Completed equips extend the capped damage window without revoking already-applied buffs. */
function extendEmpoweredArmaments(runtime: GuardianRuntime, { cast }: LuminaryCast): void {
  const cause = guardianCastCause(runtime, cast);
  const state = luminaryState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWERED_ARMAMENTS);
  const duration = Math.min(
    balanceProfileNumber(profile, 'maximumStacks'),
    Math.max(0, state.empoweredArmamentsUntil - runtime.time) + balanceProfileNumber(profile, 'resourceGain')
  );
  state.empoweredArmamentsUntil = gw2EffectExpiresAt(runtime.time, duration);
  runtime.effects.emit({
    kind: 'packet',
    event: { ...cause, kind: 'guardian-empowered-armaments', duration, stacks: 1 }
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Empowered Armaments',
      at: runtime.time,
      sourceSkill: cast.skill.name,
      detail: 'Radiant weapon equipped',
      icon: guardianTraitIcon(TRAIT.EMPOWERED_ARMAMENTS)
    }
  });
}

/** Completed equips reduce real virtue recharge and refresh the shared readiness projection. */
function reduceVirtueRecharge(runtime: GuardianRuntime, { cast }: LuminaryCast): void {
  const reduction = balanceNumberFromContext(runtime, TRAIT.ILLUMINATING_INSPIRATION, 'rechargeReduction');
  for (const id of VIRTUES)
    runtime.cooldownController.reduceSkillRecharge(runtime.helpers.skillsById.get(id)!, reduction, runtime.time);
  refreshGuardianVirtues(runtime);
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Illuminating Inspiration',
      at: runtime.time,
      sourceSkill: cast.skill.name,
      detail: `Virtue recharges reduced by ${reduction} seconds`,
      icon: guardianTraitIcon(TRAIT.ILLUMINATING_INSPIRATION)
    }
  });
}

/** A surviving strike consumes the aura before queuing its hostile outcome, even on a miss. */
function detonate(runtime: GuardianRuntime, event: Gw2ResolverEvent): void {
  const state = luminaryState.from(runtime);

  if (state.lightAuraUntil <= runtime.time) return;

  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SOVEREIGN_OF_LIGHT);
  const strike = requireEffect(profile, 'strike', 'Strike');

  if (!strike) return;

  state.lightAuraUntil = 0;
  emitTraitProfile(runtime, TRAIT.SOVEREIGN_OF_LIGHT, TRAIT.SOVEREIGN_OF_LIGHT, event, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'strike', name: 'Strike' },
    // Detonation has its own critical-roll identity; delivery derives it from the cause after materialization.
    transform: ({ activationId: _activation, ...packet }) => packet,
    attribution: {
      priority: -15,
      sourceId: ID.SOVEREIGN_OF_LIGHT_DAMAGE,
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER,
      skillId: ID.SOVEREIGN_OF_LIGHT_DAMAGE,
      skillName: 'Sovereign of Light',
      name: 'Sovereign of Light',
      skillWeapon: 'Unequipped',
      triggeredBy: event.skillName,
      offTarget: event.offTarget === true,
      source: 'guardian'
    }
  });

  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Sovereign of Light',
      at: runtime.time,
      sourceSkill: event.skillName ?? '',
      detail: 'Light aura detonated',
      icon: guardianTraitIcon(TRAIT.SOVEREIGN_OF_LIGHT)
    }
  });
}

/** Only Luminary activation sources can consume a preexisting aura. */
function detonator(skill: GuardianSkill): boolean {
  return (
    skill.id !== ID.GLARING_BURST &&
    Boolean(
      skill.id === ID.RADIANT_JUSTICE ||
      skill.id === ID.RADIANT_RESOLVE ||
      skill.id === ID.RADIANT_COURAGE ||
      skill.radiantForgeSkill ||
      (skill.specialization === 'Luminary' && skill.categories?.includes('Stance'))
    )
  );
}
