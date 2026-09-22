import {
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  tooltipNumber,
  profileFact,
  modifierFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { CATALYST_BALANCE_PROFILE_IDS as CATALYST } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { EVOKER_BALANCE_PROFILE_IDS as EVOKER } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as TEMPEST } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/elementalist/core/profiles.js';
import { WEAVER_BALANCE_PROFILE_IDS as WEAVER } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT,
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
  ELEMENTALIST_JADE_SPHERE_SKILL_IDS
} from '#gw2/professions/elementalist/data/ids.js';
import {
  HAMMER_ORB_SKILLS,
  CONJURE_SKILLS,
  CONJURE_PICKUP_WEAPONS,
  AURA_TRANSMUTE_SKILLS,
  ETCHING_CHAINS
} from '#gw2/professions/elementalist/core/constants.js';
import {
  FAMILIAR_ELEMENTS,
  BASIC_FAMILIARS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  FIRE_ELEMENTAL_EVTC_PROFILE as FIRE_ELEMENTAL,
  EARTH_ELEMENTAL_EVTC_PROFILE as EARTH_ELEMENTAL
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';

const percentagePoints = (value: number) => tooltipPercent(value / 100);

/** Named profile packets retain their attunement or skill labels, so mutually exclusive variants stay explicit. */
export const elementalistTooltips: ProfessionTooltips = {
  skillFacts: (balanceContext, entity) => [
    ...(entity.resourceGain == null
      ? []
      : [{ name: 'Endurance gained', detail: tooltipDecimal(tooltipNumber(entity, 'resourceGain')) }]),
    ...(entity.aura
      ? (() => {
          const [element, duration] = String(entity.aura).split('|');
          return simulationEffectFacts([
            {
              type: 'buff',
              kind: `${element} Aura`,
              duration: tooltipNumber({ duration: Number(duration) }, 'duration')
            }
          ]).facts;
        })()
      : []),
    // Orb and conjure bonuses belong to their equipped state, including when created by a dual attack or pickup.
    ...(HAMMER_ORB_SKILLS[Number(entity.id)] === 'Fire' ||
    (String(entity.skillWeapon || entity.weapon) === 'Hammer' &&
      String(entity.attunement).includes('+') &&
      String(entity.attunement).includes('Fire'))
      ? [
          modifierFact(
            balanceContext,
            'elementalist.hammer-fire-orb',
            'amount',
            'Strike and condition damage while Fire orb is active'
          )
        ]
      : []),
    ...(HAMMER_ORB_SKILLS[Number(entity.id)] === 'Air' ||
    (String(entity.skillWeapon || entity.weapon) === 'Hammer' &&
      String(entity.attunement).includes('+') &&
      String(entity.attunement).includes('Air'))
      ? [
          modifierFact(
            balanceContext,
            'elementalist.hammer-air-orb',
            'amount',
            'Critical chance while Air orb is active'
          )
        ]
      : []),
    ...((CONJURE_SKILLS[Number(entity.id)] || CONJURE_PICKUP_WEAPONS[Number(entity.id)]) === 'Fiery Greatsword'
      ? [
          profileFact(balanceContext, CORE.fieryGreatsword, 'weaponAttributeBonus', 'Power while wielded'),
          profileFact(balanceContext, CORE.fieryGreatsword, 'attributeBonus', 'Condition damage while wielded')
        ]
      : []),
    ...((CONJURE_SKILLS[Number(entity.id)] || CONJURE_PICKUP_WEAPONS[Number(entity.id)]) === 'Lightning Hammer'
      ? [
          profileFact(balanceContext, CORE.lightningHammer, 'weaponAttributeBonus', 'Precision while wielded'),
          profileFact(balanceContext, CORE.lightningHammer, 'attributeBonus', 'Ferocity while wielded')
        ]
      : []),
    ...((CONJURE_SKILLS[Number(entity.id)] || CONJURE_PICKUP_WEAPONS[Number(entity.id)]) === 'Frost Bow'
      ? [
          modifierFact(
            balanceContext,
            'elementalist.frost-bow-condition-duration',
            'factor',
            'Condition duration while wielded',
            tooltipFactorChange
          )
        ]
      : [])
  ],
  handlers: {
    'elementalist.tempest-shout': skillTooltip(
      "Apply this shout's effects and trigger applicable shout and aura traits. Tempestuous Aria adds party might."
    ),
    'elementalist.primordial-stance': (balanceContext) => ({
      description:
        "Pulse strike damage and conditions throughout the stance. Each pulse reads your current primary and secondary attunements: each hand supplies its element's condition, so a shared attunement applies that condition twice. The strike occurs once per pulse.",
      facts: simulationEffectFacts(
        tooltipProfile(balanceContext, WEAVER.primordialStance).effects,
        'per pulse; conditions depend on current attunements'
      ).facts
    }),
    'elementalist.grand-finale': (balanceContext) => ({
      description:
        "Consume all active hammer orbs and fire one projectile per orb. Each projectile applies its element's effects. Consuming the orbs cancels their pending attacks.",
      facts: [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.grandFinale).effects,
          'only for each active orb consumed'
        ).facts,
        { name: 'Combo finisher', detail: 'Projectile, per consumed orb' }
      ]
    })
  },
  skills: {
    ...Object.fromEntries(
      [ID.MAGNETIC_AURA, ID.FROST_AURA, ID.SHOCKING_AURA, ID.FIRE_SHIELD].map((id) => [
        id,
        skillTooltip(
          'Gain the listed aura and trigger applicable aura traits. The corresponding transmutation can consume the active aura.'
        )
      ])
    ),
    ...Object.fromEntries(
      Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS).map((id) => [
        id,
        skillTooltip(
          'Change attunement and your available weapon skills, triggering applicable attunement effects. Weaver moves the previous primary attunement to the secondary hand; Unravel keeps both hands together. Evoker also changes the available familiar.'
        )
      ])
    ),
    ...Object.fromEntries(
      Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS).map((id) => [
        id,
        skillTooltip(
          'Channel the current attunement after its overload has become available. Apply its pulses and eligible overload traits; leaving this attunement afterward incurs its overload recharge. Fire, Air, and Earth overloads fully charge active spear etchings. Air completion adds Lightning Jolt and arms a copy on the active elemental.',
          (balanceContext) => [
            profileFact(
              balanceContext,
              TEMPEST.overloads,
              'initialDelay',
              'Base time in attunement before overload',
              tooltipSeconds
            ),
            ...(id === ID.OVERLOAD_AIR
              ? simulationEffectFacts(
                  tooltipProfile(balanceContext, TEMPEST.lightningJolt).effects?.map((effect) => ({
                    ...effect,
                    noCrit: true
                  })),
                  'additional completion strike; also copied by an active elemental'
                ).facts
              : [])
          ]
        )
      ])
    ),
    ...Object.fromEntries(
      Object.values(ELEMENTALIST_JADE_SPHERE_SKILL_IDS).map((id) => [
        id,
        skillTooltip(
          "Spend energy to deploy the matching attunement's Jade Sphere. Its field and pulses retain that element when you change attunement. Active spheres enhance matching augments and suspend ordinary energy generation.",
          (balanceContext) => [profileFact(balanceContext, CATALYST.resources, 'resourceCost', 'Energy spent')]
        )
      ])
    ),
    ...Object.fromEntries(
      Object.keys(HAMMER_ORB_SKILLS).map((id) => [
        id,
        skillTooltip(
          "Create this attunement's hammer orb and refresh all active orb durations. Grand Finale consumes the active orbs and replaces their pending attacks with elemental projectiles.",
          (balanceContext) => [
            profileFact(balanceContext, CORE.hammerOrbs, 'durationMultiplier', 'Refreshed orb duration', tooltipSeconds)
          ]
        )
      ])
    ),
    ...Object.fromEntries(
      [
        ID.DUAL_ORBITS_FIRE_AND_WATER,
        ID.DUAL_ORBITS_FIRE_AND_AIR,
        ID.DUAL_ORBITS_FIRE_AND_EARTH,
        ID.DUAL_ORBITS_WATER_AND_AIR,
        ID.DUAL_ORBITS_WATER_AND_EARTH,
        ID.DUAL_ORBITS_AIR_AND_EARTH
      ].map((id) => [
        id,
        skillTooltip(
          'Create hammer orbs for both attunements and refresh all active orb durations. Grand Finale consumes those orbs. An existing matching orb must be consumed before this dual attack can create it again.',
          (balanceContext) => [
            profileFact(balanceContext, CORE.hammerOrbs, 'durationMultiplier', 'Refreshed orb duration', tooltipSeconds)
          ]
        )
      ])
    ),
    ...Object.fromEntries(
      Object.entries(CONJURE_SKILLS).map(([id, weapon]) => [
        id,
        skillTooltip(
          `Conjure and equip ${weapon}, replacing your weapon bar. Leave a second weapon available for a later pickup. Dropping the bundle restores your normal skills.`,
          (balanceContext) => [
            profileFact(
              balanceContext,
              CORE.conjurePickups,
              'durationMultiplier',
              'Ground pickup lifetime',
              tooltipSeconds
            )
          ]
        )
      ])
    ),
    ...Object.fromEntries(
      Object.entries(CONJURE_PICKUP_WEAPONS).map(([id, weapon]) => [
        id,
        skillTooltip(`Pick up the available ${weapon} and replace your weapon bar with its skills.`)
      ])
    ),
    ...Object.fromEntries(
      Object.entries(AURA_TRANSMUTE_SKILLS).map(([id, aura]) => [
        id,
        skillTooltip(
          `Consume an active ${aura} and apply the transmutation effects. Triggers applicable aura-transmutation traits.`
        )
      ])
    ),
    ...Object.fromEntries(
      ETCHING_CHAINS.flatMap((chain) => [
        [
          chain.etchingId,
          skillTooltip(
            'Create an etching and unlock its lesser release while the field lasts. Completing other actions, including attunement swaps, upgrades it to the full release. Releasing either version consumes the etching.',
            (balanceContext) => [
              profileFact(balanceContext, CORE.spearEmpowerments, 'maximumStacks', 'Completed actions to fully charge')
            ]
          )
        ],
        [
          chain.lesserId,
          skillTooltip(
            'Release the partially charged etching and consume it. This release is available only while that etching remains active.'
          )
        ],
        [
          chain.fullId,
          skillTooltip(
            'Release the fully charged etching and consume it. This release is available only after the required charging actions.'
          )
        ]
      ])
    ),
    ...Object.fromEntries(
      [...FAMILIAR_ELEMENTS].map(([id]) => [
        id,
        skillTooltip(
          BASIC_FAMILIARS.has(id)
            ? 'Release the matching familiar, spend the full charge bar, and add an empowered stack. Reaching the stack threshold unlocks empowered familiars. Using this basic familiar too soon after its empowered version cancels the remaining empowered effects.'
            : 'Release the empowered familiar and spend your empowered stacks. Its effects and eligible familiar traits apply while its sequence runs.',
          (balanceContext) => [
            profileFact(
              balanceContext,
              EVOKER.resources,
              BASIC_FAMILIARS.has(id) ? 'maximumStacks' : 'minimumStacks',
              BASIC_FAMILIARS.has(id) ? 'Familiar charges required' : 'Empowered stacks required'
            )
          ]
        )
      ])
    ),
    [ID.DODGE]: skillTooltip(
      'Spend endurance to dodge and trigger Evasive Arcana when selected. Incoming attacks are outside combat simulation scope.',
      (balanceContext) => [profileFact(balanceContext, CORE.resources, 'resourceCost', 'Endurance spent')]
    ),
    [ID.DROP_BUNDLE]: skillTooltip('Drop the conjured weapon and restore your normal weapon skills.'),
    [ID.ROCK_BARRIER]: skillTooltip(
      'Arm Hurl for the barrier window. Rock Barrier begins recharging when Hurl consumes it or the window expires.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.rockBarrier, 'durationMultiplier', 'Hurl window', tooltipSeconds)
      ]
    ),
    [ID.HURL]: skillTooltip(
      "Release the stored Rock Barrier as projectiles, consume the follow-up, and begin Rock Barrier's recharge."
    ),
    [ID.SIGNET_OF_FIRE]: skillTooltip(
      'Passively gain precision while the signet is ready. Activate to burn your target; the passive is disabled during recharge unless Written in Stone is selected.',
      (balanceContext) => [profileFact(balanceContext, CORE.signetOfFire, 'attributeBonus', 'Passive precision')]
    ),
    [ID.ARCANE_ECHO]: skillTooltip(
      "Arm a window for the next completed weapon skill with a recharge. That skill receives the short recharge below, and its normal recharge duration is added to Arcane Echo's recharge.",
      (balanceContext) => [
        profileFact(balanceContext, CORE.arcaneEcho, 'durationMultiplier', 'Window', tooltipSeconds),
        profileFact(balanceContext, CORE.arcaneEcho, 'recharge', 'Weapon recharge after triggering', tooltipSeconds)
      ]
    ),
    [ID.RIDE_THE_LIGHTNING]: skillTooltip(
      "Strike your target. The simulator applies this skill's hit recharge reduction.",
      (balanceContext) => [
        profileFact(balanceContext, CORE.rideTheLightning, 'rechargeMultiplier', 'Recharge on hit', tooltipFactorChange)
      ]
    ),
    [ID.FULGOR]: skillTooltip(
      "Strike and create an additional repeating damage sequence that cannot critically strike. Recasting replaces the previous sequence's remaining pulses.",
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.fulgor).effects?.flatMap((effect) =>
            effect.type === 'strike'
              ? (effect.ticks || []).map((tick) => ({ ...tick, type: 'strike' as const, noCrit: true }))
              : []
          ),
          'additional pulses'
        ).facts
    ),
    [ID.SEETHE]: skillTooltip("Empower the next non-autoattack spear skill's strike damage.", (balanceContext) => [
      profileFact(
        balanceContext,
        CORE.spearEmpowerments,
        'damageMultiplier',
        "Next eligible skill's strike damage",
        tooltipFactorChange
      )
    ]),
    [ID.RIPPLE]: skillTooltip(
      'Reduce the recharge of the next eligible non-autoattack spear skill.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          CORE.spearEmpowerments,
          'rechargeMultiplier',
          "Next eligible skill's recharge",
          tooltipFactorChange
        )
      ]
    ),
    [ID.ENERGIZE]: skillTooltip("Make the next non-autoattack spear skill's strikes critically hit."),
    [ID.HARDEN]: skillTooltip('Add a control effect to the first strike of the next non-autoattack spear skill.'),
    [ID.ELEMENTAL_EXPLOSION]: skillTooltip(
      'Consume all stocked elemental bullets and apply the explosion effects. Gain the aura matching your primary attunement.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.elementalExplosion).effects,
          'primary attunement alternative'
        ).facts
    ),
    [ID.RAGING_RICOCHET]: skillTooltip(
      'Strike and apply conditions. Stock a Fire bullet if none is loaded; otherwise consume it to gain might.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.ragingRicochet).effects,
          'when consuming a Fire bullet'
        ).facts
    ),
    [ID.SEARING_SALVO]: skillTooltip(
      'Strike and apply conditions. Stock a Fire bullet if none is loaded; otherwise consume it to gain Fire Aura.',
      (balanceContext) =>
        simulationEffectFacts(tooltipProfile(balanceContext, CORE.searingSalvo).effects, 'when consuming a Fire bullet')
          .facts
    ),
    [ID.FROZEN_FUSILLADE]: skillTooltip(
      'Create the damaging field. Stock a Water bullet if none is loaded; otherwise consume it to add a delayed detonation and bleeding.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.frozenFusillade).effects,
          'additional detonation when consuming a Water bullet'
        ).facts
    ),
    [ID.FRIGID_FLURRY]: skillTooltip(
      "Fire repeated projectiles. Stock a Water bullet if none is loaded; otherwise consume it. The bullet's healing enhancement is outside combat simulation scope. Each shot can act as a projectile finisher."
    ),
    [ID.DAZING_DISCHARGE]: skillTooltip(
      "Strike and daze your target. Stock an Air bullet if none is loaded; otherwise consume it to shorten the next eligible pistol skill's recharge.",
      (balanceContext) => [
        profileFact(
          balanceContext,
          CORE.dazingDischarge,
          'durationMultiplier',
          'Recharge bonus window',
          tooltipSeconds
        ),
        profileFact(
          balanceContext,
          CORE.dazingDischarge,
          'rechargeMultiplier',
          'Next eligible pistol recharge',
          tooltipFactorChange
        )
      ]
    ),
    [ID.SHATTERING_STONE]: skillTooltip(
      'Strike and apply conditions. Stock an Earth bullet if none is loaded; otherwise consume it to arm bleeding on your next qualifying hits.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.shatteringStone, 'maximumStacks', 'Enhanced bleeding charges'),
        profileFact(balanceContext, CORE.shatteringStone, 'durationMultiplier', 'Charge window', tooltipSeconds),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.shatteringStone).effects,
          'per enhanced charge consumed'
        ).facts
      ]
    ),
    [ID.BOULDER_BLAST]: skillTooltip(
      'Strike and apply conditions. Stock an Earth bullet if none is loaded; otherwise consume it for an additional projectile-finisher attempt.'
    ),
    [ID.AERIAL_AGILITY]: skillTooltip(
      'Stock an Air bullet without consuming an existing one and unlock the follow-up chain.'
    ),
    [ID.AERIAL_AGILITY_CHAIN]: skillTooltip(
      'Use the Air pistol follow-up. This chain link neither stocks nor consumes a bullet.'
    ),
    [ID.AERIAL_AGILITY_DASH]: skillTooltip(
      'Use the Air pistol dash follow-up. This chain link neither stocks nor consumes a bullet.'
    ),
    ...Object.fromEntries(
      [
        [ID.FROSTFIRE_FLURRY, WEAVER.frostfireFlurry],
        [ID.PURBLINDING_PLASMA, WEAVER.purblindingPlasma],
        [ID.MOLTEN_METEOR, WEAVER.moltenMeteor],
        [ID.FLOWING_FINESSE, WEAVER.flowingFinesse],
        [ID.ENERVATING_EARTH, WEAVER.enervatingEarth]
      ].map(([id, profile]) => [
        id,
        skillTooltip(
          "Apply this dual attack's effects. For each of its elements, consume a stocked bullet for the corresponding enhancement or stock a bullet when none is available. Air bullets can additionally shorten Purblinding Plasma's recharge or add control to Enervating Earth.",
          (balanceContext) =>
            simulationEffectFacts(
              tooltipProfile(balanceContext, profile).effects,
              'only when consuming the named bullet'
            ).facts
        )
      ])
    ),
    [ID.ECHOING_EROSION]: skillTooltip(
      "Apply the dual attack's effects and update its Water and Earth bullets: consume each stocked bullet, or stock it when absent. The bullet enhancements add no separate damage payload in this simulation."
    ),
    [ID.WEAVE_SELF]: skillTooltip(
      'Begin Weave Self and rapidly cycle attunements. Fire increases condition damage; Air increases strike damage. Visiting every element grants Perfect Weave and unlocks Tailored Victory. The recharge begins when the active sequence ends.',
      (balanceContext) => [
        profileFact(balanceContext, WEAVER.resources, 'durationMultiplier', 'Weave Self window', tooltipSeconds),
        profileFact(balanceContext, WEAVER.resources, 'recharge', 'Perfect Weave window', tooltipSeconds),
        modifierFact(balanceContext, 'elementalist.weave-self-air', 'amount', 'Air strike damage'),
        modifierFact(balanceContext, 'elementalist.weave-self-fire', 'amount', 'Fire condition damage')
      ]
    ),
    [ID.TAILORED_VICTORY]: skillTooltip(
      'Consume Perfect Weave and apply the control effect. Requires an active Perfect Weave window.'
    ),
    [ID.UNRAVEL]: skillTooltip(
      'Align both hands to your primary attunement and reset all attunement recharges. Gain the matching elemental boon; the hands remain aligned during the window.',
      (balanceContext) => [
        profileFact(balanceContext, WEAVER.unravel, 'durationMultiplier', 'Unravel window', tooltipSeconds),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, WEAVER.unravel).effects,
          'primary attunement alternative'
        ).facts
      ]
    ),
    [ID.FERVENT_STANCE]: skillTooltip(
      "Apply the stance's immediate effects and arm might grants for completed dual attacks.",
      (balanceContext) => [
        profileFact(balanceContext, WEAVER.ferventStance, 'durationMultiplier', 'Stance window', tooltipSeconds),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, WEAVER.ferventStance).effects,
          'per completed dual attack'
        ).facts
      ]
    ),
    [ID.RELENTLESS_FIRE]: skillTooltip(
      'Temporarily increase strike and condition damage. An active Fire Jade Sphere grants the longer window.',
      (balanceContext) => [
        profileFact(balanceContext, CATALYST.relentlessFire, 'durationMultiplier', 'Base window', tooltipSeconds),
        profileFact(
          balanceContext,
          CATALYST.relentlessFire,
          'durationPerTier',
          'Window with Fire sphere',
          tooltipSeconds
        ),
        modifierFact(balanceContext, 'elementalist.relentless-fire', 'amount', 'Strike damage'),
        modifierFact(balanceContext, 'elementalist.relentless-fire-condition', 'amount', 'Condition damage')
      ]
    ),
    [ID.SHATTERING_ICE]: skillTooltip(
      'Qualifying hits trigger an additional strike and Chilled during the buff. An active Water Jade Sphere grants the longer window.',
      (balanceContext) => [
        profileFact(balanceContext, CATALYST.shatteringIce, 'durationMultiplier', 'Base window', tooltipSeconds),
        profileFact(
          balanceContext,
          CATALYST.shatteringIce,
          'durationPerTier',
          'Window with Water sphere',
          tooltipSeconds
        ),
        profileFact(balanceContext, CATALYST.shatteringIce, 'internalCooldown', 'Trigger interval', tooltipSeconds),
        ...simulationEffectFacts(tooltipProfile(balanceContext, CATALYST.shatteringIce).effects, 'per trigger').facts
      ]
    ),
    [ID.ELEMENTAL_CELERITY]: skillTooltip(
      'Reset the recharges of eligible weapon skills matching your primary attunement. Gain a boon for each corresponding Jade Sphere currently active.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, CATALYST.elementalCelerity).effects,
          'requires the named active sphere'
        ).facts
    ),
    [ID.REJUVENATE]: skillTooltip(
      'Refill the familiar charge bar. Healing is outside combat simulation scope.',
      (balanceContext) => [profileFact(balanceContext, EVOKER.resources, 'maximumStacks', 'Base charges after use')]
    ),
    [ID.FOXS_FURY]: skillTooltip(
      'Grant party might and Fury, with additional might while attuned to Fire. Also strike and burn your target using the tier selected by your might at cast start. Altruistic Aspect can add its meditation boon.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.foxsFury, 'threshold', 'Might stacks per additional tier'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.foxsFury).effects,
          'mutually exclusive might tiers'
        ).facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.familiarUtility)
            .effects?.filter((effect) => effect.name?.startsWith('Fox'))
            .map((effect) => ({ ...effect, audience: { recipients: 'party' as const } })),
          'Fire Bonus is additional only in Fire'
        ).facts
      ]
    ),
    [ID.HARES_AGILITY]: skillTooltip(
      'Gain Electric Enchantment charges that add strikes to familiar attacks. Trigger Altruistic Aspect when selected.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.familiarUtility, 'playerStacks', 'Electric Enchantment charges'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.familiarUtility).effects?.filter(
            (effect) => effect.name === 'Hare Enchantment'
          )
        ).facts
      ]
    ),
    [ID.TOADS_FORTITUDE]: skillTooltip(
      "Apply the meditation's effects. While attuned to Earth, additionally gain resistance. Trigger Altruistic Aspect when selected.",
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.familiarUtility).effects?.filter(
            (effect) => effect.name === 'Toad Resistance'
          ),
          'only in Earth'
        ).facts
    ),
    [ID.ELEMENTAL_PROCESSION]: skillTooltip(
      'Release the direct effects of all four empowered familiars as independent sequences. Trigger Altruistic Aspect when selected.',
      (balanceContext) =>
        [ID.CONFLAGRATION, ID.BUOYANT_DELUGE, ID.LIGHTNING_BLITZ, ID.SEISMIC_IMPACT].flatMap((id) => {
          const familiar = balanceContext.catalog.skillsById.get(id);
          if (!familiar) throw new Error(`Missing familiar tooltip skill: ${id}`);
          return simulationEffectFacts(
            familiar.effects?.filter((effect) => ['strike', 'condition', 'blind', 'control'].includes(effect.type)),
            familiar.name
          ).facts;
        })
    ),
    [ID.IGNITE]: (balanceContext, entity) => {
      const familiar = balanceContext.catalog.skillsById.get(entity.id);
      if (!familiar) throw new Error(`Missing familiar tooltip skill: ${entity.id}`);
      return {
        description:
          "Spend the full familiar charge bar and add an empowered stack. Ignite's Burning duration advances through consecutive-use tiers and resets after inactivity. The last tier repeats until reset. Each listed duration replaces the native Burning duration.",
        facts: [
          ...simulationEffectFacts(familiar.effects?.filter((effect) => effect.type !== 'condition')).facts,
          ...simulationEffectFacts(
            tooltipProfile(balanceContext, EVOKER.ignite).effects,
            'alternative Burning duration per application; consecutive-use tier'
          ).facts,
          profileFact(balanceContext, EVOKER.ignite, 'threshold', 'Inactivity before tier reset', tooltipSeconds),
          profileFact(balanceContext, EVOKER.resources, 'maximumStacks', 'Familiar charges required')
        ]
      };
    },
    [ID.ZAP]: skillTooltip(
      'Spend the full familiar charge bar, add an empowered stack, and strike with your familiar. Gain the Zap buff for eligible follow-up effects.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.familiarUtility).effects?.filter(
            (effect) => effect.name === 'Zap Window'
          )
        ).facts
    ),
    [ID.LIGHTNING_BLITZ]: skillTooltip(
      'Spend your empowered familiar stacks and release the attack sequence. Gain an Electric Enchantment charge for additional familiar strikes.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.familiarUtility, 'resourceGain', 'Electric Enchantment charges'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.familiarUtility).effects?.filter(
            (effect) => effect.name === 'Lightning Blitz Enchantment'
          )
        ).facts
      ]
    ),
    [ID.GLYPH_OF_ELEMENTALS]: skillTooltip(
      'Summon a Fire Elemental with its own attributes and autonomous Fireball and Flame Burst attacks. Flame Barrage commands it to interrupt its current attack. The glyph recharges after the elemental expires.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.summonedElemental, 'durationMultiplier', 'Elemental lifetime', tooltipSeconds),
        profileFact(balanceContext, CORE.summonedElemental, 'recharge', 'Recharge after expiry', tooltipSeconds)
      ]
    ),
    [ID.GLYPH_OF_ELEMENTALS_EARTH]: skillTooltip(
      'Summon an Earth Elemental with its own attributes and autonomous Punch and Enervating Punch attacks. Stomp commands it to interrupt its current attack. The glyph recharges after the elemental expires.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.summonedElemental, 'durationMultiplier', 'Elemental lifetime', tooltipSeconds),
        profileFact(balanceContext, CORE.summonedElemental, 'recharge', 'Recharge after expiry', tooltipSeconds)
      ]
    ),
    [ID.FLAME_BARRAGE_ELEMENTAL_COMMAND]: skillTooltip(
      "Command the active Fire Elemental to stop its autonomous attack and fire projectiles followed by an explosion. Projectiles inflict Burning. Damage uses the elemental's own attributes.",
      () =>
        simulationEffectFacts([
          {
            type: 'strike',
            coefficient: FIRE_ELEMENTAL.flameBarrage.projectileCoefficient,
            applications: FIRE_ELEMENTAL.flameBarrage.projectileImpacts.length,
            actorType: 'summon'
          },
          { type: 'strike', coefficient: FIRE_ELEMENTAL.flameBarrage.explosionCoefficient, actorType: 'summon' },
          {
            type: 'condition',
            condition: 'Burning',
            stacks: FIRE_ELEMENTAL.flameBarrage.burningStacks,
            duration: FIRE_ELEMENTAL.flameBarrage.burningDuration,
            applications: FIRE_ELEMENTAL.flameBarrage.projectileImpacts.length,
            actorType: 'player'
          }
        ]).facts
    ),
    [ID.STOMP_ELEMENTAL_COMMAND]: skillTooltip(
      'Command the active Earth Elemental to stop its autonomous attack and stomp. It strikes, cripples and immobilizes the target, and grants party protection.',
      () =>
        simulationEffectFacts([
          { type: 'strike', flatDamage: EARTH_ELEMENTAL.stomp.baseDamage, actorType: 'summon' },
          {
            type: 'condition',
            condition: 'Crippled',
            duration: EARTH_ELEMENTAL.stomp.crippleDuration,
            actorType: 'player'
          },
          {
            type: 'condition',
            condition: 'Immobilized',
            duration: EARTH_ELEMENTAL.stomp.immobilizeDuration,
            actorType: 'player'
          },
          {
            type: 'boon',
            boon: 'Protection',
            duration: EARTH_ELEMENTAL.stomp.protectionDuration,
            actorType: 'player',
            audience: { recipients: 'party', maximumRecipients: 5 }
          }
        ]).facts
    )
  },
  traits: {
    [TRAIT.SOOTHING_MIST]: outsideScopeTooltip,
    [TRAIT.HEALING_RIPPLE]: outsideScopeTooltip,
    [TRAIT.AQUAMANCERS_TRAINING]: traitTooltip('Water-attuned skills recharge faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'rechargeMultiplier', 'Water skill recharge', tooltipFactorChange)
    ]),
    [TRAIT.SOOTHING_ICE]: traitTooltip(
      'Completing a healing skill grants Frost Aura and regeneration.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.PIERCING_SHARDS]: traitTooltip(
      'Your strikes deal increased damage against vulnerable targets, with a larger bonus while primarily attuned to Water.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'elementalist.piercing-shards',
          'otherFactor',
          'Strike damage',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'elementalist.piercing-shards',
          'waterFactor',
          'Strike damage in Water',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.STOP_DROP_AND_ROLL]: outsideScopeTooltip,
    [TRAIT.SOOTHING_DISRUPTION]: outsideScopeTooltip,
    [TRAIT.CLEANSING_WAVE]: outsideScopeTooltip,
    [TRAIT.FLOW_LIKE_WATER]: traitTooltip(
      'Your strikes deal increased damage. The full-health condition applies throughout combat.',
      (balanceContext) => [
        modifierFact(balanceContext, 'elementalist.flow-like-water', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.CLEANSING_WATER]: outsideScopeTooltip,
    [TRAIT.POWERFUL_AURA]: outsideScopeTooltip,
    [TRAIT.SOOTHING_POWER]: traitTooltip(
      'Gain vitality. Healing is outside combat simulation scope.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Vitality')]
    ),
    [TRAIT.STONE_FLESH]: outsideScopeTooltip,
    [TRAIT.EARTHEN_BLAST]: traitTooltip(
      'Entering Earth in combat, or beginning an Earth overload, triggers a strike that cannot critically strike.'
    ),
    [TRAIT.GEOMANCERS_TRAINING]: traitTooltip('Earth-attuned skills recharge faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'rechargeMultiplier', 'Earth skill recharge', tooltipFactorChange)
    ]),
    [TRAIT.EARTHS_EMBRACE]: traitTooltip('Completing a healing skill grants resistance.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.SERRATED_STONES]: traitTooltip(
      'Bleeding lasts longer. Your strikes deal increased damage against bleeding targets.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Bleeding duration', percentagePoints),
        modifierFact(
          balanceContext,
          'elementalist.serrated-stones',
          'factor',
          'Strike damage against bleeding targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.ELEMENTAL_SHIELDING]: traitTooltip('Gaining an aura grants protection.'),
    [TRAIT.STRENGTH_OF_STONE]: traitTooltip(
      'Gain condition damage from toughness. Immobilizing the target inflicts bleeding.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          id,
          'attributeConversion',
          'Toughness converted to condition damage',
          tooltipPercent
        ),
        profileFact(balanceContext, id, 'internalCooldown', 'Bleeding cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.ROCK_SOLID]: traitTooltip('Entering Earth in combat grants stability.'),
    [TRAIT.EARTHEN_BLESSING]: outsideScopeTooltip,
    [TRAIT.DIAMOND_SKIN]: outsideScopeTooltip,
    [TRAIT.WRITTEN_IN_STONE]: traitTooltip(
      'Signet of Fire retains its passive while recharging. Completing Signet of Restoration, Fire, or Earth grants its corresponding aura.'
    ),
    [TRAIT.STONE_HEART]: outsideScopeTooltip,
    [TRAIT.EMPOWERING_FLAME]: traitTooltip('Gain power while primarily attuned to Fire.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Power in Fire')
    ]),
    [TRAIT.SUNSPOT]: traitTooltip(
      'Entering Fire in combat, or beginning a Fire overload, grants Fire Aura and triggers a strike that cannot critically strike.'
    ),
    [TRAIT.PYROMANCERS_TRAINING]: traitTooltip(
      'Fire-attuned skills recharge faster. Your strikes deal increased damage against burning targets.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Fire skill recharge', tooltipFactorChange),
        modifierFact(
          balanceContext,
          'elementalist.pyromancers-training',
          'factor',
          'Strike damage against burning targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.BURNING_PRECISION]: traitTooltip(
      'Eligible critical hits have a chance to burn the target. Burning lasts longer.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'procChance', 'Chance on critical hit', tooltipPercent),
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        profileFact(balanceContext, id, 'durationMultiplier', 'Burning duration', percentagePoints)
      ]
    ),
    [TRAIT.CONJURER]: traitTooltip('Equipping a conjured weapon grants Fire Aura.'),
    [TRAIT.BURNING_FIRE]: outsideScopeTooltip,
    [TRAIT.BURNING_RAGE]: traitTooltip(
      'Gain condition damage. Sunspot also burns the target.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Condition damage')]
    ),
    [TRAIT.SMOTHERING_AURAS]: traitTooltip('Auras last longer.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'durationMultiplier', 'Aura duration', tooltipFactorChange)
    ]),
    [TRAIT.POWER_OVERWHELMING]: traitTooltip(
      'Gain power while you have enough might. Fire attunement uses the larger bonus instead.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'minimumStacks', 'Might stacks required'),
        profileFact(balanceContext, id, 'attributeBonus', 'Power outside Fire'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Power in Fire')
      ]
    ),
    [TRAIT.PERSISTING_FLAMES]: traitTooltip(
      'Eligible fire-field hits grant temporary strike-damage stacks. Weapon fire fields last longer and repeat their final damage and condition packets.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'elementalist.persisting-flames', 'damagePerStack', 'Strike damage per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Stack duration', tooltipSeconds),
        profileFact(balanceContext, id, 'durationPerTier', 'Additional weapon field duration', tooltipSeconds),
        profileFact(balanceContext, id, 'summons', 'Additional weapon field packets')
      ]
    ),
    [TRAIT.PYROMANCERS_PUISSANCE]: traitTooltip(
      'Using skills in Fire grants might. Leaving Fire or completing Overload Fire triggers Flame Expulsion: snapshot your capped might, scale its strike and burning, and grant that many might stacks to other allies.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'initialDelay', 'Flame Expulsion delay', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum might counted'),
        profileFact(balanceContext, id, 'damageIncreasePerStack', 'Additional strike coefficient per might'),
        profileFact(balanceContext, id, 'durationPerTier', 'Additional burning duration per might', tooltipSeconds)
      ],
      'listed Flame Expulsion damage is before might scaling'
    ),
    [TRAIT.INFERNO]: traitTooltip(
      'Burning scales with power instead of condition damage, retaining the shared burning base damage.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'elementalist.inferno',
          'powerScaling',
          'Burning damage per second per power',
          tooltipDecimal
        )
      ]
    ),
    [TRAIT.ARCANE_PROWESS]: traitTooltip('Changing attunement grants might.'),
    [TRAIT.ELEMENTAL_ATTUNEMENT]: traitTooltip(
      'Changing attunement grants the boon corresponding to the element entered.'
    ),
    [TRAIT.ELEMENTAL_ENCHANTMENT]: traitTooltip(
      'Gain concentration. Attunement and overload recharges are reduced.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Concentration'),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.ARCANE_PRECISION]: traitTooltip(
      'Eligible critical hits have a chance to apply the condition corresponding to your primary attunement.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'procChance', 'Chance on critical hit', tooltipPercent),
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.RENEWING_STAMINA]: traitTooltip('Eligible critical hits grant vigor.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.ARCANE_RESTORATION]: outsideScopeTooltip,
    [TRAIT.ARCANE_RESURRECTION]: outsideScopeTooltip,
    [TRAIT.ELEMENTAL_LOCKDOWN]: traitTooltip(
      'Control effects grant the boon corresponding to your primary attunement.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.FINAL_SHIELDING]: outsideScopeTooltip,
    [TRAIT.EVASIVE_ARCANA]: traitTooltip(
      "Completing a dodge triggers your primary attunement's effect: Fire strikes and burns, Earth strikes and applies conditions with a blast finisher, and Air blinds. Water healing and cleansing are outside combat scope.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Cooldown per attunement', tooltipSeconds)
      ]
    ),
    [TRAIT.ARCANE_LIGHTNING]: traitTooltip(
      'Completing an arcane skill grants temporary ferocity and its corresponding extra effect. Arcane Blast blinds the target.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Ferocity during Arcane Lightning')]
    ),
    [TRAIT.BOUNTIFUL_POWER]: traitTooltip(
      'After enough attunement transitions, gain quickness and a temporary strike-damage bonus.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'threshold', 'Transitions required'),
        modifierFact(balanceContext, 'elementalist.bountiful-power', 'amount', 'Strike damage during bonus')
      ]
    ),
    [TRAIT.ZEPHYRS_SPEED]: traitTooltip('Gain personal critical-strike chance.', (balanceContext) => [
      modifierFact(balanceContext, 'elementalist.zephyrs-speed-critical-chance', 'amount', 'Critical chance')
    ]),
    [TRAIT.ELECTRIC_DISCHARGE]: traitTooltip(
      'Entering Air in combat, or beginning an Air overload, strikes the target and inflicts vulnerability. Electric Discharge has increased critical damage.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'elementalist.electric-discharge-critical-damage',
          'factor',
          'Electric Discharge critical damage',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.AEROMANCERS_TRAINING]: traitTooltip(
      'Gain ferocity and an additional equal ferocity bonus while primarily attuned to Air. Air-attuned skills recharge faster.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Ferocity per bonus'),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Air skill recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.ZEPHYRS_BOON]: traitTooltip('Gaining an aura grants fury and swiftness.'),
    [TRAIT.ONE_WITH_AIR]: traitTooltip('Entering Air grants superspeed.'),
    [TRAIT.FEROCIOUS_WINDS]: traitTooltip('Gain ferocity from eligible precision.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeConversion', 'Precision converted to ferocity', tooltipPercent)
    ]),
    [TRAIT.INSCRIPTION]: traitTooltip(
      'Completing a glyph grants the boon corresponding to your primary attunement. Entering Air separately grants resistance.'
    ),
    [TRAIT.RAGING_STORM]: traitTooltip(
      'Eligible critical hits grant fury. Gain ferocity while fury is active.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Fury cooldown', tooltipSeconds),
        profileFact(balanceContext, id, 'attributeBonus', 'Ferocity with fury')
      ]
    ),
    [TRAIT.STORMSOUL]: traitTooltip('Your strikes deal increased damage.', (balanceContext) => [
      modifierFact(balanceContext, 'elementalist.stormsoul', 'factor', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.BOLT_TO_THE_HEART]: traitTooltip(
      'Your strikes deal increased damage against targets at or below half health.',
      (balanceContext) => [
        modifierFact(balanceContext, 'elementalist.bolt-to-the-heart', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.FRESH_AIR]: traitTooltip(
      'Eligible critical hits while outside Air recharge Air attunement and Overload Air. Newly entering Air grants temporary ferocity.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Ferocity during Fresh Air')]
    ),
    [TRAIT.LIGHTNING_ROD]: traitTooltip('Qualifying control effects trigger a strike and inflict weakness.'),
    [TRAIT.SINGULARITY]: traitTooltip(
      'Unlock Tempest, warhorn, shouts, and overloads. Holding an attunement forms its singularity, making its overload available.'
    ),
    [TRAIT.GATHERED_FOCUS]: traitTooltip('Gain concentration.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Concentration')
    ]),
    [TRAIT.HARDY_CONDUIT]: traitTooltip('Beginning an overload grants protection.'),
    [TRAIT.GALE_SONG]: traitTooltip('Completing a healing skill grants protection.'),
    [TRAIT.LATENT_STAMINA]: traitTooltip('Entering Water grants vigor.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.UNSTABLE_CONDUIT]: traitTooltip('Completing an overload grants the aura corresponding to its attunement.'),
    [TRAIT.TEMPESTUOUS_ARIA]: traitTooltip(
      'Completing a shout grants might to the party. Gaining an aura starts or extends a temporary strike- and condition-damage bonus.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'elementalist.tempestuous-aria-strike', 'amount', 'Strike damage during bonus'),
        modifierFact(
          balanceContext,
          'elementalist.tempestuous-aria-condition',
          'amount',
          'Condition damage during bonus'
        ),
        profileFact(balanceContext, id, 'durationMultiplier', 'Bonus duration added per aura', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum remaining bonus duration', tooltipSeconds)
      ],
      'shout might to party'
    ),
    [TRAIT.HARMONIOUS_CONDUIT]: traitTooltip('Beginning an overload grants swiftness and stability.'),
    [TRAIT.INVIGORATING_TORRENTS]: traitTooltip('Gaining an aura grants vigor and regeneration.'),
    [TRAIT.TRANSCENDENT_TEMPEST]: traitTooltip(
      'Singularities form sooner. Completing an overload grants a temporary strike- and condition-damage bonus.',
      (balanceContext, id) => [
        profileFact(balanceContext, TEMPEST.overloads, 'durationMultiplier', 'Base attunement dwell', tooltipSeconds),
        profileFact(balanceContext, id, 'durationMultiplier', 'Damage-bonus duration', tooltipSeconds),
        modifierFact(balanceContext, 'elementalist.transcendent-tempest-strike', 'amount', 'Strike damage'),
        modifierFact(balanceContext, 'elementalist.transcendent-tempest-condition', 'amount', 'Condition damage')
      ]
    ),
    [TRAIT.LUCID_SINGULARITY]: traitTooltip(
      'The first eligible overload hits grant alacrity to yourself. The last emitted hit within the limit uses the longer application, including when interrupted.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'maximumStacks', 'Maximum alacrity applications')]
    ),
    [TRAIT.ELEMENTAL_BASTION]: traitTooltip(
      'Gaining an aura grants alacrity. Healing is outside combat simulation scope.'
    ),
    [TRAIT.WEAVER]: traitTooltip(
      'Unlock Weaver, sword, stances, and dual attunements. Weapon skills depend on your primary and secondary elements.'
    ),
    [TRAIT.ELEMENTAL_REFRESHMENT]: traitTooltip(
      'Gain vitality. Barrier does not change outgoing combat results.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Vitality')]
    ),
    [TRAIT.ELEMENTAL_POLYPHONY]: traitTooltip(
      'Gain attributes from each distinct active attunement: Fire grants power, Air ferocity, and Earth condition damage. Matching elements apply once.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Bonus per corresponding attribute')]
    ),
    [TRAIT.SUPERIOR_ELEMENTS]: traitTooltip(
      'Completing an eligible dual attack inflicts weakness. Gain personal critical-strike chance against weakened targets.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Weakness cooldown', tooltipSeconds),
        modifierFact(
          balanceContext,
          'elementalist.superior-elements',
          'amount',
          'Critical chance against weakened targets'
        )
      ]
    ),
    [TRAIT.ELEMENTAL_PURSUIT]: traitTooltip('Player control effects grant swiftness.'),
    [TRAIT.WEAVERS_PROWESS]: traitTooltip('Fully attuning to an element grants resistance.'),
    [TRAIT.MASTERS_FORTITUDE]: outsideScopeTooltip,
    [TRAIT.SWIFT_REVENGE]: traitTooltip(
      'Completing a dual attack grants benefits for its elements: Fire grants might, Air swiftness, and Earth endurance.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Endurance from Earth')]
    ),
    [TRAIT.BOLSTERED_ELEMENTS]: traitTooltip('Completing a stance grants protection.'),
    [TRAIT.ELEMENTS_OF_RAGE]: traitTooltip(
      'Fully attuning to an element grants a temporary strike- and condition-damage bonus.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Bonus duration', tooltipSeconds),
        modifierFact(balanceContext, 'elementalist.elements-of-rage-strike', 'amount', 'Strike damage'),
        modifierFact(balanceContext, 'elementalist.elements-of-rage-condition', 'amount', 'Condition damage')
      ]
    ),
    [TRAIT.WOVEN_STRIDE]: outsideScopeTooltip,
    [TRAIT.FLOW_STATE]: traitTooltip(
      "Reduce Weaver's attunement recharge and dual-attack recharge.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeReduction', 'Attunement recharge removed', tooltipSeconds),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Dual-attack recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.DEPTH_OF_ELEMENTS]: traitTooltip(
      'Unlock Catalyst, hammer, augments, energy, and Jade Sphere. Damage builds energy while the sphere is inactive.'
    ),
    [TRAIT.ELEMENTAL_EMPOWERMENT]: traitTooltip(
      'Elemental Empowerment grants temporary increases to eligible power, precision, ferocity, condition damage, expertise, and concentration.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributePerStack', 'Attribute increase per stack', tooltipPercent),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        profileFact(balanceContext, id, 'playerStacks', 'Initial stacks'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Initial stack duration', tooltipSeconds)
      ]
    ),
    [TRAIT.ELEMENTAL_EPITOME]: traitTooltip(
      'Combos grant the aura corresponding to your primary attunement, with separate cooldowns for each element. Gaining an aura in combat grants Elemental Empowerment.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Combo aura cooldown per attunement', tooltipSeconds)
      ]
    ),
    [TRAIT.HARDENED_AURAS]: outsideScopeTooltip,
    [TRAIT.VICIOUS_EMPOWERMENT]: traitTooltip(
      'Control or immobilize effects in combat grant Elemental Empowerment and might.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.ENERGIZED_ELEMENTS]: traitTooltip('Changing attunement grants energy and fury.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Energy gained')
    ]),
    [TRAIT.EMPOWERING_AURAS]: traitTooltip(
      'Gaining an aura adds a damage-bonus stack and refreshes all active stacks.',
      (balanceContext, id) => [
        modifierFact(
          balanceContext,
          'elementalist.empowering-auras-strike',
          'damagePerStack',
          'Strike damage per stack'
        ),
        modifierFact(
          balanceContext,
          'elementalist.empowering-auras-condition',
          'damagePerStack',
          'Condition damage per stack'
        ),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Stack duration', tooltipSeconds)
      ]
    ),
    [TRAIT.EVASIVE_EMPOWERMENT]: outsideScopeTooltip,
    [TRAIT.SPECTACULAR_SPHERE]: traitTooltip(
      "Deploying Jade Sphere grants quickness and the additional boon corresponding to the sphere's element."
    ),
    [TRAIT.ELEMENTAL_SYNERGY]: traitTooltip(
      'Combos grant an effect for your primary attunement: might in Fire, stability in Earth, or endurance in Air.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Cooldown per attunement', tooltipSeconds),
        profileFact(balanceContext, id, 'resourceGain', 'Endurance in Air')
      ]
    ),
    [TRAIT.EMPOWERED_EMPOWERMENT]: traitTooltip(
      "Improve Elemental Empowerment's attribute scaling. At maximum stacks, use the full-set bonus instead of the per-stack rate.",
      (balanceContext) => [
        profileFact(
          balanceContext,
          CATALYST.elementalEmpowerment,
          'coefficientMultiplier',
          'Attribute increase per stack below maximum',
          tooltipPercent
        ),
        profileFact(
          balanceContext,
          CATALYST.elementalEmpowerment,
          'attributeConversion',
          'Attribute increase at maximum stacks',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.SPHERE_SPECIALIST]: traitTooltip("Spectacular Sphere's boons last longer.", (balanceContext, id) => [
      profileFact(balanceContext, id, 'durationMultiplier', 'Boon duration', tooltipFactorChange)
    ]),
    [TRAIT.EVOCATION]: traitTooltip(
      'Unlock Evoker, familiars, meditations, and familiar charges. Choose a familiar element; with Fire selected, burning applications grant might.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.ignite, 'pulseInterval', 'Fire-familiar might cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.ENHANCED_POTENCY]: traitTooltip(
      'With Air selected, fury grants ferocity and additional critical chance. With Fire selected, might grants additional condition damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Air ferocity with fury'),
        modifierFact(
          balanceContext,
          'elementalist.enhanced-potency-air',
          'amount',
          'Air additional critical chance with fury'
        ),
        profileFact(balanceContext, id, 'attributePerStack', 'Fire condition damage per might')
      ]
    ),
    [TRAIT.FAMILIARS_PROWESS]: traitTooltip(
      'Completing a familiar skill starts or extends a damage-bonus window. Air selection increases strike damage; Fire selection increases condition damage.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'elementalist.familiars-prowess-strike', 'baseAmount', 'Air strike damage'),
        modifierFact(balanceContext, 'elementalist.familiars-prowess-condition', 'baseAmount', 'Fire condition damage'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Initial duration', tooltipSeconds),
        profileFact(balanceContext, id, 'durationPerTier', 'Duration added while active', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum remaining duration', tooltipSeconds)
      ]
    ),
    [TRAIT.FIERY_MIGHT]: traitTooltip('Deal increased strike damage against burning targets.', (balanceContext) => [
      modifierFact(balanceContext, 'elementalist.fiery-might', 'factor', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.ALTRUISTIC_ASPECT]: traitTooltip('Completing an eligible meditation grants its corresponding boon.'),
    [TRAIT.SPIRITS_SUCCOR]: outsideScopeTooltip,
    [TRAIT.FAMILIARS_FOCUS]: traitTooltip(
      "Improve Familiar's Prowess, using the stronger bonus for the selected element.",
      (balanceContext) => [
        modifierFact(balanceContext, 'elementalist.familiars-prowess-strike', 'focusedAmount', 'Air strike damage'),
        modifierFact(
          balanceContext,
          'elementalist.familiars-prowess-condition',
          'focusedAmount',
          'Fire condition damage'
        )
      ]
    ),
    [TRAIT.FAMILIARS_BLESSING]: (balanceContext, entity) => ({
      description:
        'Completing a Fire or Air familiar grants quickness. Water or Earth familiars grant alacrity instead.',
      facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect, index) =>
          simulationEffectFacts([effect], index === 0 ? 'Fire / Air familiar' : 'Water / Earth familiar').facts
      )
    }),
    [TRAIT.ELEMENTAL_DYNAMO]: traitTooltip(
      'Entering your selected familiar element grants familiar charges.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Charges gained')]
    ),
    [TRAIT.GALVANIC_ENCHANTMENT]: traitTooltip(
      'Completing a familiar grants Electric Enchantment charges. Your next qualifying player strikes consume charges to trigger an additional strike and burning.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'playerStacks', 'Charges granted'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Charge duration', tooltipSeconds)
      ],
      'per charge consumed'
    ),
    [TRAIT.ELEMENTAL_BALANCE]: traitTooltip(
      'Entering your selected familiar element enough times opens a brief window. The next non-autoattack weapon skill in that window has reduced recharge.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'threshold', 'Entries required'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Skill-use window', tooltipSeconds),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Next eligible skill recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.SPECIALIZED_ELEMENTS]: traitTooltip(
      'Lock attunement to the selected familiar element and generate more charges from matching eligible weapon skills. Familiar casts reduce active weapon cooldowns; empowered familiars also trigger elemental entry traits.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum familiar charges'),
        profileFact(balanceContext, id, 'playerStacks', 'Charges per matching weapon skill'),
        profileFact(
          balanceContext,
          EVOKER.specializedElementsBasicRecharge,
          'rechargeMultiplier',
          'Base weapon recharge removed by basic familiar',
          (value) => tooltipPercent(1 - value)
        ),
        profileFact(
          balanceContext,
          EVOKER.specializedElementsEmpoweredRecharge,
          'rechargeMultiplier',
          'Base weapon recharge removed by empowered familiar',
          (value) => tooltipPercent(1 - value)
        )
      ]
    )
  }
};
