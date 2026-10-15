import {
  fromProfile,
  fromModifier,
  modifierFact,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_BALANCE_PROFILE_IDS as LUMINARY } from '#gw2/professions/guardian/specializations/luminary/profiles.js';

const glaringBurstTooltip: DescribeSimulationTooltip = (balanceContext) => ({
  description:
    "Use the equipped radiant weapon's Glaring Burst. Hammer and sword strike; staff and shield grant their listed party boons. Every variant applies vulnerability after its impact. The sword alternates its attack cadence.",
  facts: [
    ...[
      [LUMINARY.glaringBurstHammer, 'hammer'],
      [LUMINARY.glaringBurstBlade, 'sword'],
      [LUMINARY.glaringBurstStaff, 'staff'],
      [LUMINARY.glaringBurstBulwark, 'shield']
    ].flatMap(
      ([id, label]) =>
        simulationEffectFacts(tooltipProfile(balanceContext, id).effects, `with ${label}; alternative`).facts
    ),
    modifierFact(
      balanceContext,
      'guardian.glaring-burst-hammer',
      'factor',
      'Additional hammer strike multiplier',
      tooltipFactorChange
    ),
    ...simulationEffectFacts(
      tooltipProfile(balanceContext, LUMINARY.glaringBurstVulnerability).effects,
      'all variants, after the impact'
    ).facts
  ]
});

const radiantForgeTooltip: DescribeSimulationTooltip = (balanceContext, entity) =>
  entity.id === ID.ENTER_RADIANT_FORGE
    ? {
        description:
          'Enter Radiant Forge and replace your weapon bar. Equipping radiant weapons changes Glaring Burst and unlocks follow-ups. Recharge starts on exit and is reduced when at most one distinct radiant weapon was used.',
        facts: [
          ...simulationEffectFacts(tooltipProfile(balanceContext, LUMINARY.forge).effects).facts,
          profileFact(
            balanceContext,
            LUMINARY.forge,
            'rechargeReduction',
            'Base recharge reduction with at most one weapon',
            tooltipSeconds
          )
        ]
      }
    : {
        description:
          'Exit Radiant Forge, restore your weapon bar, and begin its recharge. The recharge is reduced when at most one distinct radiant weapon was used.',
        facts: []
      };

const radiantWeaponTooltip: DescribeSimulationTooltip = (balanceContext, entity) =>
  skillTooltip(
    entity.flipParentId == null
      ? "Equip this radiant weapon and apply its effects. Its follow-up replaces the prior radiant weapon's follow-up, and Glaring Burst changes to match the equipped weapon. Triggers eligible weapon-equip effects."
      : "Use the equipped radiant weapon's follow-up and apply its listed effects."
  )(balanceContext, entity);

/** Describe luminary tooltips from the selected balance data. */
export const luminaryTooltips = {
  skills: {
    [ID.GLARING_BURST]: glaringBurstTooltip,
    ...Object.fromEntries([ID.ENTER_RADIANT_FORGE, ID.EXIT_RADIANT_FORGE].map((id) => [id, radiantForgeTooltip])),
    ...Object.fromEntries(
      [ID.BRILLIANT_SLAM, ID.LUCENT_THRUST, ID.RADIANT_BULWARK, ID.RESTORATIVE_GLOW].map((id) => [
        id,
        radiantWeaponTooltip
      ])
    ),
    [ID.DAZZLING_HAMMER]: skillTooltip(
      'Equip the radiant hammer, strike and daze your target, and grant party might and Fury. Radiant Justice empowers the next committed hammer hit with an additional delayed strike and vulnerability.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, LUMINARY.radiantJusticeImpact).effects,
          'additional when Radiant Justice is armed'
        ).facts
    ),
    [ID.SHINING_SPIN]: skillTooltip(
      "Use the radiant hammer's follow-up strike. Damage increases against an eligible disabled target.",
      [fromModifier('guardian.shining-spin', 'factor', 'Strike damage against disabled targets', tooltipFactorChange)]
    ),
    [ID.GLEAMING_BLADE]: skillTooltip(
      "Equip the radiant sword and strike your target. Consume an armed Radiant Courage sword bonus to increase this impact's damage.",
      [fromModifier('guardian.gleaming-blade', 'factor', 'Strike damage with Radiant Courage', tooltipFactorChange)]
    ),
    [ID.LUMINOUS_STAFF]: skillTooltip(
      'Equip the radiant staff, grant party protection, and create a damaging symbol. An armed Radiant Resolve also grants party regeneration once.'
    ),
    [ID.RADIANT_JUSTICE]: skillTooltip(
      'Activate Justice and arm an additional delayed strike and vulnerability for the next Dazzling Hammer impact.'
    ),
    [ID.RADIANT_RESOLVE]: skillTooltip(
      'Activate Resolve and empower the next Luminous Staff with an additional party regeneration grant. Healing is outside combat simulation scope.'
    ),
    [ID.RADIANT_COURAGE]: skillTooltip(
      "Activate Courage, grant party aegis and resistance, and arm its sword and shield enhancements. The sword enhancement increases Gleaming Blade's impact damage."
    ),
    [ID.PIERCING_STANCE]: skillTooltip(
      'Enter Piercing Stance to increase strike damage. Repeated applications add to its remaining duration.',
      [fromModifier('guardian.piercing-stance', 'amount', 'Strike damage while active')]
    ),
    [ID.DARING_ADVANCE]: skillTooltip(
      'Apply these effects and gain a temporary strike-damage bonus. Its own impact benefits only when an earlier application was already active.',
      [fromModifier('guardian.daring-advance', 'factor', 'Strike damage while active', tooltipFactorChange)]
    ),
    [ID.EFFULGENT_STANCE]: skillTooltip(
      'Count qualifying Guardian-owned strike packets during the stance, then detonate. Each counted packet increases the detonation coefficient; reaching the stack cap also dazes the target.',
      (balanceContext) => [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, LUMINARY.effulgentStance).effects?.filter(
            (effect) => effect.type === 'strike'
          ),
          'base detonation'
        ).facts,
        profileFact(
          balanceContext,
          LUMINARY.effulgentStance,
          'damageIncreasePerStack',
          'Additional coefficient per counted hit'
        ),
        profileFact(balanceContext, LUMINARY.effulgentStance, 'maximumStacks', 'Maximum counted hits')
      ]
    )
  },
  traits: {
    [TRAIT.LUMINARY]: traitTooltip('Unlock Radiant Forge, radiant weapons, and radiant virtues.'),
    [TRAIT.LIGHTS_GIFT]: traitTooltip('Gain vitality.', [['attributeBonus', 'Vitality']]),
    [TRAIT.RADIANT_ARMAMENTS]: traitTooltip(
      'Equipping a radiant hammer temporarily increases strike damage. Equipping another radiant weapon removes the hammer bonus.',
      [fromProfile(TRAIT.RADIANT_ARMAMENTS, 'damageIncrease', 'Radiant hammer strike damage', tooltipPercent)]
    ),
    [TRAIT.SHIMMERING_STANCES]: traitTooltip('Completed stances grant protection to the party and blind the target.'),
    [TRAIT.RESOLUTE_BLESSING]: outsideScopeTooltip,
    [TRAIT.PERSISTENT_BLESSING]: outsideScopeTooltip,
    [TRAIT.RESPLENDENT_WEAPONRY]: traitTooltip(
      'Successfully equipping a radiant weapon grants alacrity, might, and fury to the party.'
    ),
    [TRAIT.PURGING_LIGHT]: outsideScopeTooltip,
    [TRAIT.EMPOWERED_ARMAMENTS]: traitTooltip(
      'Equipping radiant weapons grants or extends a strike-damage bonus, up to its remaining-duration cap.',
      [
        fromProfile(TRAIT.EMPOWERED_ARMAMENTS, 'damageIncrease', 'Strike damage', tooltipPercent),
        ['resourceGain', 'Duration added per equip', tooltipSeconds],
        ['maximumStacks', 'Maximum remaining duration', tooltipSeconds]
      ]
    ),
    [TRAIT.ILLUMINATING_INSPIRATION]: traitTooltip('Equipping radiant weapons reduces radiant virtue cooldowns.', [
      ['rechargeReduction', 'Virtue recharge reduction', tooltipSeconds]
    ]),
    [TRAIT.SOVEREIGN_OF_LIGHT]: traitTooltip(
      'Entering Radiant Forge grants a light aura. Eligible Luminary skills detonate an active light aura, dealing a strike. Glaring Burst is excluded.'
    ),
    [TRAIT.MASTER_AT_ARMS]: traitTooltip(
      'Activating a radiant virtue resets the recharge of its corresponding radiant weapon skills: Justice resets hammer, Resolve resets staff, and Courage resets sword and shield.'
    )
  }
} satisfies ProfessionTooltips;
