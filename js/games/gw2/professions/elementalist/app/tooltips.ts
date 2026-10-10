import {
  fromProfile,
  fromModifier,
  modifierFact,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import {
  elementalProcessionEffects,
  IGNITE_TIERS,
  igniteTierEffect,
  projectIgniteEffects
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiar-projection.js';
import { familiarBlessingEffects } from '#gw2/professions/elementalist/specializations/evoker/traits/familiar-blessing.js';
import {
  AURA_TRANSMUTE_SKILLS,
  CONJURE_PICKUP_WEAPONS,
  CONJURE_SKILLS,
  ETCHING_CHAINS,
  HAMMER_ORB_SKILLS
} from '#gw2/professions/elementalist/core/constants.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE as EARTH_ELEMENTAL,
  FIRE_ELEMENTAL_EVTC_PROFILE as FIRE_ELEMENTAL
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/elementalist/core/profile-ids.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_JADE_SPHERE_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { CATALYST_BALANCE_PROFILE_IDS as CATALYST } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { EVOKER_BALANCE_PROFILE_IDS as EVOKER } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { TEMPEST_BALANCE_PROFILE_IDS as TEMPEST } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import { WEAVER_BALANCE_PROFILE_IDS as WEAVER } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';

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
  // Descriptions bind canonical skill IDs after removal of execution handler registrations.
  skills: {
    ...Object.fromEntries(
      [ID.WASH_THE_PAIN_AWAY, ID.FEEL_THE_BURN, ID.AFTERSHOCK].map((id) => [
        id,
        skillTooltip(
          "Apply this shout's effects and trigger applicable shout and aura traits. Tempestuous Aria adds party might."
        )
      ])
    ),
    ...Object.fromEntries(
      [ID.PRIMORDIAL_STANCE_FIRE, ID.PRIMORDIAL_STANCE_WATER, ID.PRIMORDIAL_STANCE_AIR, ID.PRIMORDIAL_STANCE_EARTH].map(
        (id) => [
          id,
          (balanceContext) => ({
            description:
              "Pulse strike damage and conditions throughout the stance. Each pulse reads your current primary and secondary attunements: each hand supplies its element's condition, so a shared attunement applies that condition twice. The strike occurs once per pulse.",
            facts: simulationEffectFacts(
              tooltipProfile(balanceContext, WEAVER.primordialStance).effects,
              'per pulse; conditions depend on current attunements'
            ).facts
          })
        ]
      )
    ),
    [ID.GRAND_FINALE]: skillTooltip(
      "Consume all active hammer orbs and fire one projectile per orb. Each projectile applies its element's effects. Consuming the orbs cancels their pending attacks.",
      () => [{ name: 'Combo finisher', detail: 'Projectile, per consumed orb' }]
    ),

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
        skillTooltip('Change attunement and your available weapon skills, triggering applicable attunement effects.')
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
                    canCrit: false
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
          [fromProfile(CATALYST.resources, 'resourceCost', 'Energy spent')]
        )
      ])
    ),
    ...Object.fromEntries(
      Object.keys(HAMMER_ORB_SKILLS).map((id) => [
        id,
        skillTooltip(
          "Create this attunement's hammer orb and refresh all active orb durations. Grand Finale consumes the active orbs and replaces their pending attacks with elemental projectiles.",
          [fromProfile(CORE.hammerOrbs, 'durationMultiplier', 'Refreshed orb duration', tooltipSeconds)]
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
          [fromProfile(CORE.hammerOrbs, 'durationMultiplier', 'Refreshed orb duration', tooltipSeconds)]
        )
      ])
    ),
    ...Object.fromEntries(
      Object.entries(CONJURE_SKILLS).map(([id, weapon]) => [
        id,
        skillTooltip(
          `Conjure and equip ${weapon}, replacing your weapon bar. Leave a second weapon available for a later pickup. Dropping the bundle restores your normal skills.`,
          [fromProfile(CORE.conjurePickups, 'durationMultiplier', 'Ground pickup lifetime', tooltipSeconds)]
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
            [fromProfile(CORE.spearEmpowerments, 'maximumStacks', 'Completed actions to fully charge')]
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
          [
            fromProfile(
              EVOKER.resources,
              BASIC_FAMILIARS.has(id) ? 'maximumStacks' : 'minimumStacks',
              BASIC_FAMILIARS.has(id) ? 'Familiar charges required' : 'Empowered stacks required'
            )
          ]
        )
      ])
    ),
    [SHARED_SKILL_IDS.DODGE]: skillTooltip(
      'Spend endurance to dodge and trigger Evasive Arcana when selected. Incoming attacks are outside combat simulation scope.',
      [fromProfile(CORE.resources, 'resourceCost', 'Endurance spent')]
    ),
    [ID.DROP_BUNDLE]: skillTooltip('Drop the conjured weapon and restore your normal weapon skills.'),
    [ID.ROCK_BARRIER]: skillTooltip(
      'Arm Hurl for the barrier window. Rock Barrier begins recharging when Hurl consumes it or the window expires.',
      [fromProfile(CORE.rockBarrier, 'durationMultiplier', 'Hurl window', tooltipSeconds)]
    ),
    [ID.HURL]: skillTooltip(
      "Release the stored Rock Barrier as projectiles, consume the follow-up, and begin Rock Barrier's recharge."
    ),
    [ID.SIGNET_OF_FIRE]: skillTooltip(
      'Passively gain precision while the signet is ready. Activate to burn your target; the passive is disabled during recharge unless Written in Stone is selected.',
      [fromProfile(CORE.signetOfFire, 'attributeBonus', 'Passive precision')]
    ),
    [ID.ARCANE_ECHO]: skillTooltip(
      "Arm a window for the next completed weapon skill with a recharge. If its cast begins within the window, it receives the short base recharge below, and its original recharge is added to Arcane Echo's base 15-second recharge, before Alacrity. Autoattacks and follow-up skills do not consume the effect; ammunition charges are not replenished.",
      [
        fromProfile(CORE.arcaneEcho, 'durationMultiplier', 'Window', tooltipSeconds),
        fromProfile(CORE.arcaneEcho, 'recharge', 'Weapon recharge after triggering', tooltipSeconds)
      ]
    ),
    [ID.RIDE_THE_LIGHTNING]: skillTooltip(
      "Strike your target. The simulator applies this skill's hit recharge reduction.",
      [fromProfile(CORE.rideTheLightning, 'rechargeMultiplier', 'Recharge on hit', tooltipFactorChange)]
    ),
    [ID.FULGOR]: skillTooltip(
      "Strike and create an additional repeating damage sequence that cannot critically strike. Recasting replaces the previous sequence's remaining pulses.",
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.fulgor).effects?.flatMap((effect) =>
            effect.type === 'strike'
              ? (effect.ticks || []).map((tick) => ({ ...tick, type: 'strike' as const, canCrit: false }))
              : []
          ),
          'additional pulses'
        ).facts
    ),
    [ID.SEETHE]: skillTooltip("Empower the next non-autoattack spear skill's strike damage.", [
      fromProfile(
        CORE.spearEmpowerments,
        'damageMultiplier',
        "Next eligible skill's strike damage",
        tooltipFactorChange
      )
    ]),
    [ID.RIPPLE]: skillTooltip('Reduce the recharge of the next eligible non-autoattack spear skill.', [
      fromProfile(CORE.spearEmpowerments, 'rechargeMultiplier', "Next eligible skill's recharge", tooltipFactorChange)
    ]),
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
      [
        fromProfile(CORE.dazingDischarge, 'durationMultiplier', 'Recharge bonus window', tooltipSeconds),
        fromProfile(CORE.dazingDischarge, 'rechargeMultiplier', 'Next eligible pistol recharge', tooltipFactorChange)
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
      [
        fromProfile(WEAVER.resources, 'durationMultiplier', 'Weave Self window', tooltipSeconds),
        fromProfile(WEAVER.resources, 'recharge', 'Perfect Weave window', tooltipSeconds),
        fromModifier('elementalist.weave-self-air', 'amount', 'Air strike damage'),
        fromModifier('elementalist.weave-self-fire', 'amount', 'Fire condition damage')
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
      [
        fromModifier('elementalist.relentless-fire', 'amount', 'Strike damage'),
        fromModifier('elementalist.relentless-fire-condition', 'amount', 'Condition damage')
      ]
    ),
    [ID.SHATTERING_ICE]: skillTooltip(
      'Qualifying hits trigger an additional strike and Chilled during the buff. An active Water Jade Sphere grants the longer window.',
      (balanceContext) => [
        profileFact(balanceContext, CATALYST.shatteringIce, 'internalCooldown', 'Trigger interval', tooltipSeconds),
        ...simulationEffectFacts(tooltipProfile(balanceContext, CATALYST.shatteringIce).effects, 'per trigger').facts
      ]
    ),
    [ID.ELEMENTAL_CELERITY]: skillTooltip(
      'Reset eligible weapon recharges in your primary attunement. Each authored boon requires its named Jade Sphere to remain active through completion.'
    ),
    [ID.REJUVENATE]: skillTooltip('Refill the familiar charge bar. Healing is outside combat simulation scope.', [
      fromProfile(EVOKER.resources, 'maximumStacks', 'Base charges after use')
    ]),
    [ID.FOXS_FURY]: skillTooltip(
      'Grant party might and Fury, with additional might while attuned to Fire. Also strike and burn your target using the tier selected by your might at cast start. Altruistic Aspect can add its meditation boon.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.foxsFury, 'threshold', 'Might stacks per additional tier'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.foxsFury).effects?.filter((effect) => effect.name?.startsWith('Tier ')),
          'mutually exclusive might tiers'
        ).facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.foxsFury)
            .effects?.filter((effect) => effect.name?.startsWith('Fox'))
            .map((effect) => ({ ...effect, audience: { recipients: 'party' as const } })),
          'Fire Bonus is additional only in Fire'
        ).facts
      ]
    ),
    [ID.HARES_AGILITY]: skillTooltip(
      'Gain Electric Enchantment charges that add strikes to familiar attacks. Trigger Altruistic Aspect when selected.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.haresAgility, 'playerStacks', 'Electric Enchantment charges'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.haresAgility).effects?.filter(
            (effect) => effect.name === 'Hare Enchantment'
          )
        ).facts
      ]
    ),
    [ID.TOADS_FORTITUDE]: skillTooltip(
      "Apply the meditation's effects. While attuned to Earth, additionally gain resistance. Trigger Altruistic Aspect when selected.",
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.toadsFortitude).effects?.filter(
            (effect) => effect.name === 'Toad Resistance'
          ),
          'only in Earth'
        ).facts
    ),
    [ID.ELEMENTAL_PROCESSION]: skillTooltip(
      'Release the direct effects of all four empowered familiars as independent sequences. Trigger Altruistic Aspect when selected.',
      (balanceContext) =>
        elementalProcessionEffects(balanceContext.catalog.skillsById).flatMap(
          ({ familiar, effects }) => simulationEffectFacts(effects, familiar.name).facts
        )
    ),
    [ID.IGNITE]: (balanceContext, entity) => {
      const familiar = balanceContext.catalog.skillsById.get(entity.id);
      if (!familiar) throw new Error(`Missing familiar tooltip skill: ${entity.id}`);
      // Each alternative projects the surviving native packets, exactly as an accepted consecutive-use tier does.
      const tiers = IGNITE_TIERS.map((label, tier) => ({
        label,
        model: simulationEffectFacts(
          projectIgniteEffects(familiar.effects ?? [], igniteTierEffect(balanceContext, tier))
        )
      }));
      return {
        description:
          "Spend the full familiar charge bar and add an empowered stack. Ignite's Burning duration advances through consecutive-use tiers and resets after inactivity. The last tier repeats until reset. Each listed duration replaces the native Burning duration.",
        facts: [
          profileFact(balanceContext, EVOKER.ignite, 'threshold', 'Inactivity before tier reset', tooltipSeconds),
          profileFact(balanceContext, EVOKER.resources, 'maximumStacks', 'Familiar charges required')
        ],
        factTabs: tiers.map(({ label, model }) => ({ label, facts: model.facts })),
        incomplete: tiers.some(({ model }) => model.incomplete)
      };
    },
    [ID.CALCIFY]: skillTooltip(
      'While the Earth familiar is selected, disabling an enemy grants Protection to yourself. The active familiar blast can trigger this passive.',
      (balanceContext) => [
        ...simulationEffectFacts(tooltipProfile(balanceContext, EVOKER.calcify).effects, 'on disabling an enemy').facts,
        profileFact(balanceContext, EVOKER.calcify, 'internalCooldown', 'Protection interval', tooltipSeconds)
      ]
    ),
    [ID.ZAP]: skillTooltip(
      'Spend the full familiar charge bar, add an empowered stack, and strike with your familiar. Gain the Zap buff for eligible follow-up effects.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.zap).effects?.filter((effect) => effect.name === 'Zap Window')
        ).facts
    ),
    [ID.LIGHTNING_BLITZ]: skillTooltip(
      'Spend your empowered familiar stacks and release the attack sequence. Gain an Electric Enchantment charge for additional familiar strikes.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.lightningBlitz, 'resourceGain', 'Electric Enchantment charges'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.lightningBlitz).effects?.filter(
            (effect) => effect.name === 'Lightning Blitz Enchantment'
          )
        ).facts
      ]
    ),
    [ID.GLYPH_OF_ELEMENTALS]: skillTooltip(
      'Summon a Fire Elemental with its own attributes and autonomous Fireball and Flame Burst attacks. Flame Barrage commands it to interrupt its current attack. The glyph recharges after the elemental expires.',
      [
        fromProfile(CORE.summonedElemental, 'durationMultiplier', 'Elemental lifetime', tooltipSeconds),
        fromProfile(CORE.summonedElemental, 'recharge', 'Recharge after expiry', tooltipSeconds)
      ]
    ),
    [ID.GLYPH_OF_ELEMENTALS_EARTH]: skillTooltip(
      'Summon an Earth Elemental with its own attributes and autonomous Punch and Enervating Punch attacks. Stomp commands it to interrupt its current attack. The glyph recharges after the elemental expires.',
      [
        fromProfile(CORE.summonedElemental, 'durationMultiplier', 'Elemental lifetime', tooltipSeconds),
        fromProfile(CORE.summonedElemental, 'recharge', 'Recharge after expiry', tooltipSeconds)
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
    [TRAIT.AQUAMANCERS_TRAINING]: traitTooltip('Water-attuned skills recharge faster.', [
      ['rechargeMultiplier', 'Water skill recharge', tooltipFactorChange]
    ]),
    [TRAIT.SOOTHING_ICE]: traitTooltip('Completing a healing skill grants Frost Aura and regeneration.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.PIERCING_SHARDS]: traitTooltip(
      'Your strikes deal increased damage against vulnerable targets, with a larger bonus while primarily attuned to Water.',
      [
        fromProfile(TRAIT.PIERCING_SHARDS, 'otherFactor', 'Strike damage', tooltipFactorChange),
        fromProfile(TRAIT.PIERCING_SHARDS, 'waterFactor', 'Strike damage in Water', tooltipFactorChange)
      ]
    ),
    [TRAIT.STOP_DROP_AND_ROLL]: outsideScopeTooltip,
    [TRAIT.SOOTHING_DISRUPTION]: outsideScopeTooltip,
    [TRAIT.CLEANSING_WAVE]: outsideScopeTooltip,
    [TRAIT.FLOW_LIKE_WATER]: traitTooltip(
      'Your strikes deal increased damage. The full-health condition applies throughout combat.',
      [fromProfile(TRAIT.FLOW_LIKE_WATER, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
    ),
    [TRAIT.CLEANSING_WATER]: outsideScopeTooltip,
    [TRAIT.POWERFUL_AURA]: outsideScopeTooltip,
    [TRAIT.SOOTHING_POWER]: traitTooltip('Gain vitality. Healing is outside combat simulation scope.', [
      ['attributeBonus', 'Vitality']
    ]),
    [TRAIT.STONE_FLESH]: outsideScopeTooltip,
    [TRAIT.EARTHEN_BLAST]: traitTooltip(
      'Entering Earth in combat, or beginning an Earth overload, triggers a strike that cannot critically strike.'
    ),
    [TRAIT.GEOMANCERS_TRAINING]: traitTooltip('Earth-attuned skills recharge faster.', [
      ['rechargeMultiplier', 'Earth skill recharge', tooltipFactorChange]
    ]),
    [TRAIT.EARTHS_EMBRACE]: traitTooltip('Completing a healing skill grants resistance.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.SERRATED_STONES]: traitTooltip(
      'Bleeding lasts longer. Your strikes deal increased damage against bleeding targets.',
      [
        ['durationMultiplier', 'Bleeding duration', percentagePoints],
        fromProfile(
          TRAIT.SERRATED_STONES,
          'damageMultiplier',
          'Strike damage against bleeding targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.ELEMENTAL_SHIELDING]: traitTooltip('Gaining an aura grants protection.'),
    [TRAIT.STRENGTH_OF_STONE]: traitTooltip(
      'Gain condition damage from toughness. Immobilizing the target inflicts bleeding.',
      [
        ['attributeConversion', 'Toughness converted to condition damage', tooltipPercent],
        ['internalCooldown', 'Bleeding cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.ROCK_SOLID]: traitTooltip('Entering Earth in combat grants stability.'),
    [TRAIT.EARTHEN_BLESSING]: outsideScopeTooltip,
    [TRAIT.DIAMOND_SKIN]: outsideScopeTooltip,
    [TRAIT.WRITTEN_IN_STONE]: traitTooltip(
      'Signet of Fire retains its passive while recharging. Completing Signet of Restoration, Fire, or Earth grants its corresponding aura.'
    ),
    [TRAIT.STONE_HEART]: outsideScopeTooltip,
    [TRAIT.EMPOWERING_FLAME]: traitTooltip('Gain power while primarily attuned to Fire.', [
      ['attributeBonus', 'Power in Fire']
    ]),
    [TRAIT.SUNSPOT]: traitTooltip(
      'Entering Fire in combat, or beginning a Fire overload, grants Fire Aura and triggers a strike that cannot critically strike.'
    ),
    [TRAIT.PYROMANCERS_TRAINING]: traitTooltip(
      'Fire-attuned skills recharge faster. Your strikes deal increased damage against burning targets.',
      [
        ['rechargeMultiplier', 'Fire skill recharge', tooltipFactorChange],
        fromProfile(
          TRAIT.PYROMANCERS_TRAINING,
          'damageMultiplier',
          'Strike damage against burning targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.BURNING_PRECISION]: traitTooltip(
      'Eligible critical hits have a chance to burn the target. Burning lasts longer.',
      [
        ['procChance', 'Chance on critical hit', tooltipPercent],
        ['internalCooldown', 'Internal cooldown', tooltipSeconds],
        ['durationMultiplier', 'Burning duration', percentagePoints]
      ]
    ),
    [TRAIT.CONJURER]: traitTooltip('Equipping a conjured weapon grants Fire Aura.'),
    [TRAIT.BURNING_FIRE]: outsideScopeTooltip,
    [TRAIT.BURNING_RAGE]: traitTooltip('Gain condition damage. Sunspot also burns the target.', [
      ['attributeBonus', 'Condition damage']
    ]),
    [TRAIT.SMOTHERING_AURAS]: traitTooltip('Auras last longer.', [
      ['durationMultiplier', 'Aura duration', tooltipFactorChange]
    ]),
    [TRAIT.POWER_OVERWHELMING]: traitTooltip(
      'Gain power while you have enough might. Fire attunement uses the larger bonus instead.',
      [
        ['minimumStacks', 'Might stacks required'],
        ['attributeBonus', 'Power outside Fire'],
        ['weaponAttributeBonus', 'Power in Fire']
      ]
    ),
    [TRAIT.PERSISTING_FLAMES]: traitTooltip(
      'Eligible fire-field hits grant temporary strike-damage stacks. Weapon fire fields last longer and repeat their final damage and condition packets.',
      [
        fromProfile(TRAIT.PERSISTING_FLAMES, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        ['maximumStacks', 'Maximum stacks', tooltipDecimal],
        ['durationMultiplier', 'Stack duration', tooltipSeconds],
        ['durationPerTier', 'Additional weapon field duration', tooltipSeconds],
        ['summons', 'Additional weapon field packets']
      ]
    ),
    [TRAIT.PYROMANCERS_PUISSANCE]: traitTooltip(
      'Using skills in Fire grants might. Leaving Fire or completing Overload Fire triggers Flame Expulsion: snapshot your capped might, scale its strike and burning, and grant that many might stacks to other allies.',
      [
        ['initialDelay', 'Flame Expulsion delay', tooltipSeconds],
        ['maximumStacks', 'Maximum might counted'],
        ['damageIncreasePerStack', 'Additional strike coefficient per might'],
        ['durationPerTier', 'Additional burning duration per might', tooltipSeconds]
      ],
      'listed Flame Expulsion damage is before might scaling'
    ),
    [TRAIT.INFERNO]: traitTooltip(
      'Burning scales with power instead of condition damage, retaining the shared burning base damage.',
      [
        // Display the Power conversion using combat's canonical Burning scaling.
        [
          'coefficientMultiplier',
          'Burning damage per second per power',
          (value) => tooltipDecimal(value * CONDITION_FORMULAS.Burning.scaling)
        ]
      ]
    ),
    [TRAIT.ARCANE_PROWESS]: traitTooltip('Changing attunement grants might.'),
    [TRAIT.ELEMENTAL_ATTUNEMENT]: traitTooltip(
      'Changing attunement grants the boon corresponding to the element entered.'
    ),
    [TRAIT.ELEMENTAL_ENCHANTMENT]: traitTooltip('Gain concentration. Attunement and overload recharges are reduced.', [
      ['attributeBonus', 'Concentration'],
      ['rechargeMultiplier', 'Recharge', tooltipFactorChange]
    ]),
    [TRAIT.ARCANE_PRECISION]: traitTooltip(
      'Eligible critical hits have a chance to apply the condition corresponding to your primary attunement.',
      [
        ['procChance', 'Chance on critical hit', tooltipPercent],
        ['internalCooldown', 'Internal cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.RENEWING_STAMINA]: traitTooltip('Eligible critical hits grant vigor.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.ARCANE_RESTORATION]: outsideScopeTooltip,
    [TRAIT.ARCANE_RESURRECTION]: outsideScopeTooltip,
    [TRAIT.ELEMENTAL_LOCKDOWN]: traitTooltip(
      'Control effects grant the boon corresponding to your primary attunement.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
    ),
    [TRAIT.FINAL_SHIELDING]: outsideScopeTooltip,
    [TRAIT.EVASIVE_ARCANA]: traitTooltip(
      "Completing a dodge triggers your primary attunement's effect: Fire strikes and burns, Earth strikes and applies conditions with a blast finisher, and Air blinds. Water healing and cleansing are outside combat scope.",
      [['cooldown', 'Cooldown per attunement', tooltipSeconds]]
    ),
    [TRAIT.ARCANE_LIGHTNING]: traitTooltip(
      'Completing an arcane skill grants temporary ferocity and its corresponding extra effect. Arcane Blast blinds the target.',
      [['attributeBonus', 'Ferocity during Arcane Lightning']]
    ),
    [TRAIT.BOUNTIFUL_POWER]: traitTooltip(
      'After enough attunement transitions, gain quickness and a temporary strike-damage bonus.',
      [
        ['threshold', 'Transitions required'],
        fromProfile(TRAIT.BOUNTIFUL_POWER, 'damageIncrease', 'Strike damage during bonus', tooltipPercent)
      ]
    ),
    [TRAIT.ZEPHYRS_SPEED]: traitTooltip('Gain personal critical-strike chance.', [
      ['criticalChance', 'Critical chance', tooltipPercent]
    ]),
    [TRAIT.ELECTRIC_DISCHARGE]: traitTooltip(
      'Entering Air in combat, or beginning an Air overload, strikes the target and inflicts vulnerability. Electric Discharge has increased critical damage.',
      [['criticalDamage', 'Electric Discharge critical damage', tooltipFactorChange]]
    ),
    [TRAIT.AEROMANCERS_TRAINING]: traitTooltip(
      'Gain ferocity and an additional equal ferocity bonus while primarily attuned to Air. Air-attuned skills recharge faster.',
      [
        ['attributeBonus', 'Ferocity per bonus'],
        ['rechargeMultiplier', 'Air skill recharge', tooltipFactorChange]
      ]
    ),
    [TRAIT.ZEPHYRS_BOON]: traitTooltip('Gaining an aura grants fury and swiftness.'),
    [TRAIT.ONE_WITH_AIR]: traitTooltip('Entering Air grants superspeed.'),
    [TRAIT.FEROCIOUS_WINDS]: traitTooltip('Gain ferocity from eligible precision.', [
      ['attributeConversion', 'Precision converted to ferocity', tooltipPercent]
    ]),
    [TRAIT.INSCRIPTION]: traitTooltip(
      'Completing a glyph grants the boon corresponding to your primary attunement. Entering Air separately grants resistance.'
    ),
    [TRAIT.RAGING_STORM]: traitTooltip('Eligible critical hits grant fury. Gain ferocity while fury is active.', [
      ['internalCooldown', 'Fury cooldown', tooltipSeconds],
      ['attributeBonus', 'Ferocity with fury']
    ]),
    [TRAIT.STORMSOUL]: traitTooltip('Your strikes deal increased damage.', [
      fromProfile(TRAIT.STORMSOUL, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.BOLT_TO_THE_HEART]: traitTooltip(
      'Your strikes deal increased damage against targets at or below half health.',
      [fromProfile(TRAIT.BOLT_TO_THE_HEART, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
    ),
    [TRAIT.FRESH_AIR]: traitTooltip(
      'Eligible critical hits while outside Air recharge Air attunement and Overload Air. Newly entering Air grants temporary ferocity.',
      [['attributeBonus', 'Ferocity during Fresh Air']]
    ),
    [TRAIT.LIGHTNING_ROD]: traitTooltip('Qualifying control effects trigger a strike and inflict weakness.'),
    [TRAIT.SINGULARITY]: traitTooltip(
      'Unlock Tempest, warhorn, shouts, and overloads. Holding an attunement forms its singularity, making its overload available.'
    ),
    [TRAIT.GATHERED_FOCUS]: traitTooltip('Gain concentration.', [['attributeBonus', 'Concentration']]),
    [TRAIT.HARDY_CONDUIT]: traitTooltip('Beginning an overload grants protection.'),
    [TRAIT.GALE_SONG]: traitTooltip('Completing a healing skill grants protection.'),
    [TRAIT.LATENT_STAMINA]: traitTooltip('Entering Water grants vigor.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.UNSTABLE_CONDUIT]: traitTooltip('Completing an overload grants the aura corresponding to its attunement.'),
    [TRAIT.TEMPESTUOUS_ARIA]: traitTooltip(
      'Completing a shout grants might to the party. Gaining an aura starts or extends a temporary strike- and condition-damage bonus.',
      [
        fromProfile(TRAIT.TEMPESTUOUS_ARIA, 'damageIncrease', 'Strike damage during bonus', tooltipPercent),
        fromProfile(TRAIT.TEMPESTUOUS_ARIA, 'conditionDamageIncrease', 'Condition damage during bonus', tooltipPercent),
        ['durationMultiplier', 'Bonus duration added per aura', tooltipSeconds],
        ['maximumStacks', 'Maximum remaining bonus duration', tooltipSeconds]
      ],
      'shout might to party'
    ),
    [TRAIT.HARMONIOUS_CONDUIT]: traitTooltip('Beginning an overload grants swiftness and stability.'),
    [TRAIT.INVIGORATING_TORRENTS]: traitTooltip('Gaining an aura grants vigor and regeneration.'),
    [TRAIT.TRANSCENDENT_TEMPEST]: traitTooltip(
      'Singularities form sooner. Completing an overload grants a temporary strike- and condition-damage bonus.',
      [
        fromProfile(TEMPEST.overloads, 'durationMultiplier', 'Base attunement dwell', tooltipSeconds),
        fromProfile(TRAIT.TRANSCENDENT_TEMPEST, 'damageIncrease', 'Strike damage', tooltipPercent),
        fromProfile(TRAIT.TRANSCENDENT_TEMPEST, 'conditionDamageIncrease', 'Condition damage', tooltipPercent)
      ]
    ),
    [TRAIT.LUCID_SINGULARITY]: traitTooltip(
      'The first eligible overload hits grant alacrity to yourself. The last emitted hit within the limit uses the longer application, including when interrupted.',
      [['maximumStacks', 'Maximum alacrity applications']]
    ),
    [TRAIT.ELEMENTAL_BASTION]: traitTooltip(
      'Gaining an aura grants alacrity. Healing is outside combat simulation scope.'
    ),
    [TRAIT.WEAVER]: traitTooltip(
      'Unlock Weaver, sword, stances, and dual attunements. Weapon skills depend on your primary and secondary elements.'
    ),
    [TRAIT.ELEMENTAL_REFRESHMENT]: traitTooltip('Gain vitality. Barrier does not change outgoing combat results.', [
      ['attributeBonus', 'Vitality']
    ]),
    [TRAIT.ELEMENTAL_POLYPHONY]: traitTooltip(
      'Gain attributes from each distinct active attunement: Fire grants power, Water healing power, Air ferocity, and Earth condition damage. Matching elements apply once.',
      [['attributeBonus', 'Bonus per corresponding attribute']]
    ),
    [TRAIT.SUPERIOR_ELEMENTS]: traitTooltip(
      'Completing an eligible dual attack inflicts weakness. Gain personal critical-strike chance against weakened targets.',
      [
        ['internalCooldown', 'Weakness cooldown', tooltipSeconds],
        ['criticalChance', 'Critical chance against weakened targets', tooltipPercent]
      ]
    ),
    [TRAIT.ELEMENTAL_PURSUIT]: traitTooltip('Player control effects grant swiftness.'),
    [TRAIT.WEAVERS_PROWESS]: traitTooltip('Fully attuning to an element grants resistance.'),
    [TRAIT.MASTERS_FORTITUDE]: outsideScopeTooltip,
    [TRAIT.SWIFT_REVENGE]: traitTooltip(
      'Completing a dual attack grants benefits for its elements: Fire grants might, Air swiftness, and Earth endurance.',
      [['resourceGain', 'Endurance from Earth']]
    ),
    [TRAIT.BOLSTERED_ELEMENTS]: traitTooltip('Completing a stance grants protection.'),
    [TRAIT.ELEMENTS_OF_RAGE]: traitTooltip(
      'Fully attuning to an element grants a temporary strike- and condition-damage bonus.',
      [
        ['durationMultiplier', 'Bonus duration', tooltipSeconds],
        fromProfile(TRAIT.ELEMENTS_OF_RAGE, 'damageIncrease', 'Strike damage', tooltipPercent),
        fromProfile(TRAIT.ELEMENTS_OF_RAGE, 'conditionDamageIncrease', 'Condition damage', tooltipPercent)
      ]
    ),
    [TRAIT.WOVEN_STRIDE]: outsideScopeTooltip,
    [TRAIT.FLOW_STATE]: traitTooltip("Reduce Weaver's attunement recharge and dual-attack recharge.", [
      ['rechargeReduction', 'Attunement recharge removed', tooltipSeconds],
      ['rechargeMultiplier', 'Dual-attack recharge', tooltipFactorChange]
    ]),
    [TRAIT.DEPTH_OF_ELEMENTS]: traitTooltip(
      'Unlock Catalyst, hammer, augments, energy, and Jade Sphere. Damage builds energy while the sphere is inactive.'
    ),
    [TRAIT.ELEMENTAL_EMPOWERMENT]: traitTooltip(
      'Elemental Empowerment grants temporary increases to eligible power, precision, ferocity, condition damage, expertise, and concentration.',
      [
        ['attributePerStack', 'Attribute increase per stack', tooltipPercent],
        ['maximumStacks', 'Maximum stacks'],
        ['playerStacks', 'Initial stacks'],
        ['durationMultiplier', 'Initial stack duration', tooltipSeconds]
      ]
    ),
    [TRAIT.ELEMENTAL_EPITOME]: traitTooltip(
      'Combos grant the aura corresponding to your primary attunement, with separate cooldowns for each element. Gaining an aura in combat grants Elemental Empowerment.',
      [['internalCooldown', 'Combo aura cooldown per attunement', tooltipSeconds]]
    ),
    [TRAIT.HARDENED_AURAS]: outsideScopeTooltip,
    [TRAIT.VICIOUS_EMPOWERMENT]: traitTooltip(
      'Control or immobilize effects in combat grant Elemental Empowerment and might.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
    ),
    [TRAIT.ENERGIZED_ELEMENTS]: traitTooltip('Changing attunement grants energy and fury.', [
      ['resourceGain', 'Energy gained']
    ]),
    [TRAIT.EMPOWERING_AURAS]: traitTooltip(
      'Gaining an aura adds a damage-bonus stack and refreshes all active stacks.',
      [
        // Damage facts read the same trait balance fields as combat modifiers.
        ['damageIncreasePerStack', 'Strike damage per stack', tooltipPercent],
        ['conditionDamageIncreasePerStack', 'Condition damage per stack', tooltipPercent],
        ['maximumStacks', 'Maximum stacks'],
        ['durationMultiplier', 'Stack duration', tooltipSeconds]
      ]
    ),
    [TRAIT.EVASIVE_EMPOWERMENT]: outsideScopeTooltip,
    [TRAIT.SPECTACULAR_SPHERE]: traitTooltip(
      "Deploying Jade Sphere grants quickness and the additional boon corresponding to the sphere's element."
    ),
    [TRAIT.ELEMENTAL_SYNERGY]: traitTooltip(
      'Combos grant an effect for your primary attunement: might in Fire, stability in Earth, or endurance in Air.',
      [
        ['internalCooldown', 'Cooldown per attunement', tooltipSeconds],
        ['resourceGain', 'Endurance in Air']
      ]
    ),
    [TRAIT.EMPOWERED_EMPOWERMENT]: traitTooltip(
      "Improve Elemental Empowerment's attribute scaling. At maximum stacks, use the full-set bonus instead of the per-stack rate.",
      [
        fromProfile(
          TRAIT.ELEMENTAL_EMPOWERMENT,
          'coefficientMultiplier',
          'Attribute increase per stack below maximum',
          tooltipPercent
        ),
        fromProfile(
          TRAIT.ELEMENTAL_EMPOWERMENT,
          'attributeConversion',
          'Attribute increase at maximum stacks',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.SPHERE_SPECIALIST]: traitTooltip("Spectacular Sphere's boons last longer.", [
      ['durationMultiplier', 'Boon duration', tooltipFactorChange]
    ]),
    [TRAIT.EVOCATION]: traitTooltip(
      'Unlock Evoker, familiars, meditations, and familiar charges. Choose a familiar element; with Fire selected, burning applications grant might.',
      [
        // Entry traits share Evocation's cooldown policy, separate from fire-familiar might.
        [
          'internalCooldown',
          "Attunement-entry trait cooldown (Sunspot, Pyromancer's Puissance, Earthen Blast, Rock Solid)",
          tooltipSeconds
        ],
        fromProfile(EVOKER.ignite, 'pulseInterval', 'Fire-familiar might cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.ENHANCED_POTENCY]: traitTooltip(
      'With Air selected, fury grants ferocity and additional critical chance. With Fire selected, might grants additional condition damage.',
      [
        ['attributeBonus', 'Air ferocity with fury'],
        ['criticalChance', 'Air additional critical chance with fury', tooltipPercent],
        ['attributePerStack', 'Fire condition damage per might']
      ]
    ),
    [TRAIT.FAMILIARS_PROWESS]: traitTooltip(
      'Completing a familiar skill starts or extends a damage-bonus window. Air selection increases strike damage; Fire selection increases condition damage.',
      [
        ['damageIncrease', 'Air strike damage', tooltipPercent],
        ['conditionDamageIncrease', 'Fire condition damage', tooltipPercent],
        ['durationMultiplier', 'Initial duration', tooltipSeconds],
        ['durationPerTier', 'Duration added while active', tooltipSeconds],
        ['maximumStacks', 'Maximum remaining duration', tooltipSeconds]
      ]
    ),
    [TRAIT.FIERY_MIGHT]: traitTooltip('Deal increased strike damage against burning targets.', [
      fromProfile(TRAIT.FIERY_MIGHT, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.ALTRUISTIC_ASPECT]: traitTooltip('Completing an eligible meditation grants its corresponding boon.'),
    [TRAIT.SPIRITS_SUCCOR]: outsideScopeTooltip,
    [TRAIT.FAMILIARS_FOCUS]: traitTooltip(
      "Improve Familiar's Prowess, using the stronger bonus for the selected element.",
      [
        ['damageIncrease', 'Air strike damage', tooltipPercent],
        ['conditionDamageIncrease', 'Fire condition damage', tooltipPercent]
      ]
    ),
    [TRAIT.FAMILIARS_BLESSING]: (balanceContext) => ({
      description:
        'Completing a Fire or Air familiar grants quickness. Water or Earth familiars grant alacrity instead.',
      facts: familiarBlessingEffects(balanceContext).flatMap(
        ({ elements, effect }) => simulationEffectFacts([effect], `${elements.join(' / ')} familiar`).facts
      )
    }),
    [TRAIT.ELEMENTAL_DYNAMO]: traitTooltip('Entering your selected familiar element grants familiar charges.', [
      ['resourceGain', 'Charges gained']
    ]),
    [TRAIT.GALVANIC_ENCHANTMENT]: traitTooltip(
      'Completing a familiar grants Electric Enchantment charges. Your next qualifying player strikes consume charges to trigger an additional strike and burning.',
      [
        ['playerStacks', 'Charges granted'],
        ['durationMultiplier', 'Charge duration', tooltipSeconds]
      ],
      'per charge consumed'
    ),
    [TRAIT.ELEMENTAL_BALANCE]: traitTooltip(
      'Entering your selected familiar element enough times opens a brief window. The next non-autoattack weapon skill in that window has reduced recharge.',
      [
        ['threshold', 'Entries required'],
        ['durationMultiplier', 'Skill-use window', tooltipSeconds],
        ['rechargeMultiplier', 'Next eligible skill recharge', tooltipFactorChange]
      ]
    ),
    [TRAIT.SPECIALIZED_ELEMENTS]: traitTooltip(
      'Lock attunement to the selected familiar element and generate more charges from matching eligible weapon skills. Familiar casts reduce active weapon cooldowns; empowered familiars also trigger elemental entry traits.',
      [
        ['maximumStacks', 'Maximum familiar charges'],
        ['playerStacks', 'Charges per matching weapon skill'],
        fromProfile(
          TRAIT.SPECIALIZED_ELEMENTS,
          'rechargeMultiplier',
          'Base weapon recharge removed by basic familiar',
          (value) => tooltipPercent(1 - value)
        ),
        fromProfile(
          TRAIT.SPECIALIZED_ELEMENTS,
          'empoweredRechargeMultiplier',
          'Base weapon recharge removed by empowered familiar',
          (value) => tooltipPercent(1 - value)
        )
      ]
    )
  }
};
