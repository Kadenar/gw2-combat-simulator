/** Describe orb bonuses from the selected creation declaration so patches and dual attacks agree with runtime. */
import {
  fromSkill,
  modifierFact,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipSeconds,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { skillActionEffects } from '#gw2/platform/effects/actions.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { elementalistAirTooltips } from '#gw2/professions/elementalist/app/tooltips/air.js';
import { elementalistArcaneTooltips } from '#gw2/professions/elementalist/app/tooltips/arcane.js';
import { elementalistEarthTooltips } from '#gw2/professions/elementalist/app/tooltips/earth.js';
import { elementalistFireTooltips } from '#gw2/professions/elementalist/app/tooltips/fire.js';
import { elementalistWaterTooltips } from '#gw2/professions/elementalist/app/tooltips/water.js';
import { ARCANE_ECHO_REPLACEMENT_RECHARGE_SECONDS } from '#gw2/professions/elementalist/core/mechanics/arcane-echo.js';
import { conjureSkill } from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE as EARTH_ELEMENTAL,
  FIRE_ELEMENTAL_EVTC_PROFILE as FIRE_ELEMENTAL
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import { hammerOrbElements } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { ELEMENTALIST_ETCHING_CHARGES, etchingRoot } from '#gw2/professions/elementalist/core/mechanics/spear.js';
import { ELEMENTALIST_CORE_SKILLS } from '#gw2/professions/elementalist/core/skills/index.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Explain the relationship declared by the selected skill, including patched bundle names and etching stages. */
const mechanicSkillTooltip: DescribeSimulationTooltip<ElementalistSkill, ElementalistSkill> = (context, skill) => {
  if (skill.conjureWeapon)
    return skillTooltip(
      `Conjure and equip ${skill.conjureWeapon}, replacing your weapon bar. Leave a second weapon available for a later pickup. Dropping the bundle restores your normal skills.`,
      [fromSkill(skill.id, 'duration', 'Ground pickup lifetime', tooltipSeconds)]
    )(context, skill);

  if (skill.type === 'Action' && skill.conjureSourceId != null)
    return skillTooltip(
      `Pick up the available ${conjureSkill(context.catalog, skill)!.conjureWeapon} and replace your weapon bar with its skills.`
    )(context, skill);

  if (skill.transmuteAura)
    return skillTooltip(
      `Consume an active ${skill.transmuteAura} and apply the transmutation effects. Triggers applicable aura-transmutation traits.`
    )(context, skill);

  if (skill.etchingReleases)
    return skillTooltip(
      'Create an etching and unlock its lesser release while the field lasts. Completing other actions, including attunement swaps, upgrades it to the full release. Releasing either version consumes the etching.',
      // The mechanic owns this fixed requirement; it is not selected balance tuning.
      () => [{ name: 'Completed actions to fully charge', detail: String(ELEMENTALIST_ETCHING_CHARGES) }]
    )(context, skill);

  return skillTooltip(
    skill.id === etchingRoot(context.catalog, skill)!.etchingReleases!.lesser
      ? 'Release the partially charged etching and consume it. This release is available only while that etching remains active.'
      : 'Release the fully charged etching and consume it. This release is available only after the required charging actions.'
  )(context, skill);
};

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const elementalistCoreTooltips = {
  skillFacts: (balanceContext, entity) => {
    const conjure = entity.type === 'Weapon' ? undefined : conjureSkill(balanceContext.catalog, entity);
    const orbs = hammerOrbElements(entity);

    return [
      ...(orbs ? [skillFact(balanceContext, entity.id, 'orbDuration', 'Refreshed orb duration', tooltipSeconds)] : []),
      ...(entity.resourceGain == null
        ? []
        : [{ name: 'Endurance gained', detail: tooltipDecimal(tooltipNumber(entity, 'resourceGain')) }]),
      // Orb and conjure bonuses belong to their equipped state, including when created by a dual attack or pickup.
      ...(orbs?.includes('Fire')
        ? [
            modifierFact(
              balanceContext,
              'elementalist.hammer-fire-orb-strike',
              'amount',
              'Strike damage while Fire orb is active'
            ),
            modifierFact(
              balanceContext,
              'elementalist.hammer-fire-orb-condition',
              'amount',
              'Condition damage while Fire orb is active'
            )
          ]
        : []),
      ...(orbs?.includes('Air')
        ? [
            modifierFact(
              balanceContext,
              'elementalist.hammer-air-orb',
              'amount',
              'Critical chance while Air orb is active'
            )
          ]
        : []),
      ...(conjure?.conjureWeapon === 'Fiery Greatsword'
        ? [
            skillFact(balanceContext, conjure.id, 'attributeBonuses.power', 'Power while wielded'),
            skillFact(balanceContext, conjure.id, 'attributeBonuses.conditionDamage', 'Condition damage while wielded')
          ]
        : []),
      ...(conjure?.conjureWeapon === 'Lightning Hammer'
        ? [
            skillFact(balanceContext, conjure.id, 'attributeBonuses.precision', 'Precision while wielded'),
            skillFact(balanceContext, conjure.id, 'attributeBonuses.ferocity', 'Ferocity while wielded')
          ]
        : []),
      ...(conjure?.conjureWeapon === 'Frost Bow'
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
    ];
  },
  skills: {
    // Equipment selects the glyph; the accepted cast owns its elemental payload and recharge.
    [ID.GLYPH_OF_STORMS]: skillTooltip(
      'Create the storm for your primary attunement when the cast begins. Its elemental effects remain fixed for that activation, and all elements share the resulting recharge.'
    ),
    [ID.GLYPH_OF_ELEMENTAL_POWER]: skillTooltip(
      'Cast the Glyph of Elemental Power variant for your primary attunement. Changing attunement changes the next available variant, while all variants share recharge.'
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
      [ID.FLAME_WHEEL, ID.ICY_COIL, ID.CRESCENT_WIND, ID.ROCKY_LOOP].map((id) => [
        id,
        skillTooltip(
          "Create this attunement's hammer orb and refresh all active orb durations. Grand Finale consumes the active orbs and replaces their pending attacks with elemental projectiles."
        )
      ])
    ),
    // Authored relationships select descriptions; the callback reads the selected catalog's metadata and tuning.
    ...Object.fromEntries(
      ELEMENTALIST_CORE_SKILLS.filter(
        (skill) =>
          skill.conjureWeapon ||
          (skill.type === 'Action' && skill.conjureSourceId != null) ||
          skill.transmuteAura ||
          skill.etchingReleases ||
          skill.etchingRootId != null
      ).map((skill) => [skill.id, mechanicSkillTooltip])
    ),
    [SHARED_SKILL_IDS.DODGE]: skillTooltip(
      'Spend endurance to dodge and trigger Evasive Arcana when selected. Incoming attacks are outside combat simulation scope.',
      () => [{ name: 'Endurance spent', detail: String(ENDURANCE.dodgeCost) }]
    ),
    [ID.DROP_BUNDLE]: skillTooltip('Drop the conjured weapon and restore your normal weapon skills.'),
    [ID.ROCK_BARRIER]: skillTooltip(
      'Arm Hurl for the barrier window. Rock Barrier begins recharging when Hurl consumes it or the window expires.',
      [fromSkill(ID.ROCK_BARRIER, 'flipDuration', 'Hurl window', tooltipSeconds)]
    ),
    [ID.HURL]: skillTooltip(
      "Release the stored Rock Barrier as projectiles, consume the follow-up, and begin Rock Barrier's recharge."
    ),
    [ID.SIGNET_OF_FIRE]: skillTooltip(
      'Passively gain precision while the signet is ready. Activate to burn your target; the passive is disabled during recharge unless Written in Stone is selected.',
      [fromSkill(ID.SIGNET_OF_FIRE, 'attributeBonuses.precision', 'Passive precision')]
    ),
    [ID.ARCANE_ECHO]: skillTooltip(
      `Arm a window for the next completed weapon skill with a recharge. If its cast begins within the window, reduce its recharge to ${ARCANE_ECHO_REPLACEMENT_RECHARGE_SECONDS} second and add its original recharge to Arcane Echo's base 15-second recharge, before Alacrity. Autoattacks and follow-up skills do not consume the effect; ammunition charges are not replenished.`,
      [fromSkill(ID.ARCANE_ECHO, 'duration', 'Window', tooltipSeconds)]
    ),
    [ID.RIDE_THE_LIGHTNING]: skillTooltip(
      "Strike your target. The simulator applies this skill's hit recharge reduction.",
      [fromSkill(ID.RIDE_THE_LIGHTNING, 'rechargeMultiplier', 'Recharge on hit', tooltipFactorChange)]
    ),
    [ID.FULGOR]: skillTooltip(
      "Strike and create an additional repeating damage sequence that cannot critically strike. Recasting replaces the previous sequence's remaining pulses.",
      (_balanceContext, skill) =>
        simulationEffectFacts(
          skillActionEffects(skill).flatMap((effect) =>
            effect.type === 'strike'
              ? (effect.ticks || []).map((tick) => ({ ...tick, type: 'strike' as const, canCrit: false }))
              : []
          ),
          'additional pulses'
        ).facts
    ),
    [ID.SEETHE]: skillTooltip("Empower the next non-autoattack spear skill's strike damage.", [
      fromSkill(ID.SEETHE, 'nextSkillDamageMultiplier', "Next eligible skill's strike damage", tooltipFactorChange)
    ]),
    [ID.RIPPLE]: skillTooltip('Reduce the recharge of the next eligible non-autoattack spear skill.', [
      fromSkill(ID.RIPPLE, 'nextSkillRechargeMultiplier', "Next eligible skill's recharge", tooltipFactorChange)
    ]),
    [ID.ENERGIZE]: skillTooltip("Make the next non-autoattack spear skill's strikes critically hit."),
    [ID.HARDEN]: skillTooltip('Add a control effect to the first strike of the next non-autoattack spear skill.'),
    [ID.ELEMENTAL_EXPLOSION]: skillTooltip(
      'Consume all stocked elemental bullets and apply the explosion effects. Gain the aura matching your primary attunement.',
      (_balanceContext, skill) =>
        simulationEffectFacts(skillActionEffects(skill), 'primary attunement alternative').facts
    ),
    [ID.RAGING_RICOCHET]: skillTooltip(
      'Strike and apply conditions. Stock a Fire bullet if none is loaded; otherwise consume it to gain might.',
      // Show the selected action's reward without presenting it as an unconditional cast effect.
      (_balanceContext, skill) =>
        simulationEffectFacts(skillActionEffects(skill).map((effect) => ({ ...effect, name: 'Fire bullet' }))).facts
    ),
    [ID.SEARING_SALVO]: skillTooltip(
      'Strike and apply conditions. Stock a Fire bullet if none is loaded; otherwise consume it to gain Fire Aura.',
      (_balanceContext, skill) =>
        simulationEffectFacts(skillActionEffects(skill).map((effect) => ({ ...effect, name: 'Fire bullet' }))).facts
    ),
    [ID.FROZEN_FUSILLADE]: skillTooltip(
      'Create the damaging field. Stock a Water bullet if none is loaded; otherwise consume it to add a delayed detonation and bleeding.',
      (balanceContext, skill) => [
        skillFact(balanceContext, ID.FROZEN_FUSILLADE, 'detonationDelay', 'Enhanced detonation delay', tooltipSeconds),
        ...simulationEffectFacts(skillActionEffects(skill), 'delayed detonation').facts
      ]
    ),
    [ID.FRIGID_FLURRY]: skillTooltip(
      "Fire repeated projectiles. Stock a Water bullet if none is loaded; otherwise consume it. The bullet's healing enhancement is outside combat simulation scope. Each shot can act as a projectile finisher."
    ),
    [ID.DAZING_DISCHARGE]: skillTooltip(
      "Strike and daze your target. Stock an Air bullet if none is loaded; otherwise consume it to shorten the next eligible pistol skill's recharge.",
      [
        fromSkill(ID.DAZING_DISCHARGE, 'duration', 'Recharge bonus window', tooltipSeconds),
        fromSkill(
          ID.DAZING_DISCHARGE,
          'nextSkillRechargeMultiplier',
          'Next eligible pistol recharge',
          tooltipFactorChange
        )
      ]
    ),
    [ID.SHATTERING_STONE]: skillTooltip(
      'Strike and apply conditions. Stock an Earth bullet if none is loaded; otherwise consume it to arm bleeding on your next qualifying hits.',
      (balanceContext, skill) => [
        skillFact(balanceContext, ID.SHATTERING_STONE, 'maximumStacks', 'Enhanced bleeding charges'),
        skillFact(balanceContext, ID.SHATTERING_STONE, 'duration', 'Charge window', tooltipSeconds),
        ...simulationEffectFacts(
          skillActionEffects(skill).map((effect) => ({ ...effect, name: 'Earth bullet charge' }))
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
        fromSkill(ID.GLYPH_OF_ELEMENTALS, 'duration', 'Elemental lifetime', tooltipSeconds),
        fromSkill(ID.GLYPH_OF_ELEMENTALS, 'rechargeAfterExpiry', 'Recharge after expiry', tooltipSeconds)
      ]
    ),
    [ID.GLYPH_OF_ELEMENTALS_EARTH]: skillTooltip(
      'Summon an Earth Elemental with its own attributes and autonomous Punch and Enervating Punch attacks. Stomp commands it to interrupt its current attack. The glyph recharges after the elemental expires.',
      [
        fromSkill(ID.GLYPH_OF_ELEMENTALS_EARTH, 'duration', 'Elemental lifetime', tooltipSeconds),
        fromSkill(ID.GLYPH_OF_ELEMENTALS_EARTH, 'rechargeAfterExpiry', 'Recharge after expiry', tooltipSeconds)
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
} satisfies ProfessionTooltips<ElementalistSkill>;
