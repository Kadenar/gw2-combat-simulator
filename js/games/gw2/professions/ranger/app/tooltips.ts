import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  fromProfile,
  fromModifier,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  modifierFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/ranger/core/profile-ids.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as SOULBEAST } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { DRUID_BALANCE_PROFILE_IDS as DRUID } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { UNTAMED_BALANCE_PROFILE_IDS as UNTAMED } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { GALESHOT_BALANCE_PROFILE_IDS as GALESHOT } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';
import { UNTAMED_AMBUSH_SKILL_IDS } from '#gw2/professions/ranger/data/untamed-ambushes.js';

/** Replace the delivery marker with its selected trait payload when describing ambush damage. */
const ambushTooltip: DescribeSimulationTooltip = (context, entity) => {
  const skill = context.catalog.skillsById.get(entity.id)!;
  const effects = skill.effects?.flatMap((effect) =>
    effect.type === 'custom' && effect.eventType === 'ranger.natural-fortitude'
      ? (tooltipProfile(context, TRAIT.NATURAL_FORTITUDE).effects ?? [])
      : [effect]
  );
  return {
    ...simulationEffectFacts(effects),
    description: 'Use the available unleashed ambush and consume its window. Apply eligible ambush traits.'
  };
};

/** Descriptions bind to canonical skill identities independently of runtime dispatch. */
const familyTooltips = {
  'ranger.dodge': skillTooltip(
    'Spend endurance to dodge and trigger applicable dodge traits. Incoming damage is outside combat simulation scope.',
    [fromProfile(CORE.resources, 'resourceCost', 'Endurance spent')]
  ),
  'ranger.pet-swap': skillTooltip(
    'Switch to the other selected pet, update its command skills, and trigger pet-swap traits. The new pet receives a fresh Opening Strike opportunity.'
  ),
  'ranger.weapon-swap': skillTooltip('Swap weapon sets and trigger applicable weapon-swap effects.'),
  'ranger.hilt-bash': skillTooltip(
    "Strike and daze the target, or stun it if it is defiant. Completing the cast resets Maul's recharge."
  ),
  'ranger.winters-bite': skillTooltip(
    "Strike and chill the target. Arm Weakness for a later qualifying hit through Soulbeast's Winter's Bite reaction.",
    (balanceContext) =>
      simulationEffectFacts(tooltipProfile(balanceContext, SOULBEAST.wintersBite).effects, 'armed follow-up').facts
  ),
  'ranger.sun-spirit': skillTooltip(
    "Apply the spirit's effects and trigger Solar Flare Burning.",
    (balanceContext) =>
      simulationEffectFacts(tooltipProfile(balanceContext, CORE.sunSpirit).effects, 'Solar Flare').facts
  ),
  'ranger.sharpening-stone': skillTooltip(
    'Arm bleeding charges for your qualifying strikes. Each hit consumes the charge with the earliest expiry.',
    (balanceContext) => [
      profileFact(balanceContext, CORE.sharpeningStone, 'playerStacks', 'Bleeding charges'),
      profileFact(balanceContext, CORE.sharpeningStone, 'durationMultiplier', 'Charge lifetime', tooltipSeconds),
      ...simulationEffectFacts(tooltipProfile(balanceContext, CORE.sharpeningStone).effects, 'per charge consumed')
        .facts
    ]
  ),
  'ranger.poisonous-strikes': skillTooltip(
    "Strike and arm Poisonous Strikes. Your pet's qualifying hits consume the charges; while merged in Beastmode, your hits consume the same charges instead.",
    (balanceContext) => [
      profileFact(balanceContext, CORE.poisonousStrikes, 'playerStacks', 'Poison charges'),
      profileFact(balanceContext, CORE.poisonousStrikes, 'durationMultiplier', 'Charge lifetime', tooltipSeconds),
      ...simulationEffectFacts(tooltipProfile(balanceContext, CORE.poisonousStrikes).effects, 'per charge consumed')
        .facts
    ]
  ),
  'ranger.crippling-shot': skillTooltip(
    'Cripple the target and arm Blood Thirst. Subsequent qualifying hits consume its bleeding charges; the arming skill cannot spend them.',
    (balanceContext) => [
      profileFact(balanceContext, CORE.bloodThirst, 'playerStacks', 'Bleeding charges'),
      profileFact(balanceContext, CORE.bloodThirst, 'durationMultiplier', 'Charge lifetime', tooltipSeconds),
      ...simulationEffectFacts(tooltipProfile(balanceContext, CORE.bloodThirst).effects, 'per charge consumed').facts
    ]
  ),
  'ranger.sic-em': skillTooltip(
    "Temporarily increase your active pet's strike damage. Soulbeast applies the separate player bonus while merged.",
    [
      fromProfile(CORE.sicEm, 'durationMultiplier', 'Base duration', tooltipSeconds),
      fromModifier('ranger.sic-em-pet', 'factor', 'Pet strike damage', tooltipFactorChange),
      fromModifier('ranger.sic-em-player', 'factor', 'Merged player strike damage', tooltipFactorChange)
    ]
  ),
  'ranger.beastmode-enter': skillTooltip(
    'Merge with your active pet, replace its commands with Beastmode skills, and gain its archetype attributes. The pet stops acting independently while merged. Trigger applicable Beastmode traits.'
  ),
  'ranger.beastmode-exit': skillTooltip(
    "Leave Beastmode, restore your pet's independent actions and command skills, and remove the merged archetype attributes. Trigger applicable Beastmode traits."
  ),
  'ranger.one-wolf-pack': skillTooltip(
    'Qualifying player strikes trigger a delayed additional strike during the stance. The echo cannot trigger itself. Leader of the Pack extends the stance and shares it with configured allies for 50% of your duration.',
    (balanceContext) => [
      profileFact(balanceContext, SOULBEAST.oneWolfPack, 'durationMultiplier', 'Base stance duration', tooltipSeconds),
      profileFact(balanceContext, SOULBEAST.oneWolfPack, 'internalCooldown', 'Minimum echo interval', tooltipSeconds),
      ...simulationEffectFacts(tooltipProfile(balanceContext, SOULBEAST.oneWolfPack).effects, 'per echo').facts
    ]
  ),
  'ranger.vulture-stance': skillTooltip(
    'Qualifying player strikes inflict poison and grant might during the stance, subject to its trigger interval. Leader of the Pack extends the stance and shares it with configured allies for 50% of your duration.',
    (balanceContext) => [
      profileFact(
        balanceContext,
        SOULBEAST.vultureStance,
        'durationMultiplier',
        'Base stance duration',
        tooltipSeconds
      ),
      profileFact(balanceContext, SOULBEAST.vultureStance, 'internalCooldown', 'Trigger interval', tooltipSeconds),
      ...simulationEffectFacts(tooltipProfile(balanceContext, SOULBEAST.vultureStance).effects, 'per trigger').facts
    ]
  ),
  'ranger.celestial-avatar-enter': skillTooltip(
    'Enter Celestial Avatar and replace your weapon bar. Astral force drains until you leave or it is depleted. Entry triggers applicable Avatar and weapon-swap effects.',
    [
      fromProfile(DRUID.resources, 'durationMultiplier', 'Maximum Avatar duration from full force', tooltipSeconds),
      fromProfile(DRUID.resources, 'maximumStacks', 'Full astral force')
    ]
  ),
  'ranger.celestial-avatar-exit': skillTooltip(
    'Leave Celestial Avatar and restore your weapon skills. Retain part of your remaining astral force; automatic exit from exhaustion retains none. Trigger applicable exit and weapon-swap effects.',
    [
      fromProfile(
        DRUID.resources,
        'astralForceRetentionMultiplier',
        'Remaining astral force retained',
        (value) => `${tooltipDecimal(value * 100)}%`
      )
    ]
  ),
  'ranger.celestial-avatar-skill': skillTooltip(
    'Use this skill while Celestial Avatar is active. Apply its direct effects and eligible Eclipse or Grace of the Land effects. Healing is outside combat simulation scope.'
  ),
  'ranger.unleash-ranger': skillTooltip(
    "Unleash yourself and restore your pet's ordinary commands. Open a temporary unleashed-ambush window when the shared ambush cooldown is ready.",
    [
      fromProfile(UNTAMED.resources, 'durationMultiplier', 'Ambush window', tooltipSeconds),
      fromProfile(UNTAMED.resources, 'internalCooldown', 'Ambush grant cooldown', tooltipSeconds)
    ]
  ),
  'ranger.unleash-pet': skillTooltip(
    'Unleash your pet and replace its commands with unleashed skills. Your weapon and trait effects follow the pet-unleashed state.'
  ),
  'ranger.unleashed-ambush': ambushTooltip,
  'ranger.exploding-spores': skillTooltip(
    'Strike, poison, and control the target. Gain might if you were unleashed at cast start, or protection if your pet was unleashed.',
    (balanceContext) => [
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, UNTAMED.explodingSporesRanger).effects,
        'ranger unleashed; alternative'
      ).facts,
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, UNTAMED.explodingSporesPet).effects,
        'pet unleashed; alternative'
      ).facts
    ]
  ),
  'ranger.venomous-outburst': skillTooltip(
    'Your unleashed pet attacks. It additionally applies vulnerability against a defiant target.'
  ),
  'ranger.cyclone-bow-enter': skillTooltip(
    'Equip the Cyclone Bow and replace your weapon skills. Trigger applicable weapon-swap effects. Arrows regenerate over time and are shared across its skills.',
    [
      fromProfile(GALESHOT.resources, 'maximumStacks', 'Arrow capacity'),
      fromProfile(GALESHOT.resources, 'pulseInterval', 'Base arrow regeneration interval', tooltipSeconds)
    ]
  ),
  'ranger.cyclone-bow-exit': skillTooltip(
    'Dismiss the Cyclone Bow, clear Wind Force, and restore your weapon skills. Trigger applicable weapon-swap effects.'
  ),
  'ranger.cyclone-bow-skill': skillTooltip(
    'Use this Cyclone Bow skill, spend its arrows, and gain the listed Wind Force. Apply eligible Cyclone Bow traits.'
  ),
  'ranger.galeshot-arrows': skillTooltip(
    "Apply this skill's effects and restore Cyclone Bow arrows up to their capacity."
  ),
  'ranger.mistral': skillTooltip(
    'Restore arrows and arm Mistral. Each eligible missile hit during its window adds a strike and Chilled.',
    (balanceContext) => [
      profileFact(balanceContext, GALESHOT.mistral, 'durationMultiplier', 'Mistral window', tooltipSeconds),
      ...simulationEffectFacts(tooltipProfile(balanceContext, GALESHOT.mistral).effects, 'per eligible missile hit')
        .facts
    ]
  )
} satisfies Record<string, DescribeSimulationTooltip>;
const familySkillIds: Record<keyof typeof familyTooltips, readonly (number | string)[]> = {
  'ranger.dodge': [SHARED_SKILL_IDS.DODGE],
  'ranger.pet-swap': [ID.PET_SWAP],
  'ranger.weapon-swap': [SHARED_SKILL_IDS.SWAP_WEAPONS],
  'ranger.hilt-bash': [ID.HILT_BASH],
  'ranger.winters-bite': [ID.WINTERS_BITE],
  'ranger.sun-spirit': [ID.SUN_SPIRIT],
  'ranger.sharpening-stone': [ID.SHARPENING_STONE],
  'ranger.poisonous-strikes': [ID.DOUBLE_ARC],
  'ranger.crippling-shot': [ID.CRIPPLING_SHOT],
  'ranger.sic-em': [ID.SIC_EM],
  'ranger.beastmode-enter': [ID.BEASTMODE],
  'ranger.beastmode-exit': [ID.LEAVE_BEASTMODE],
  'ranger.one-wolf-pack': [ID.ONE_WOLF_PACK],
  'ranger.vulture-stance': [ID.VULTURE_STANCE],
  'ranger.celestial-avatar-enter': [ID.CELESTIAL_AVATAR],
  'ranger.celestial-avatar-exit': [ID.RELEASE_CELESTIAL_AVATAR],
  'ranger.celestial-avatar-skill': [
    ID.COSMIC_RAY,
    ID.SEED_OF_LIFE,
    ID.LUNAR_IMPACT,
    ID.REJUVENATING_TIDES,
    ID.NATURAL_CONVERGENCE
  ],
  'ranger.unleash-ranger': [ID.UNLEASH_RANGER],
  'ranger.unleash-pet': [ID.UNLEASH_PET],
  'ranger.unleashed-ambush': UNTAMED_AMBUSH_SKILL_IDS,
  'ranger.exploding-spores': [ID.EXPLODING_SPORES],
  'ranger.venomous-outburst': [ID.VENOMOUS_OUTBURST],
  'ranger.cyclone-bow-enter': [ID.SUMMON_CYCLONE_BOW],
  'ranger.cyclone-bow-exit': [ID.DISMISS_CYCLONE_BOW],
  'ranger.cyclone-bow-skill': [
    ID.HAWKEYE,
    ID.BLUSTER,
    ID.FLEETING_ZEPHYR,
    ID.QUARRYS_PERIL,
    ID.PELT,
    ID.SUPERSONIC_ARROW
  ],
  'ranger.galeshot-arrows': [ID.PERFECT_STORM, ID.PIERCING_GALES],
  'ranger.mistral': [ID.MISTRAL]
};

/** Spirit prose describes its slam marker; ordinary boon and combo facts still come from the selected catalog. */
function spiritTooltip(description: string): DescribeSimulationTooltip {
  return (context, entity) => {
    const skill = context.catalog.skillsById.get(entity.id);
    if (!skill) throw new Error(`Missing tooltip skill: ${entity.id}`);
    const effects = (skill.effects ?? []).filter(
      (effect) =>
        !(
          effect.type === 'custom' &&
          effect.eventType === 'marker' &&
          effect.metadata?.packetKind === 'ranger.spirit-slam'
        )
    );
    return { ...simulationEffectFacts(effects), description };
  };
}

/** Keep companion bonuses and form-dependent alternatives separate while sharing the simulation's balance inputs. */
export const rangerTooltips: ProfessionTooltips = {
  skillFacts: (balanceContext, entity) => [
    ...(entity.id === ID.ENDURING_SWING
      ? [profileFact(balanceContext, ID.ENDURING_SWING, 'resourceGain', 'Endurance gained')]
      : []),
    ...[
      ['arrowCost', 'Arrows spent'],
      ['windForceGain', 'Wind Force gained'],
      ['arrowsRestored', 'Arrows restored']
    ].flatMap(([field, name]) =>
      entity[field] == null ? [] : [{ name, detail: tooltipDecimal(tooltipNumber(entity, field)) }]
    ),
    // Some weapon packets opt into conditional rules through damageKind rather than a custom handler.
    ...(entity.effects?.some((effect) => String(effect.damageKind).startsWith('ranger-unleashed-disabled'))
      ? [
          modifierFact(
            balanceContext,
            'ranger.disabled-skill-bonus',
            'factor',
            'Strike damage against defiant targets',
            tooltipFactorChange
          )
        ]
      : []),
    ...(entity.effects?.some((effect) => effect.damageKind === 'ranger-unleashed-disabled-condition-count')
      ? [
          modifierFact(
            balanceContext,
            'ranger.condition-count-skill-bonus',
            'damagePerCondition',
            'Additional strike damage per target condition'
          )
        ]
      : []),
    ...(entity.effects?.some((effect) => effect.damageKind === 'ranger-pounce-defiant')
      ? [
          modifierFact(
            balanceContext,
            'ranger.pounce-defiant',
            'factor',
            'Strike damage against defiant targets',
            tooltipFactorChange
          )
        ]
      : []),
    // Spear leap health bonuses are rendered from their strike coefficient modifiers by the shared tooltip.
    ...(entity.id === ID.FALCONS_STOOP
      ? [
          modifierFact(
            balanceContext,
            'ranger.falcons-stoop-disabled',
            'factor',
            'Strike damage against defiant or immobilized targets',
            tooltipFactorChange
          )
        ]
      : []),
    ...(entity.id === ID.CONSUMING_BITE
      ? [
          modifierFact(
            balanceContext,
            'ranger.consuming-bite-condition-count',
            'coefficientPerCondition',
            'Additional coefficient per target condition',
            tooltipDecimal
          ),
          modifierFact(
            balanceContext,
            'ranger.consuming-bite-condition-count',
            'maximumConditions',
            'Maximum target conditions counted',
            tooltipDecimal
          )
        ]
      : [])
  ],
  skills: {
    [ID.FROST_SPIRIT]: spiritTooltip(
      "Grant resistance on summon, perform Cold Snap's blast finisher, then grant resolution with four shakes. Nature's Vengeance repeats the slam after the final shake. Condition cleansing is outside combat simulation scope."
    ),
    [ID.WATER_SPIRIT]: spiritTooltip(
      "Summon a water spirit and grant vigor with four shakes. Aqua Surge's slam is recorded and repeats after the final shake with Nature's Vengeance. Healing is outside combat simulation scope."
    ),
    [ID.SPIRIT_OF_NATURE]: spiritTooltip(
      "Summon a spirit of nature and grant regeneration with four shakes. Nature's Renewal's slam is recorded and repeats after the final shake with Nature's Vengeance. Condition conversion and revival are outside combat simulation scope."
    ),
    [ID.CRIPPLING_ANGUISH_PET]: skillTooltip(
      'The pet applies confusion and torment. Quickness uses a separate autonomous recharge.',
      [
        fromProfile(
          CORE.cripplingAnguishQuickness,
          'cooldown',
          'Pet recharge with quickness before Alacrity',
          tooltipSeconds
        )
      ]
    ),
    ...Object.fromEntries(
      Object.entries(familySkillIds).flatMap(([family, ids]) =>
        ids.map((id) => [id, familyTooltips[family as keyof typeof familyTooltips]])
      )
    ),
    ...Object.fromEntries(
      [ID.MAUL_SOULBEAST, ID.MAUL_BASE].map((id) => [
        id,
        skillTooltip(
          id === ID.MAUL_SOULBEAST
            ? 'Strike and grant yourself Attack of Opportunity after the impact while merged. It empowers your next direct attack. Trait and stance damage cannot consume it.'
            : "Strike and grant your pet Attack of Opportunity after the impact. It empowers your pet's next direct attack. Trait and stance damage cannot consume it.",
          [
            fromProfile(CORE.attackOfOpportunity, 'durationMultiplier', 'Next-attack window', tooltipSeconds),
            fromModifier(
              'ranger.attack-of-opportunity',
              id === ID.MAUL_SOULBEAST ? 'playerFactor' : 'petFactor',
              id === ID.MAUL_SOULBEAST ? 'Player next-attack damage' : 'Pet next-attack damage',
              tooltipFactorChange
            )
          ]
        )
      ])
    ),
    ...Object.fromEntries(
      [ID.PATH_OF_SCARS, ID.PATH_OF_SCARS_MAX_RANGE].map((id) => [
        id,
        skillTooltip(
          "Strike on the axe's outward and returning paths. The normal and maximum-range variants share their recharge."
        )
      ])
    ),
    ...Object.fromEntries(
      Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT).map((id) => [
        id,
        skillTooltip(
          "Use an empowered spear attack available through stealth or Hunter's Prowess. Starting it consumes the choice, ends stealth, and applies Revealed. Spear slots two through four share recharge with their ordinary versions."
        )
      ])
    ),
    [ID.PANTHERS_PROWL]: skillTooltip(
      "Gain stealth and Hunter's Prowess, temporarily enabling an empowered spear attack even while Revealed. Starting an empowered attack consumes the choice."
    ),
    [ID.COUNTERATTACK]: skillTooltip(
      'Unlock the counterattack follow-up. Incoming attacks and blocking are outside combat simulation scope.'
    ),
    [ID.WE_HEAL_AS_ONE]: skillTooltip(
      "Copy your pet's current boons to yourself and your boons to the pet, using this skill's copy durations. While merged, copy your own boons to yourself. Healing is outside combat simulation scope."
    ),
    [ID.STRENGTH_OF_THE_PACK]: skillTooltip(
      'Grant the listed boons and arm might generation for your active pet. While the buff lasts, your qualifying strikes grant might to that pet.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.strengthOfThePack).effects,
          'to your active pet per qualifying player hit'
        ).facts
    ),
    [ID.SIGNET_OF_THE_WILD]: skillTooltip(
      'Gain passive ferocity while the signet is ready. Activating the signet applies its listed effects and suspends the passive until recharge finishes.',
      [fromProfile(CORE.signetOfTheWild, 'attributeBonus', 'Passive ferocity')]
    ),
    [ID.STALKERS_STRIKE]: skillTooltip(
      'Strike and poison your target. Against a movement-impaired target, the strike deals increased damage and adds further poison.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          CORE.stalkersStrikeImpaired,
          'damageMultiplier',
          'Strike damage against movement-impaired targets',
          tooltipFactorChange
        ),
        ...simulationEffectFacts(tooltipProfile(balanceContext, CORE.stalkersStrikeImpaired).effects).facts
      ]
    ),
    [ID.FROST_TRAP]: skillTooltip(
      'Lay a trap that strikes and chills in an ice field. When precast before an explicit combat start, the trap remains armed and releases its full pulse sequence when combat begins.'
    ),
    [ID.HAWKEYE]: skillTooltip(
      'At full Wind Force, replace Keen Shot with this empowered attack. Consume all Wind Force and the listed arrows, then trigger eligible Gale Force and Cloudburst effects.',
      [fromProfile(GALESHOT.resources, 'minimumStacks', 'Wind Force required and consumed')]
    ),
    [ID.KEEN_SHOT]: skillTooltip(
      "Fire the Cyclone Bow's basic arrow. At full Wind Force, Hawkeye replaces this skill."
    ),
    [ID.BLUSTER]: skillTooltip(
      "Fire the Cyclone Bow attack and gain Wind Force. With Wuthering Wind, arm the active pet's next eligible hit for an additional strike. Cloudburst can grant party boons."
    ),
    [ID.QUARRYS_PERIL]: skillTooltip(
      "Fire the Cyclone Bow attack, spend arrows, and gain Wind Force. Cloudburst resets Bluster's recharge; Perilous Skies replaces this skill with Pelt."
    ),
    [ID.SUPERSONIC_ARROW]: skillTooltip(
      "Fire the Cyclone Bow attack, spend arrows, and gain Wind Force. Cloudburst resets Bluster's recharge when selected."
    )
  },
  traits: {
    [TRAIT.OPENING_STRIKE]: traitTooltip(
      "Your first qualifying strike and your pet's first qualifying strike independently inflict vulnerability."
    ),
    [TRAIT.ALPHA_FOCUS]: traitTooltip('Opening Strike also cripples the target.'),
    [TRAIT.PRECISE_STRIKE]: traitTooltip('Opening Strike gains critical-strike chance for you and your pet.', [
      ['criticalChance', 'Opening Strike critical chance', tooltipPercent]
    ]),
    [TRAIT.STONEFORM]: outsideScopeTooltip,
    [TRAIT.HUNTERS_GAZE]: traitTooltip(
      'Your strikes grant might against low-health targets. Lower target-health tiers grant more stacks.',
      [
        ['internalCooldown', 'Internal cooldown', tooltipSeconds],
        ['maximumStacks', 'Might stacks in the lowest health tier'],
        ['lowerThreshold', 'Lowest target-health threshold', tooltipPercent],
        ['threshold', 'Middle target-health threshold', tooltipPercent],
        ['upperThreshold', 'Highest target-health threshold', tooltipPercent]
      ],
      'base application; stacks depend on target health'
    ),
    [TRAIT.CLARION_BOND]: traitTooltip(
      'Swapping pets triggers Lesser Call of the Wild: grant party boons, weaken the target, and perform a blast finisher.',
      [['cooldown', 'Base skill recharge', tooltipSeconds]]
    ),
    [TRAIT.WOLFSONG]: traitTooltip(
      'Your strikes deal increased damage against vulnerable targets. Using a beast skill with a canine pet inflicts vulnerability.',
      [fromProfile(TRAIT.WOLFSONG, 'damageMultiplier', 'Strike damage against vulnerable targets', tooltipFactorChange)]
    ),
    [TRAIT.FARSIGHTED]: traitTooltip('Your weapon skills deal increased strike damage.', [
      fromProfile(TRAIT.FARSIGHTED, 'damageMultiplier', 'Weapon strike damage', tooltipFactorChange)
    ]),
    [TRAIT.MOMENT_OF_CLARITY]: outsideScopeTooltip,
    [TRAIT.PREDATORS_ONSLAUGHT]: traitTooltip(
      'You and your pet deal increased strike damage against movement-impaired targets.',
      [
        fromProfile(TRAIT.PREDATORS_ONSLAUGHT, 'damageMultiplier', 'Player strike damage', tooltipFactorChange),
        fromProfile(TRAIT.PREDATORS_ONSLAUGHT, 'damageMultiplier', 'Pet strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.REMORSELESS]: traitTooltip(
      'Receiving fury on yourself refreshes Opening Strike for you and your pet. Opening Strike deals increased damage.',
      [fromProfile(TRAIT.REMORSELESS, 'damageMultiplier', 'Opening Strike damage', tooltipFactorChange)]
    ),
    [TRAIT.LEAD_THE_WIND]: traitTooltip(
      'Longbow skills recharge faster. Point-Blank Shot grants swiftness and quickness.',
      [['rechargeMultiplier', 'Longbow recharge', tooltipFactorChange]]
    ),
    [TRAIT.REJUVENATION]: traitTooltip(
      'Using an eligible beast skill grants regeneration to the party.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]],
      'party'
    ),
    [TRAIT.FORTIFYING_BOND]: traitTooltip(
      "Boons received from players are shared with your active pet using the ranger's boon duration. Permanent boon settings represent training-console pulses and also trigger sharing. Inactive in Beastmode; other NPC boons do not trigger sharing.",
      [['pulseInterval', 'Configured boon refresh interval', tooltipSeconds]],
      'summons'
    ),
    [TRAIT.LINGERING_MAGIC]: traitTooltip('Gain concentration.', [['attributeBonus', 'Concentration']]),
    [TRAIT.BOUNTIFUL_HUNTER]: traitTooltip(
      'You and your pet deal increased strike damage for each different boon affecting the respective attacker.',
      [
        fromProfile(TRAIT.BOUNTIFUL_HUNTER, 'damagePerBoon', 'Player strike damage per boon', tooltipPercent),
        fromProfile(TRAIT.BOUNTIFUL_HUNTER, 'damagePerBoon', 'Pet strike damage per boon', tooltipPercent)
      ]
    ),
    [TRAIT.WELLSPRING]: traitTooltip(
      'Gain healing power from power. Completing a healing skill grants regeneration to the party.',
      [['attributeConversion', 'Power converted to healing power', tooltipPercent]],
      'party'
    ),
    [TRAIT.ALLIES_AID]: outsideScopeTooltip,
    [TRAIT.EVASIVE_PURITY]: outsideScopeTooltip,
    [TRAIT.SPIRITED_ARRIVAL]: traitTooltip(
      'Swapping pets in combat grants might and fury to the party.',
      () => [],
      'party'
    ),
    [TRAIT.WINDBORNE_NOTES]: traitTooltip(
      'Completing a warhorn skill grants regeneration to the party.',
      () => [],
      'party'
    ),
    [TRAIT.NATURES_VENGEANCE]: traitTooltip(
      'Spirits repeat their slam after their final boon shake. Summon effects and boon pulses are not repeated.',
      [['baseDuration', 'Delay after final shake', tooltipSeconds]]
    ),
    [TRAIT.PROTECTIVE_WARD]: outsideScopeTooltip,
    [TRAIT.INVIGORATING_BOND]: outsideScopeTooltip,
    [TRAIT.TAIL_WIND]: traitTooltip('Swapping weapons in combat grants swiftness.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.FURIOUS_GRIP]: traitTooltip('Swapping weapons in combat grants fury.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.HUNTERS_TACTICS]: traitTooltip(
      'Gain personal strike damage and critical-strike chance when flanking. The simulator treats defiant targets as flanked.',
      [
        fromProfile(TRAIT.HUNTERS_TACTICS, 'damageMultiplier', 'Strike damage', tooltipFactorChange),
        ['criticalChance', 'Critical chance', tooltipPercent]
      ]
    ),
    [TRAIT.SHARPENED_EDGES]: traitTooltip('Critical hits from you and your pet have a chance to inflict bleeding.', [
      ['criticalChance', 'Chance on critical hit', tooltipPercent]
    ]),
    [TRAIT.PRIMAL_REFLEXES]: outsideScopeTooltip,
    [TRAIT.TRAPPERS_EXPERTISE]: traitTooltip(
      'Trap conditions last longer, using a separate multiplier for Flame Trap. Traps also cripple the target.',
      [
        ['durationMultiplier', 'Trap condition duration', tooltipFactorChange],
        ['coefficientMultiplier', 'Flame Trap condition duration', tooltipFactorChange]
      ]
    ),
    [TRAIT.FANG_AND_CLAW]: traitTooltip('Feline, avian, and drake pets gain precision and ferocity.', [
      ['attributeBonus', 'Pet precision'],
      ['weaponAttributeBonus', 'Pet ferocity']
    ]),
    [TRAIT.STRIDERS_STRENGTH]: traitTooltip('You and your pet gain power. Wielding a sword increases your bonus.', [
      ['attributeBonus', 'Base power'],
      ['weaponAttributeBonus', 'Power while wielding a sword']
    ]),
    [TRAIT.HIDDEN_BARBS]: traitTooltip('Bleeding deals increased damage.', [
      fromProfile(TRAIT.HIDDEN_BARBS, 'conditionDamageMultiplier', 'Bleeding damage', tooltipFactorChange)
    ]),
    [TRAIT.QUICK_DRAW]: traitTooltip(
      'Swapping weapons in combat grants quickness and opens a brief window. The next non-autoattack weapon skill used in that window has reduced recharge.',
      [
        ['internalCooldown', 'Internal cooldown', tooltipSeconds],
        ['durationMultiplier', 'Quick Draw', tooltipSeconds],
        ['rechargeMultiplier', 'Next eligible skill recharge', tooltipFactorChange]
      ]
    ),
    [TRAIT.LIGHT_ON_YOUR_FEET]: traitTooltip(
      'Dodging or using an evade skill adds a temporary strike-damage and condition-duration bonus. Shortbow recharges faster; flanking extends selected shortbow conditions and Concussion Shot applies vulnerability.',
      [
        fromProfile(TRAIT.LIGHT_ON_YOUR_FEET, 'damageMultiplier', 'Strike damage during bonus', tooltipFactorChange),
        ['conditionDurationBonus', 'Condition duration during bonus', tooltipPercent],
        ['rechargeMultiplier', 'Shortbow recharge', tooltipFactorChange],
        ['durationPerTier', 'Crossfire bleeding / Poison Volley poison extension', tooltipSeconds],
        ['minimumStacks', 'Crippling Shot immobilize extension', tooltipSeconds]
      ]
    ),
    [TRAIT.VICIOUS_QUARRY]: traitTooltip('Gain ferocity and additional critical-strike chance while fury is active.', [
      ['attributeBonus', 'Ferocity'],
      ['criticalChance', 'Additional critical chance with fury', tooltipPercent]
    ]),
    [TRAIT.PACK_ALPHA]: traitTooltip(
      'Your pet gains power, precision, toughness, vitality, and condition damage. Beastmode grants the smaller player bonus. Pet skills recharge faster.',
      [
        ['weaponAttributeBonus', 'Pet bonus to each attribute'],
        ['attributeBonus', 'Player bonus to each attribute in Beastmode'],
        ['rechargeMultiplier', 'Pet skill recharge', tooltipFactorChange]
      ]
    ),
    [TRAIT.LOUD_WHISTLE]: traitTooltip(
      'Your pet deals increased strike damage. Beastmode grants a separate personal strike-damage bonus.',
      [
        fromProfile(TRAIT.LOUD_WHISTLE, 'damageMultiplier', 'Pet strike damage', tooltipFactorChange),
        fromProfile(
          TRAIT.LOUD_WHISTLE,
          'playerDamageMultiplier',
          'Player strike damage in Beastmode',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.PETS_PROWESS]: traitTooltip('Your pet gains ferocity. The bonus also applies to you in Beastmode.', [
      ['attributeBonus', 'Ferocity']
    ]),
    [TRAIT.GO_FOR_THE_EYES]: traitTooltip('The first hit of your merged Beast Ability blinds the target.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.NATURAL_HEALING]: outsideScopeTooltip,
    [TRAIT.RESOUNDING_TIMBRE]: traitTooltip(
      'Completing a command copies your current boons to the active pet. In Beastmode, commands extend your boons instead.',
      [['durationMultiplier', 'Beastmode boon extension', tooltipSeconds]]
    ),
    [TRAIT.WILTING_STRIKE]: traitTooltip('The first hit of your merged Beast Ability weakens the target.'),
    [TRAIT.BESTIAL_RAGE]: traitTooltip('Control effects while playing Soulbeast grant might and fury.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.HONED_AXES]: traitTooltip(
      'You and your pet gain ferocity. Wielding an axe increases your bonus. Axe skills recharge faster.',
      [
        ['attributeBonus', 'Base ferocity'],
        ['weaponAttributeBonus', 'Ferocity while wielding an axe'],
        ['rechargeMultiplier', 'Axe recharge', tooltipFactorChange]
      ]
    ),
    [TRAIT.BEASTLY_WARDEN]: traitTooltip('Ursine and porcine pets deal increased strike damage.', [
      ['damageMultiplier', 'Pet strike damage', tooltipFactorChange]
    ]),
    [TRAIT.ZEPHYRS_SPEED]: outsideScopeTooltip,
    [TRAIT.GO_FOR_THE_THROAT]: (balanceContext, entity) => ({
      description:
        "Your pet's beast-skill hit grants it Lesser Sic 'Em. The first hit of your merged Beast Ability grants the separate personal bonus instead.",
      facts: [
        profileFact(balanceContext, entity.id, 'cooldown', 'Base skill recharge', tooltipSeconds),
        profileFact(
          balanceContext,
          TRAIT.GO_FOR_THE_THROAT,
          'damageMultiplier',
          'Pet strike damage',
          tooltipFactorChange
        ),
        profileFact(
          balanceContext,
          TRAIT.GO_FOR_THE_THROAT,
          'playerDamageMultiplier',
          'Player strike damage in Beastmode',
          tooltipFactorChange
        ),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) => simulationEffectFacts([effect], index === 0 ? 'pet' : 'player in Beastmode').facts
        )
      ]
    }),
    [TRAIT.NATURAL_VIGOR]: traitTooltip('Endurance regenerates faster.', [
      ['vigorRegenerationMultiplier', 'Endurance regeneration', tooltipPercent]
    ]),
    [TRAIT.COMPANIONS_DEFENSE]: outsideScopeTooltip,
    [TRAIT.RUGGED_GROWTH]: outsideScopeTooltip,
    [TRAIT.CHILD_OF_EARTH]: (balanceContext, entity) => {
      const profile = tooltipProfile(balanceContext, entity.id);
      return {
        description:
          'Completing a healing skill triggers Lesser Muddy Terrain: immobilize once, then repeatedly cripple and slow the target.',
        facts: [
          profileFact(balanceContext, entity.id, 'cooldown', 'Base skill recharge', tooltipSeconds),
          profileFact(balanceContext, entity.id, 'pulseInterval', 'Pulse interval', tooltipSeconds),
          ...simulationEffectFacts(
            (profile.effects || []).map((effect, index) => ({
              ...effect,
              applications: index === 0 ? 1 : tooltipNumber(profile, 'maximumStacks')
            }))
          ).facts
        ]
      };
    },
    [TRAIT.OAKHEART_SALVE]: outsideScopeTooltip,
    [TRAIT.ARACHNOPHOBIA]: traitTooltip(
      'Gain expertise, with an additional expertise bonus for spider and devourer pets. Their Spit or Twin Darts inflicts torment; Twin Darts splits the duration across its projectiles.',
      [
        ['attributeBonus', 'Expertise'],
        ['weaponAttributeBonus', 'Additional spider / devourer expertise']
      ],
      'Spit; Twin Darts divides duration per projectile'
    ),
    [TRAIT.AMBIDEXTERITY]: traitTooltip(
      'Gain condition damage, increased while wielding a dagger, mace, or torch. Dagger and torch skills recharge faster.',
      [
        ['attributeBonus', 'Base condition damage'],
        ['weaponAttributeBonus', 'Condition damage with a dagger, mace, or torch'],
        ['rechargeMultiplier', 'Dagger / torch recharge', tooltipFactorChange]
      ]
    ),
    [TRAIT.SURVIVAL_INSTINCTS]: traitTooltip(
      'Gain personal strike damage. Your full-health bonus applies throughout combat.',
      [fromProfile(TRAIT.SURVIVAL_INSTINCTS, 'damageIncrease', 'Strike damage', tooltipPercent)]
    ),
    [TRAIT.EMPATHIC_BOND]: outsideScopeTooltip,
    [TRAIT.CARNIVORE]: traitTooltip(
      'Player and pet control effects trigger a life-steal strike that cannot critically strike.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
    ),
    [TRAIT.WILDERNESS_KNOWLEDGE]: outsideScopeTooltip,
    [TRAIT.POISON_MASTER]: traitTooltip(
      "Your poison deals increased damage. Using an eligible beast skill prepares the pet's next strike to apply additional player-owned poison.",
      [fromProfile(TRAIT.POISON_MASTER, 'conditionDamageMultiplier', 'Player poison damage', tooltipFactorChange)]
    ),
    [TRAIT.CELESTIAL_BEING]: traitTooltip(
      'Unlock Druid, staff, glyphs, and Celestial Avatar. Build astral force outside Avatar and spend it to use Avatar skills.'
    ),
    [TRAIT.LIVE_VICARIOUSLY]: outsideScopeTooltip,
    [TRAIT.NATURAL_MENDER]: traitTooltip('Periodically generate astral force outside Celestial Avatar.', [
      ['pulseInterval', 'Interval', tooltipSeconds],
      ['resourceGain', 'Astral force per interval']
    ]),
    [TRAIT.DRUIDIC_CLARITY]: outsideScopeTooltip,
    [TRAIT.VERDANT_ETCHING]: outsideScopeTooltip,
    [TRAIT.BLOOD_MOON]: traitTooltip('Qualifying control and immobilize effects inflict bleeding.'),
    [TRAIT.CELESTIAL_SHADOW]: outsideScopeTooltip,
    [TRAIT.GRACE_OF_THE_LAND]: traitTooltip(
      'Celestial Avatar skills grant alacrity to yourself. Natural Convergence grants it once per completed pulse.',
      () => [],
      'per skill / completed Convergence pulse'
    ),
    [TRAIT.NATURAL_BALANCE]: traitTooltip(
      'Entering or leaving Celestial Avatar temporarily increases your condition damage and condition duration.',
      [
        ['conditionDamageIncrease', 'Condition damage', tooltipPercent],
        ['conditionDurationBonus', 'Condition duration', tooltipPercent]
      ]
    ),
    [TRAIT.CULTIVATED_SYNERGY]: outsideScopeTooltip,
    [TRAIT.LINGERING_LIGHT]: outsideScopeTooltip,
    [TRAIT.ECLIPSE]: (balanceContext, entity) => ({
      description:
        'Celestial Avatar skills apply their corresponding conditions. Gain additional astral force from damage outside Avatar.',
      facts: [
        profileFact(
          balanceContext,
          'ranger.druid.resources',
          'coefficientMultiplier',
          'Damage-generated astral force',
          (value) => `${tooltipDecimal(value)}×`
        ),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) =>
            simulationEffectFacts(
              [{ ...effect, applications: index === 4 ? 3 : 1 }],
              [
                'Cosmic Ray',
                'Seed of Life',
                'Lunar Impact',
                'Rejuvenating Tides',
                'Natural Convergence early pulses',
                'Natural Convergence final pulse'
              ][index]
            ).facts
        )
      ]
    }),
    [TRAIT.ELEVATED_BOND]: traitTooltip(
      'Unlock Soulbeast, dagger, stances, and Beastmode. Merging replaces the pet with beast skills and grants attributes from its archetype.'
    ),
    [TRAIT.FURIOUS_STRENGTH]: traitTooltip('Deal increased strike damage while fury is active.', [
      fromProfile(TRAIT.FURIOUS_STRENGTH, 'damageIncrease', 'Strike damage with fury', tooltipPercent)
    ]),
    [TRAIT.TWICE_AS_VICIOUS]: traitTooltip('Control effects temporarily increase strike and condition damage.', [
      fromProfile(TRAIT.TWICE_AS_VICIOUS, 'damageIncrease', 'Strike damage', tooltipPercent),
      fromProfile(TRAIT.TWICE_AS_VICIOUS, 'conditionDamageIncrease', 'Condition damage', tooltipPercent)
    ]),
    [TRAIT.FRESH_REINFORCEMENT]: outsideScopeTooltip,
    [TRAIT.LIVE_FAST]: traitTooltip('The first hit of your merged Beast Ability grants fury and quickness.'),
    [TRAIT.UNSTOPPABLE_UNION]: traitTooltip('Entering or leaving Beastmode grants protection.'),
    [TRAIT.SECOND_SKIN]: outsideScopeTooltip,
    [TRAIT.ESSENCE_OF_SPEED]: traitTooltip('Receiving quickness extends your other active boons.', [
      ['durationMultiplier', 'Boon extension', tooltipSeconds],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.PREDATORS_CUNNING]: traitTooltip(
      'Poison applications trigger an additional strike that cannot critically strike.'
    ),
    [TRAIT.ETERNAL_BOND]: outsideScopeTooltip,
    // Explain how the shared stance benefits allies as well as showing its reduced duration.
    [TRAIT.LEADER_OF_THE_PACK]: traitTooltip(
      'Stances last longer and share a fraction of their extended duration with nearby allies. Allied hits trigger One Wolf Pack follow-up strikes and Vulture Stance effects, with a separate trigger cooldown for each ally.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Stance duration', tooltipFactorChange),
        profileFact(
          balanceContext,
          id,
          'sharedDurationMultiplier',
          'Allied stance duration',
          (value) => `${tooltipPercent(value)} of your extended duration`
        )
      ]
    ),
    [TRAIT.OPPRESSIVE_SUPERIORITY]: traitTooltip(
      'Gain strike damage and condition duration when the target has a lower health percentage than you. Player health remains full in combat.',
      [
        fromProfile(TRAIT.OPPRESSIVE_SUPERIORITY, 'damageMultiplier', 'Strike damage', tooltipFactorChange),
        ['conditionDurationBonus', 'Condition duration', tooltipPercent]
      ]
    ),
    [TRAIT.UNLEASHED_POWER]: traitTooltip(
      'Unlock Untamed, hammer, cantrips, and unleash. Swap unleashed power between yourself and your pet to change available skills.'
    ),
    [TRAIT.NATURAL_FORTITUDE]: traitTooltip('Gain vitality. Ambushes trigger a life siphon at their first impact.', [
      ['attributeBonus', 'Vitality']
    ]),
    [TRAIT.VOW_OF_THE_UNTAMED]: traitTooltip('Your strikes deal increased damage while you are unleashed.', [
      fromProfile(TRAIT.VOW_OF_THE_UNTAMED, 'damageIncrease', 'Unleashed player strike damage', tooltipPercent)
    ]),
    [TRAIT.DEBILITATING_BLOWS]: (balanceContext, entity) => ({
      description:
        'Player or pet control effects poison the target while you are unleashed, or slow it while the pet is unleashed.',
      facts: [
        profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) => simulationEffectFacts([effect], index === 0 ? 'Ranger unleashed' : 'pet unleashed').facts
        )
      ]
    }),
    [TRAIT.NATURES_SHIELD]: outsideScopeTooltip,
    [TRAIT.BLINDING_OUTBURST]: traitTooltip(
      'Venomous Outburst blinds the target. Supported unleashed ambushes and Venomous Outburst deal increased strike damage.',
      [fromProfile(TRAIT.BLINDING_OUTBURST, 'damageIncrease', 'Eligible strike damage', tooltipPercent)]
    ),
    [TRAIT.ENHANCING_IMPACT]: (balanceContext, entity) => ({
      description:
        'Player or pet control effects grant quickness while you are unleashed, or stability while the pet is unleashed.',
      facts: [
        profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) => simulationEffectFacts([effect], index === 0 ? 'Ranger unleashed' : 'pet unleashed').facts
        )
      ]
    }),
    [TRAIT.CLEANSING_UNLEASH]: outsideScopeTooltip,
    [TRAIT.CORRUPTING_VINES]: outsideScopeTooltip,
    [TRAIT.LET_LOOSE]: traitTooltip(
      'The first landed hit of an unleashed ambush grants might and quickness to the party. Weapon swapping can reset ambush availability.',
      [['internalCooldown', 'Weapon-swap reset cooldown', tooltipSeconds]],
      'party'
    ),
    [TRAIT.BIORHYTHM]: outsideScopeTooltip,
    [TRAIT.FEROCIOUS_SYMBIOSIS]: traitTooltip(
      "Your strikes build the pet's strike-damage stacks; pet strikes build yours. Each side has an independent trigger cooldown and refreshes its stack duration.",
      [
        fromProfile(TRAIT.FEROCIOUS_SYMBIOSIS, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        ['maximumStacks', 'Maximum stacks per side'],
        ['durationMultiplier', 'Stack duration', tooltipSeconds],
        ['internalCooldown', 'Cooldown per side', tooltipSeconds]
      ]
    ),
    [TRAIT.TEACHINGS_OF_THE_TENGU]: traitTooltip(
      'Unlock Galeshot, gust skills, and Cyclone Bow. Generate wind force and spend wind arrows on Cyclone Bow attacks.'
    ),
    [TRAIT.BIRD_OF_PREY]: traitTooltip('Your strikes deal increased damage while swiftness or superspeed is active.', [
      fromProfile(TRAIT.BIRD_OF_PREY, 'damageIncrease', 'Strike damage', tooltipPercent)
    ]),
    [TRAIT.JETSTREAM]: outsideScopeTooltip,
    [TRAIT.JOY_OF_MOVEMENT]: outsideScopeTooltip,
    [TRAIT.FEEL_THE_RUSH]: outsideScopeTooltip,
    [TRAIT.WUTHERING_WIND]: traitTooltip(
      "Bluster prepares the pet's next qualifying strike to trigger Wuthering Wind. Its damage uses pet power scaling."
    ),
    [TRAIT.FLOCK_TOGETHER]: traitTooltip(
      'Feathered pets deal increased strike damage. Using a beast skill grants quickness to the party.',
      [
        fromProfile(TRAIT.FLOCK_TOGETHER, 'damageMultiplier', 'Feathered pet strike damage', tooltipFactorChange),
        ['internalCooldown', 'Quickness cooldown', tooltipSeconds]
      ],
      'party'
    ),
    [TRAIT.PERILOUS_SKIES]: traitTooltip("Replace Quarry's Peril with Pelt while using Cyclone Bow."),
    [TRAIT.THRILL_OF_THE_CATCH]: traitTooltip('Player or pet control effects restore wind arrows.', [
      ['resourceGain', 'Wind arrows restored'],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.CLOUDBURST]: (balanceContext, entity) => ({
      description:
        "Bluster and Hawkeye grant their corresponding party boons. Quarry's Peril and Supersonic Arrow reset Bluster's recharge.",
      facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect, index) => simulationEffectFacts([effect], index < 2 ? 'Bluster · party' : 'Hawkeye · party').facts
      )
    }),
    [TRAIT.GALE_FORCE]: traitTooltip(
      'Wind Force increases your strike damage. Hawkeye grants an additional temporary damage bonus; wind force gained during that bonus still contributes.',
      [
        fromProfile(TRAIT.GALE_FORCE, 'damageIncreasePerStack', 'Strike damage per Wind Force stack', tooltipPercent),
        fromProfile(TRAIT.GALE_FORCE, 'damageIncrease', 'Additional strike damage after Hawkeye', tooltipPercent)
      ]
    ),
    [TRAIT.SHRIKE]: (balanceContext, entity) => {
      const profile = tooltipProfile(balanceContext, entity.id);
      return {
        description: 'After enough qualifying missile hits, restore a wind arrow and fire additional strikes.',
        facts: [
          profileFact(balanceContext, entity.id, 'threshold', 'Missile hits required'),
          profileFact(balanceContext, entity.id, 'resourceGain', 'Wind arrows restored'),
          ...simulationEffectFacts(
            (profile.effects || []).map((effect) =>
              effect.type === 'strike'
                ? { ...effect, coefficient: tooltipNumber(effect, 'coefficient') * tooltipNumber(effect, 'hits') }
                : effect
            )
          ).facts
        ]
      };
    }
  }
};
