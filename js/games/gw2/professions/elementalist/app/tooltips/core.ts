import { WEAPON, ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import {
  fromProfile,
  modifierFact,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipProfile,
  tooltipSeconds,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
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
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistWaterTooltips } from '#gw2/professions/elementalist/app/tooltips/water.js';
import { elementalistEarthTooltips } from '#gw2/professions/elementalist/app/tooltips/earth.js';
import { elementalistFireTooltips } from '#gw2/professions/elementalist/app/tooltips/fire.js';
import { elementalistArcaneTooltips } from '#gw2/professions/elementalist/app/tooltips/arcane.js';
import { elementalistAirTooltips } from '#gw2/professions/elementalist/app/tooltips/air.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Describes the same selected aura declaration that the cast hook grants. */
function auraGrantFacts({ aura }: ElementalistSkill) {
  return aura
    ? simulationEffectFacts([{ type: 'buff', kind: aura.kind, duration: tooltipNumber(aura, 'duration') }]).facts
    : [];
}

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const elementalistCoreTooltips = {
  skillFacts: (balanceContext, entity) => [
    ...(entity.resourceGain == null
      ? []
      : [{ name: 'Endurance gained', detail: tooltipDecimal(tooltipNumber(entity, 'resourceGain')) }]),
    ...auraGrantFacts(entity),
    // Orb and conjure bonuses belong to their equipped state, including when created by a dual attack or pickup.
    ...(HAMMER_ORB_SKILLS[Number(entity.id)] === 'Fire' ||
    (String(entity.skillWeapon || entity.weapon) === WEAPON.HAMMER &&
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
    (String(entity.skillWeapon || entity.weapon) === WEAPON.HAMMER &&
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
  skills: {
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
      Object.keys(HAMMER_ORB_SKILLS).map((id) => [
        id,
        skillTooltip(
          "Create this attunement's hammer orb and refresh all active orb durations. Grand Finale consumes the active orbs and replaces their pending attacks with elemental projectiles.",
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
            actorType: ACTOR.SUMMON
          },
          { type: 'strike', coefficient: FIRE_ELEMENTAL.flameBarrage.explosionCoefficient, actorType: ACTOR.SUMMON },
          {
            type: 'condition',
            condition: CONDITION.BURNING,
            stacks: FIRE_ELEMENTAL.flameBarrage.burningStacks,
            duration: FIRE_ELEMENTAL.flameBarrage.burningDuration,
            applications: FIRE_ELEMENTAL.flameBarrage.projectileImpacts.length,
            actorType: ACTOR.PLAYER
          }
        ]).facts
    ),
    [ID.STOMP_ELEMENTAL_COMMAND]: skillTooltip(
      'Command the active Earth Elemental to stop its autonomous attack and stomp. It strikes, cripples and immobilizes the target, and grants party protection.',
      () =>
        simulationEffectFacts([
          { type: 'strike', flatDamage: EARTH_ELEMENTAL.stomp.baseDamage, actorType: ACTOR.SUMMON },
          {
            type: 'condition',
            condition: CONDITION.CRIPPLED,
            duration: EARTH_ELEMENTAL.stomp.crippleDuration,
            actorType: ACTOR.PLAYER
          },
          {
            type: 'condition',
            condition: CONDITION.IMMOBILIZED,
            duration: EARTH_ELEMENTAL.stomp.immobilizeDuration,
            actorType: ACTOR.PLAYER
          },
          {
            type: 'boon',
            boon: BOON.PROTECTION,
            duration: EARTH_ELEMENTAL.stomp.protectionDuration,
            actorType: ACTOR.PLAYER,
            audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
          }
        ]).facts
    )
  },
  traits: {
    ...elementalistWaterTooltips,
    ...elementalistEarthTooltips,
    ...elementalistFireTooltips,
    ...elementalistArcaneTooltips,
    ...elementalistAirTooltips
  }
} satisfies ProfessionTooltips;
