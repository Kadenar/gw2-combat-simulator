import {
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
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/ranger/core/profiles.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as SOULBEAST } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { DRUID_BALANCE_PROFILE_IDS as DRUID } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { UNTAMED_BALANCE_PROFILE_IDS as UNTAMED } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { GALESHOT_BALANCE_PROFILE_IDS as GALESHOT } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';

/** Keep companion bonuses and form-dependent alternatives separate while sharing the simulation's balance inputs. */
export const rangerTooltips: ProfessionTooltips = {
  skillFacts: (balanceContext, entity) => [
    ...[
      ['arrowCost', 'Arrows spent'],
      ['windForceGain', 'Wind Force gained'],
      ['arrowsRestored', 'Arrows restored'],
      ['resourceGain', 'Endurance gained']
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
            'Strike damage against disabled or defiant targets',
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
            'Strike damage against disabled or defiant targets',
            tooltipFactorChange
          )
        ]
      : []),
    ...([ID.WARCLAWS_ENGAGE, ID.PREDATORS_AMBUSH].some((id) => id === entity.id)
      ? [
          modifierFact(
            balanceContext,
            'ranger.spear-leap-low-health',
            'factor',
            'Strike damage below half target health',
            tooltipFactorChange
          )
        ]
      : []),
    ...(entity.id === ID.FALCONS_STOOP
      ? [
          modifierFact(
            balanceContext,
            'ranger.falcons-stoop-disabled',
            'factor',
            'Strike damage against disabled, defiant, or immobilized targets',
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
  handlers: {
    'ranger.dodge': skillTooltip(
      'Spend endurance to dodge and trigger applicable dodge traits. Incoming damage is outside combat simulation scope.',
      (balanceContext) => [profileFact(balanceContext, CORE.resources, 'resourceCost', 'Endurance spent')]
    ),
    'ranger.pet-swap': skillTooltip(
      'Switch to the other selected pet, update its command skills, and trigger pet-swap traits. The new pet receives a fresh Opening Strike opportunity.'
    ),
    'ranger.weapon-swap': skillTooltip('Swap weapon sets and trigger applicable weapon-swap effects.'),
    'ranger.hilt-bash': skillTooltip(
      "Strike and control the target, using a stun against a defiant foe. Completing the cast resets Maul's recharge."
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
      (balanceContext) => [
        profileFact(balanceContext, CORE.sicEm, 'durationMultiplier', 'Base duration', tooltipSeconds),
        modifierFact(balanceContext, 'ranger.sic-em-pet', 'factor', 'Pet strike damage', tooltipFactorChange),
        modifierFact(
          balanceContext,
          'ranger.sic-em-player',
          'factor',
          'Merged player strike damage',
          tooltipFactorChange
        )
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
        profileFact(
          balanceContext,
          SOULBEAST.oneWolfPack,
          'durationMultiplier',
          'Base stance duration',
          tooltipSeconds
        ),
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
      (balanceContext) => [
        profileFact(
          balanceContext,
          DRUID.resources,
          'durationMultiplier',
          'Maximum Avatar duration from full force',
          tooltipSeconds
        ),
        profileFact(balanceContext, DRUID.resources, 'maximumStacks', 'Full astral force')
      ]
    ),
    'ranger.celestial-avatar-exit': skillTooltip(
      'Leave Celestial Avatar and restore your weapon skills. Retain part of your remaining astral force; automatic exit from exhaustion retains none. Trigger applicable exit and weapon-swap effects.',
      (balanceContext) => [
        profileFact(
          balanceContext,
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
      (balanceContext) => [
        profileFact(balanceContext, UNTAMED.resources, 'durationMultiplier', 'Ambush window', tooltipSeconds),
        profileFact(balanceContext, UNTAMED.resources, 'internalCooldown', 'Ambush grant cooldown', tooltipSeconds)
      ]
    ),
    'ranger.unleash-pet': skillTooltip(
      'Unleash your pet and replace its commands with unleashed skills. Your weapon and trait effects follow the pet-unleashed state.'
    ),
    'ranger.unleashed-ambush': skillTooltip(
      'Use the available unleashed ambush and consume its window. Apply eligible ambush traits.'
    ),
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
      'Your unleashed pet attacks. It additionally applies vulnerability against a defiant, disabled, or defiance-broken target.'
    ),
    'ranger.cyclone-bow-enter': skillTooltip(
      'Equip the Cyclone Bow and replace your weapon skills. Trigger applicable weapon-swap effects. Arrows regenerate over time and are shared across its skills.',
      (balanceContext) => [
        profileFact(balanceContext, GALESHOT.resources, 'maximumStacks', 'Arrow capacity'),
        profileFact(
          balanceContext,
          GALESHOT.resources,
          'pulseInterval',
          'Base arrow regeneration interval',
          tooltipSeconds
        )
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
  },
  skills: {
    ...Object.fromEntries(
      [ID.MAUL, ID.MAUL_ID_46629].map((id) => [
        id,
        skillTooltip(
          "Strike and grant Attack of Opportunity after the impact. It empowers your pet's next direct attack, or your next direct attack while merged. Trait and stance damage cannot consume it.",
          (balanceContext) => [
            profileFact(
              balanceContext,
              CORE.attackOfOpportunity,
              'durationMultiplier',
              'Next-attack window',
              tooltipSeconds
            ),
            modifierFact(
              balanceContext,
              'ranger.attack-of-opportunity',
              'petFactor',
              'Pet next-attack damage',
              tooltipFactorChange
            ),
            modifierFact(
              balanceContext,
              'ranger.attack-of-opportunity',
              'playerFactor',
              'Merged next-attack damage',
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
      (balanceContext) => [profileFact(balanceContext, CORE.signetOfTheWild, 'attributeBonus', 'Passive ferocity')]
    ),
    [ID.STALKERS_STRIKE]: skillTooltip(
      'Strike and poison your target. Against a movement-impaired target, the strike deals increased damage and adds further poison.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'ranger.stalkers-strike-movement-impaired',
          'factor',
          'Strike damage against movement-impaired targets',
          tooltipFactorChange
        )
      ]
    ),
    [ID.FROST_TRAP]: skillTooltip(
      'Lay a trap that strikes and chills in an ice field. When precast before an explicit combat start, the trap remains armed and releases its full pulse sequence when combat begins.'
    ),
    [ID.HAWKEYE]: skillTooltip(
      'At full Wind Force, replace Keen Shot with this empowered attack. Consume all Wind Force and the listed arrows, then trigger eligible Gale Force and Cloudburst effects.',
      (balanceContext) => [
        profileFact(balanceContext, GALESHOT.resources, 'minimumStacks', 'Wind Force required and consumed')
      ]
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
    [TRAIT.PRECISE_STRIKE]: traitTooltip(
      'Opening Strike gains critical-strike chance for you and your pet.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.PRECISE_STRIKE,
          'criticalChance',
          'Opening Strike critical chance',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.STONEFORM]: outsideScopeTooltip,
    [TRAIT.HUNTERS_GAZE]: traitTooltip(
      'Your strikes grant might against targets below three-quarter health. Lower target-health tiers grant more stacks.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumStacks', 'Might stacks below one-quarter target health')
      ],
      'base application; stacks depend on target health'
    ),
    [TRAIT.CLARION_BOND]: traitTooltip(
      'Swapping pets triggers Lesser Call of the Wild: grant party boons, weaken the target, and perform a blast finisher.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.WOLFSONG]: traitTooltip(
      'Your strikes deal increased damage against vulnerable targets. Using a beast skill with a canine pet inflicts vulnerability.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'ranger.wolfsong',
          'factor',
          'Strike damage against vulnerable targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.FARSIGHTED]: traitTooltip('Your weapon skills deal increased strike damage.', (balanceContext) => [
      modifierFact(balanceContext, 'ranger.farsighted', 'factor', 'Weapon strike damage', tooltipFactorChange)
    ]),
    [TRAIT.MOMENT_OF_CLARITY]: outsideScopeTooltip,
    [TRAIT.PREDATORS_ONSLAUGHT]: traitTooltip(
      'You and your pet deal increased strike damage against movement-impaired targets.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'ranger.predators-onslaught-player',
          'factor',
          'Player strike damage',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'ranger.predators-onslaught-pet',
          'factor',
          'Pet strike damage',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.REMORSELESS]: traitTooltip(
      'Receiving fury on yourself refreshes Opening Strike for you and your pet. Opening Strike deals increased damage.',
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.remorseless', 'factor', 'Opening Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.LEAD_THE_WIND]: traitTooltip(
      'Longbow skills recharge faster. Point-Blank Shot grants swiftness and quickness.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Longbow recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.REJUVENATION]: traitTooltip(
      'Using an eligible beast skill grants regeneration to the party.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
      ],
      'party'
    ),
    [TRAIT.FORTIFYING_BOND]: outsideScopeTooltip,
    [TRAIT.LINGERING_MAGIC]: traitTooltip('Gain concentration.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Concentration')
    ]),
    [TRAIT.BOUNTIFUL_HUNTER]: traitTooltip(
      'You and your pet deal increased strike damage for each different boon affecting the respective attacker.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'ranger.bountiful-hunter-player',
          'damagePerBoon',
          'Player strike damage per boon'
        ),
        modifierFact(balanceContext, 'ranger.bountiful-hunter-pet', 'damagePerBoon', 'Pet strike damage per boon')
      ]
    ),
    [TRAIT.WELLSPRING]: traitTooltip(
      'Gain healing power from power. Completing a healing skill grants regeneration to the party.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Power converted to healing power', tooltipPercent)
      ],
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
    [TRAIT.NATURES_VENGEANCE]: outsideScopeTooltip,
    [TRAIT.PROTECTIVE_WARD]: outsideScopeTooltip,
    [TRAIT.INVIGORATING_BOND]: outsideScopeTooltip,
    [TRAIT.TAIL_WIND]: traitTooltip('Swapping weapons in combat grants swiftness.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.FURIOUS_GRIP]: traitTooltip('Swapping weapons in combat grants fury.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.HUNTERS_TACTICS]: traitTooltip(
      'Gain personal strike damage and critical-strike chance when flanking. The simulator treats defiant targets as flanked.',
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.hunters-tactics-damage', 'factor', 'Strike damage', tooltipFactorChange),
        profileFact(balanceContext, TRAIT.HUNTERS_TACTICS, 'criticalChance', 'Critical chance', tooltipPercent)
      ]
    ),
    [TRAIT.SHARPENED_EDGES]: traitTooltip(
      'Critical hits from you and your pet have a chance to inflict bleeding.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'criticalChance', 'Chance on critical hit', tooltipPercent)
      ]
    ),
    [TRAIT.PRIMAL_REFLEXES]: outsideScopeTooltip,
    [TRAIT.TRAPPERS_EXPERTISE]: traitTooltip(
      'Trap conditions last longer, using a separate multiplier for Flame Trap. Traps also cripple the target.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Trap condition duration', tooltipFactorChange),
        profileFact(balanceContext, id, 'coefficientMultiplier', 'Flame Trap condition duration', tooltipFactorChange)
      ]
    ),
    [TRAIT.FANG_AND_CLAW]: traitTooltip(
      'Feline, avian, and drake pets gain precision and ferocity.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Pet precision'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Pet ferocity')
      ]
    ),
    [TRAIT.STRIDERS_STRENGTH]: traitTooltip(
      'You and your pet gain power. Wielding a sword increases your bonus.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Base power'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Power while wielding a sword')
      ]
    ),
    [TRAIT.HIDDEN_BARBS]: traitTooltip('Bleeding deals increased damage.', (balanceContext) => [
      modifierFact(balanceContext, 'ranger.hidden-barbs', 'factor', 'Bleeding damage', tooltipFactorChange)
    ]),
    [TRAIT.QUICK_DRAW]: traitTooltip(
      'Swapping weapons in combat grants quickness and opens a brief window. The next non-autoattack weapon skill used in that window has reduced recharge.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        profileFact(balanceContext, id, 'durationMultiplier', 'Quick Draw', tooltipSeconds),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Next eligible skill recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.LIGHT_ON_YOUR_FEET]: traitTooltip(
      'Dodging or using an evade skill adds a temporary strike-damage and condition-duration bonus. Shortbow recharges faster; flanking extends selected shortbow conditions and Concussion Shot applies vulnerability.',
      (balanceContext, id) => [
        modifierFact(
          balanceContext,
          'ranger.light-on-your-feet',
          'factor',
          'Strike damage during bonus',
          tooltipFactorChange
        ),
        profileFact(
          balanceContext,
          TRAIT.LIGHT_ON_YOUR_FEET,
          'conditionDurationBonus',
          'Condition duration during bonus',
          tooltipPercent
        ),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Shortbow recharge', tooltipFactorChange),
        profileFact(
          balanceContext,
          id,
          'durationPerTier',
          'Crossfire bleeding / Poison Volley poison extension',
          tooltipSeconds
        ),
        profileFact(balanceContext, id, 'minimumStacks', 'Crippling Shot immobilize extension', tooltipSeconds)
      ]
    ),
    [TRAIT.VICIOUS_QUARRY]: traitTooltip(
      'Gain ferocity and additional critical-strike chance while fury is active.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Ferocity'),
        profileFact(
          balanceContext,
          TRAIT.VICIOUS_QUARRY,
          'criticalChance',
          'Additional critical chance with fury',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.PACK_ALPHA]: traitTooltip(
      'Your pet gains power, precision, toughness, vitality, and condition damage. Beastmode grants the smaller player bonus. Pet skills recharge faster.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Pet bonus to each attribute'),
        profileFact(balanceContext, id, 'attributeBonus', 'Player bonus to each attribute in Beastmode'),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Pet skill recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.LOUD_WHISTLE]: traitTooltip(
      'Your pet deals increased strike damage. Beastmode grants a separate personal strike-damage bonus.',
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.loud-whistle-pet', 'factor', 'Pet strike damage', tooltipFactorChange),
        modifierFact(
          balanceContext,
          'ranger.loud-whistle-player',
          'factor',
          'Player strike damage in Beastmode',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.PETS_PROWESS]: traitTooltip(
      'Your pet gains ferocity. The bonus also applies to you in Beastmode.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Ferocity')]
    ),
    [TRAIT.GO_FOR_THE_EYES]: traitTooltip(
      'The first hit of your merged Beast Ability blinds the target.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.NATURAL_HEALING]: outsideScopeTooltip,
    [TRAIT.RESOUNDING_TIMBRE]: traitTooltip(
      'Completing a command copies your current boons to the active pet. In Beastmode, commands extend your boons instead.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Beastmode boon extension', tooltipSeconds)
      ]
    ),
    [TRAIT.WILTING_STRIKE]: traitTooltip('The first hit of your merged Beast Ability weakens the target.'),
    [TRAIT.BESTIAL_RAGE]: traitTooltip(
      'Control effects while playing Soulbeast grant might and fury.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.HONED_AXES]: traitTooltip(
      'You and your pet gain ferocity. Wielding an axe increases your bonus. Axe skills recharge faster.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Base ferocity'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Ferocity while wielding an axe'),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Axe recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.BEASTLY_WARDEN]: outsideScopeTooltip,
    [TRAIT.ZEPHYRS_SPEED]: outsideScopeTooltip,
    [TRAIT.GO_FOR_THE_THROAT]: (balanceContext, entity) => ({
      description:
        "Your pet's beast-skill hit grants it Lesser Sic 'Em. The first hit of your merged Beast Ability grants the separate personal bonus instead.",
      facts: [
        profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        modifierFact(balanceContext, 'ranger.lesser-sic-em-pet', 'factor', 'Pet strike damage', tooltipFactorChange),
        modifierFact(
          balanceContext,
          'ranger.lesser-sic-em-player',
          'factor',
          'Player strike damage in Beastmode',
          tooltipFactorChange
        ),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) => simulationEffectFacts([effect], index === 0 ? 'pet' : 'player in Beastmode').facts
        )
      ]
    }),
    [TRAIT.NATURAL_VIGOR]: traitTooltip('Endurance regenerates faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'vigorRegenerationMultiplier', 'Endurance regeneration', tooltipPercent)
    ]),
    [TRAIT.COMPANIONS_DEFENSE]: outsideScopeTooltip,
    [TRAIT.RUGGED_GROWTH]: outsideScopeTooltip,
    [TRAIT.CHILD_OF_EARTH]: (balanceContext, entity) => {
      const profile = tooltipProfile(balanceContext, entity.id);
      return {
        description:
          'Completing a healing skill triggers Lesser Muddy Terrain: immobilize once, then repeatedly cripple and slow the target.',
        facts: [
          profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
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
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Expertise'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Additional spider / devourer expertise')
      ],
      'Spit; Twin Darts divides duration per projectile'
    ),
    [TRAIT.AMBIDEXTERITY]: traitTooltip(
      'Gain condition damage, increased while wielding a dagger, mace, or torch. Dagger and torch skills recharge faster.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Base condition damage'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Condition damage with a dagger, mace, or torch'),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Dagger / torch recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.SURVIVAL_INSTINCTS]: traitTooltip(
      'Gain personal strike damage. Your full-health bonus applies throughout combat.',
      (balanceContext) => [modifierFact(balanceContext, 'ranger.survival-instincts', 'amount', 'Strike damage')]
    ),
    [TRAIT.EMPATHIC_BOND]: outsideScopeTooltip,
    [TRAIT.CARNIVORE]: traitTooltip(
      'Player and pet control effects trigger a life-steal strike that cannot critically strike.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.WILDERNESS_KNOWLEDGE]: outsideScopeTooltip,
    [TRAIT.POISON_MASTER]: traitTooltip(
      "Your poison deals increased damage. Using an eligible beast skill prepares the pet's next strike to apply additional player-owned poison.",
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.poison-master', 'factor', 'Player poison damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.CELESTIAL_BEING]: traitTooltip(
      'Unlock Druid, staff, glyphs, and Celestial Avatar. Build astral force outside Avatar and spend it to use Avatar skills.'
    ),
    [TRAIT.LIVE_VICARIOUSLY]: outsideScopeTooltip,
    [TRAIT.NATURAL_MENDER]: traitTooltip(
      'Periodically generate astral force outside Celestial Avatar.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'pulseInterval', 'Interval', tooltipSeconds),
        profileFact(balanceContext, id, 'resourceGain', 'Astral force per interval')
      ]
    ),
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
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.natural-balance-condition-damage', 'amount', 'Condition damage'),
        profileFact(
          balanceContext,
          TRAIT.NATURAL_BALANCE,
          'conditionDurationBonus',
          'Condition duration',
          tooltipPercent
        )
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
    [TRAIT.FURIOUS_STRENGTH]: traitTooltip('Deal increased strike damage while fury is active.', (balanceContext) => [
      modifierFact(balanceContext, 'ranger.furious-strength', 'amount', 'Strike damage with fury')
    ]),
    [TRAIT.TWICE_AS_VICIOUS]: traitTooltip(
      'Control effects temporarily increase strike and condition damage.',
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.twice-as-vicious-strike', 'amount', 'Strike damage'),
        modifierFact(balanceContext, 'ranger.twice-as-vicious-condition', 'amount', 'Condition damage')
      ]
    ),
    [TRAIT.FRESH_REINFORCEMENT]: outsideScopeTooltip,
    [TRAIT.LIVE_FAST]: traitTooltip('The first hit of your merged Beast Ability grants fury and quickness.'),
    [TRAIT.UNSTOPPABLE_UNION]: traitTooltip('Entering or leaving Beastmode grants protection.'),
    [TRAIT.SECOND_SKIN]: outsideScopeTooltip,
    [TRAIT.ESSENCE_OF_SPEED]: traitTooltip(
      'Receiving quickness extends your other active boons.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Boon extension', tooltipSeconds),
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.PREDATORS_CUNNING]: traitTooltip(
      'Poison applications trigger an additional strike that cannot critically strike.'
    ),
    [TRAIT.ETERNAL_BOND]: outsideScopeTooltip,
    // Explain how the shared stance benefits allies as well as showing its reduced duration.
    [TRAIT.LEADER_OF_THE_PACK]: traitTooltip(
      'Stances last longer and grant their effects to nearby allies for 50% of your extended duration. Allied hits trigger One Wolf Pack follow-up strikes and Vulture Stance effects, with a separate trigger cooldown for each ally.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Stance duration', tooltipFactorChange),
        { name: 'Allied stance duration', detail: '50% of your extended duration' }
      ]
    ),
    [TRAIT.OPPRESSIVE_SUPERIORITY]: traitTooltip(
      'Gain strike damage and condition duration when the target has a lower health percentage than you. Player health remains full in combat.',
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.oppressive-superiority', 'factor', 'Strike damage', tooltipFactorChange),
        profileFact(
          balanceContext,
          TRAIT.OPPRESSIVE_SUPERIORITY,
          'conditionDurationBonus',
          'Condition duration',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.UNLEASHED_POWER]: traitTooltip(
      'Unlock Untamed, hammer, cantrips, and unleash. Swap unleashed power between yourself and your pet to change available skills.'
    ),
    [TRAIT.NATURAL_FORTITUDE]: traitTooltip('Gain vitality.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Vitality')
    ]),
    [TRAIT.VOW_OF_THE_UNTAMED]: traitTooltip(
      'Your strikes deal increased damage while you are unleashed.',
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.vow-of-the-untamed', 'amount', 'Unleashed player strike damage')
      ]
    ),
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
      (balanceContext) => [modifierFact(balanceContext, 'ranger.blinding-outburst', 'amount', 'Eligible strike damage')]
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
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Weapon-swap reset cooldown', tooltipSeconds)
      ],
      'party'
    ),
    [TRAIT.BIORHYTHM]: outsideScopeTooltip,
    [TRAIT.FEROCIOUS_SYMBIOSIS]: traitTooltip(
      "Your strikes build the pet's strike-damage stacks; pet strikes build yours. Each side has an independent trigger cooldown and refreshes its stack duration.",
      (balanceContext, id) => [
        modifierFact(balanceContext, 'ranger.ferocious-symbiosis', 'damagePerStack', 'Strike damage per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks per side'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Stack duration', tooltipSeconds),
        profileFact(balanceContext, id, 'internalCooldown', 'Cooldown per side', tooltipSeconds)
      ]
    ),
    [TRAIT.TEACHINGS_OF_THE_TENGU]: traitTooltip(
      'Unlock Galeshot, gust skills, and Cyclone Bow. Generate wind force and spend wind arrows on Cyclone Bow attacks.'
    ),
    [TRAIT.BIRD_OF_PREY]: traitTooltip(
      'Your strikes deal increased damage while swiftness or superspeed is active.',
      (balanceContext) => [modifierFact(balanceContext, 'ranger.bird-of-prey', 'amount', 'Strike damage')]
    ),
    [TRAIT.JETSTREAM]: outsideScopeTooltip,
    [TRAIT.JOY_OF_MOVEMENT]: outsideScopeTooltip,
    [TRAIT.FEEL_THE_RUSH]: outsideScopeTooltip,
    [TRAIT.WUTHERING_WIND]: traitTooltip(
      "Bluster prepares the pet's next qualifying strike to trigger Wuthering Wind. Its damage uses pet power scaling."
    ),
    [TRAIT.FLOCK_TOGETHER]: traitTooltip(
      'Feathered pets deal increased strike damage. Using a beast skill grants quickness to the party.',
      (balanceContext, id) => [
        modifierFact(
          balanceContext,
          'ranger.flock-together',
          'factor',
          'Feathered pet strike damage',
          tooltipFactorChange
        ),
        profileFact(balanceContext, id, 'internalCooldown', 'Quickness cooldown', tooltipSeconds)
      ],
      'party'
    ),
    [TRAIT.PERILOUS_SKIES]: traitTooltip("Replace Quarry's Peril with Pelt while using Cyclone Bow."),
    [TRAIT.THRILL_OF_THE_CATCH]: traitTooltip(
      'Player or pet control effects restore wind arrows.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Wind arrows restored'),
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.CLOUDBURST]: (balanceContext, entity) => ({
      description:
        "Bluster and Hawkeye grant their corresponding party boons. Quarry's Peril and Supersonic Arrow reset Bluster's recharge.",
      facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect, index) => simulationEffectFacts([effect], index < 2 ? 'Bluster · party' : 'Hawkeye · party').facts
      )
    }),
    [TRAIT.GALE_FORCE]: traitTooltip(
      'Wind Force increases your strike damage. Hawkeye grants an additional temporary damage bonus; wind force gained during that bonus still contributes.',
      (balanceContext) => [
        modifierFact(balanceContext, 'ranger.gale-force', 'windForcePerStack', 'Strike damage per Wind Force stack'),
        modifierFact(balanceContext, 'ranger.gale-force', 'galeForceBonus', 'Additional strike damage after Hawkeye')
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
