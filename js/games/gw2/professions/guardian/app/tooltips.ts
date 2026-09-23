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
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { MANTRAS } from '#gw2/professions/guardian/data/mantra-definitions.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/guardian/core/profiles.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as DRAGONHUNTER } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as FIREBRAND } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as WILLBENDER } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import { LUMINARY_BALANCE_PROFILE_IDS as LUMINARY } from '#gw2/professions/guardian/specializations/luminary/profiles.js';

/** Label profile alternatives by their actual trigger rather than presenting them as simultaneous payloads. */
function virtueBoons(description: string): DescribeSimulationTooltip {
  return (context, entity) => ({
    description,
    facts: (tooltipProfile(context, entity.id).effects || []).flatMap(
      (effect, index) => simulationEffectFacts([effect], ['Justice', 'Resolve', 'Courage'][index]).facts
    )
  });
}

/** Local descriptions follow implemented Guardian mechanics; scalar facts read the selected balance definitions. */
export const guardianTooltips: ProfessionTooltips = {
  skillFacts: (_c, entity) =>
    entity.pageCost == null
      ? []
      : [{ name: 'Tome pages spent', detail: tooltipDecimal(tooltipNumber(entity, 'pageCost')) }],
  handlers: {
    'guardian.virtue': skillTooltip(
      "Activate this virtue and trigger its applicable trait effects. Its passive follows the virtue's recharge state; specialization-specific replacements change the active effect."
    ),
    'guardian.renewed-focus': skillTooltip(
      'Complete the channel to refresh virtue recharges, restore virtue ammunition, and ready virtue passives. Invulnerability is outside combat simulation scope.'
    ),
    'guardian.dragonhunter-justice': skillTooltip(
      "Strike and tether your target, applying recurring Burning while the tether remains active. Hunter's Verdict ends the tether early; Big Game Hunter extends it.",
      (balanceContext) => [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, DRAGONHUNTER.tether).effects?.filter(
            (effect) => effect.packetLabel !== 'passive'
          ),
          'per tether pulse'
        ).facts
      ]
    ),
    'guardian.hunters-verdict': skillTooltip(
      'Break the active Spear of Justice tether and pull your target. Ending the tether cancels its remaining pulses.'
    ),
    'guardian.dragonhunter-virtue': skillTooltip(
      'Activate Wings of Resolve and its virtue traits. Soaring Devastation adds its strike and immobilize. Healing is outside combat simulation scope.'
    ),
    'guardian.stow-tome': skillTooltip(
      'Close the active tome and restore your weapon skills. This ends the current consecutive-page sequence for Swift Scholar.'
    ),
    'guardian.tome-page': skillTooltip(
      'Use a page from the matching open tome and apply these effects. Pages are shared across tomes and regenerate after spending begins. Applicable tome traits can add boons or refund pages; the tome stays open until stowed.'
    ),
    'guardian.willbender-virtue': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id);
      if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
      const index = entity.id === ID.RUSHING_JUSTICE ? 0 : entity.id === ID.FLOWING_RESOLVE ? 1 : 2;
      return {
        description:
          "Activate this virtue's temporary hit-trigger window and lay Willbender Flames. Trails from the same virtue can overlap; switching virtues cancels the previous trails. Eligible hits advance virtue triggers; partial progress persists between active windows. Justice triggers Burning; Courage triggers defensive boons. Resolve healing is outside combat simulation scope, but its trait effects still apply.",
        facts: [
          ...simulationEffectFacts(selected.effects).facts,
          ...simulationEffectFacts(
            tooltipProfile(balanceContext, WILLBENDER.virtueWindows).effects?.slice(index, index + 1),
            'base active window'
          ).facts,
          ...simulationEffectFacts(tooltipProfile(balanceContext, WILLBENDER.flames).effects, 'full flame trail').facts,
          profileFact(balanceContext, WILLBENDER.virtueWindows, 'threshold', 'Base eligible hits per trigger'),
          ...(index === 2
            ? simulationEffectFacts(
                tooltipProfile(balanceContext, WILLBENDER.courageTrigger).effects,
                'per Courage trigger'
              ).facts
            : [])
        ]
      };
    },
    'guardian.radiant-forge': (balanceContext, entity) =>
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
          },
    'guardian.radiant-weapon': (balanceContext, entity) =>
      skillTooltip(
        entity.flipParentId == null
          ? "Equip this radiant weapon and apply its effects. Its follow-up replaces the prior radiant weapon's follow-up, and Glaring Burst changes to match the equipped weapon. Triggers eligible weapon-equip effects."
          : "Use the equipped radiant weapon's follow-up and apply its listed effects."
      )(balanceContext, entity),
    'guardian.glaring-burst': (balanceContext) => ({
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
    }),
    'guardian.weapon-swap': skillTooltip('Swap to your other weapon set and trigger applicable weapon-swap effects.')
  },
  skills: {
    ...Object.fromEntries(
      [
        [ID.TOME_OF_JUSTICE, FIREBRAND.tomeJustice],
        [ID.TOME_OF_RESOLVE, FIREBRAND.tomeResolve],
        [ID.TOME_OF_COURAGE, FIREBRAND.tomeCourage],
        [ID.TOME_OF_COURAGE_ID_42371, FIREBRAND.tomeCourage]
      ].map(([id, profile]) => [
        id,
        skillTooltip(
          'Open this tome and replace your weapon bar with its pages. Opening a ready tome starts passive dormancy and grants Swift Scholar quickness. Reopening a dormant tome preserves that timer. Switching tomes resets the consecutive-page refund sequence.',
          (balanceContext) => [
            profileFact(balanceContext, profile, 'cooldown', 'Base passive dormancy', tooltipSeconds),
            profileFact(balanceContext, FIREBRAND.resources, 'maximumStacks', 'Base shared page capacity'),
            profileFact(
              balanceContext,
              FIREBRAND.resources,
              'pulseInterval',
              'Base page regeneration interval',
              tooltipSeconds
            ),
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, FIREBRAND.swiftScholar).effects,
              'when the passive was ready'
            ).facts
          ]
        )
      ])
    ),
    [ID.HELIO_RUSH]: skillTooltip(
      'Rush through your target and strike. An Illuminated charge or an active Symbol of Luminance empowers the impact. The attack then arms a new Illuminated charge for another eligible spear attack.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          CORE.spearHelioRush,
          'damageMultiplier',
          'Strike damage while Illuminated',
          tooltipFactorChange
        )
      ]
    ),
    [ID.GLEAMING_DISC]: skillTooltip(
      'Strike with a disc and its shockwave. Illumination increases the shockwave damage by the listed share of the base total coefficient. The attack then arms a new Illuminated charge for another eligible spear attack.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          CORE.spearGleamingDisc,
          'damageMultiplier',
          'Additional share of base total coefficient while Illuminated',
          tooltipFactorChange
        )
      ]
    ),
    [ID.SOLAR_STORM]: skillTooltip(
      'Strike with a volley of projectiles. Illumination adds the extra projectiles listed separately. The attack then arms a new Illuminated charge for another eligible spear attack.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.spearSolarStorm).effects,
          'additional while Illuminated'
        ).facts
    ),
    [ID.SYMBOL_OF_LUMINANCE]: skillTooltip(
      'Create a damaging symbol. During its luminance window, eligible spear attacks receive their Illuminated effects without spending an armed charge.',
      (balanceContext) => simulationEffectFacts(tooltipProfile(balanceContext, CORE.spearLuminance).effects).facts
    ),
    [ID.SYMBOL_OF_IGNITION]: skillTooltip(
      'Create a damaging symbol and an ignition field. Other qualifying player strikes, torch pulses, and fire-whirl bolts trigger additional Burning while the field is active. Projectile and nonprojectile triggers have independent cooldowns.',
      (balanceContext) => [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, CORE.symbolOfIgnition).effects,
          'ignition field; Burning is per trigger'
        ).facts,
        profileFact(
          balanceContext,
          CORE.symbolOfIgnition,
          'internalCooldown',
          'Ignition interval per trigger group',
          tooltipSeconds
        )
      ]
    ),
    [ID.BANE_SIGNET]: skillTooltip(
      'Passively gain power while this signet is ready. Activate to knock down the target. Perfect Inscriptions strengthens the passive and keeps it active during recharge.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          'guardian.core.bane-signet-passive',
          'attributeBonus',
          'Base passive power',
          tooltipDecimal
        )
      ]
    ),
    [ID.SIGNET_OF_WRATH]: skillTooltip(
      'Passively gain condition damage while this signet is ready. Activate to immobilize the target. Perfect Inscriptions strengthens the passive and keeps it active during recharge.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          'guardian.core.signet-of-wrath-passive',
          'attributeBonus',
          'Base passive condition damage',
          tooltipDecimal
        )
      ]
    ),
    [ID.ZEALOTS_FLAME]: skillTooltip(
      "Apply pulsing Burning and temporarily unlock Zealot's Fire. Radiant Fire changes its ammunition, recharge, Burning duration, and follow-up window."
    ),
    [ID.ZEALOTS_FIRE]: skillTooltip(
      "Consume the Zealot's Flame follow-up to strike and burn your target. Its temporary reuse restriction ends when you perform another combat action."
    ),
    [ID.BINDING_BLADE]: skillTooltip('Strike and tether your target, then temporarily unlock the pull follow-up.'),
    [ID.SHIELD_OF_ABSORPTION]: skillTooltip(
      'Knock back the target and temporarily unlock the shield follow-up. Projectile absorption and healing are outside combat simulation scope.'
    ),
    [ID.SHIELD_OF_ABSORPTION_ID_9224]: skillTooltip(
      'Consume the Shield of Absorption follow-up. Its healing adds no damage or status effect within combat simulation scope.'
    ),
    ...Object.fromEntries(
      MANTRAS.flatMap((mantra) => [
        [
          mantra.rootId,
          skillTooltip(
            'Prepare this mantra and unlock its charged uses. Equipped mantras begin the simulation prepared and rearm automatically after a full recharge.'
          )
        ],
        [
          mantra.normalId,
          skillTooltip(
            'Spend a prepared mantra charge and apply these effects. The last remaining charge uses the separate final-charge skill.'
          )
        ],
        [
          mantra.finalId,
          skillTooltip(
            'Spend the final mantra charge and apply these effects. The mantra becomes unavailable until its full recharge finishes, then automatically prepares again.'
          )
        ]
      ])
    ),
    [ID.JUSTICE]: skillTooltip(
      'Activate Justice to arm Burning on your next qualifying hit. While its passive is ready, qualifying hits periodically burn the target; activation and the passive use their listed alternatives.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.justice, 'threshold', 'Base qualifying hits per passive trigger'),
        ...simulationEffectFacts(tooltipProfile(balanceContext, CORE.justice).effects).facts
      ]
    ),
    [ID.BANISH]: skillTooltip("Strike and knock back your target. A completed cast resets Mighty Blow's recharge."),
    [ID.FLASH_COMBO]: skillTooltip('Strike repeatedly and unlock Repose for its temporary follow-up window.'),
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
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'guardian.shining-spin',
          'factor',
          'Strike damage against disabled targets',
          tooltipFactorChange
        )
      ]
    ),
    [ID.GLEAMING_BLADE]: skillTooltip(
      "Equip the radiant sword and strike your target. Consume an armed Radiant Courage sword bonus to increase this impact's damage.",
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'guardian.gleaming-blade',
          'factor',
          'Strike damage with Radiant Courage',
          tooltipFactorChange
        )
      ]
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
      (balanceContext) => [
        modifierFact(balanceContext, 'guardian.piercing-stance', 'amount', 'Strike damage while active')
      ]
    ),
    [ID.DARING_ADVANCE]: skillTooltip(
      'Apply these effects and gain a temporary strike-damage bonus. Its own impact benefits only when an earlier application was already active.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'guardian.daring-advance',
          'factor',
          'Strike damage while active',
          tooltipFactorChange
        )
      ]
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
    ),
    [ID.ASHES_OF_THE_JUST]: skillTooltip(
      "Grant Ashes of the Just and might to your party. Each recipient's qualifying strikes spend Ashes charges to burn the target, subject to the trigger interval.",
      (balanceContext) => [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, FIREBRAND.ashes)
            .effects?.filter((effect) => effect.type !== 'condition')
            .map((effect) => ({
              ...effect,
              ...(effect.type === 'buff'
                ? { stacks: tooltipNumber(tooltipProfile(balanceContext, FIREBRAND.ashes), 'maximumStacks') }
                : {}),
              audience: { recipients: 'party' as const }
            })),
          'party grant'
        ).facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, FIREBRAND.ashes).effects?.filter((effect) => effect.type === 'condition'),
          'per charge spent'
        ).facts,
        profileFact(balanceContext, FIREBRAND.ashes, 'internalCooldown', 'Minimum trigger interval', tooltipSeconds)
      ]
    )
  },
  traits: {
    [TRAIT.ZEALOTS_RESOLUTION]: traitTooltip(
      'A qualifying strike after the target has lost enough health creates Lesser Symbol of Resolution. The hit crossing the threshold does not trigger it.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'threshold', 'Required target health lost', tooltipPercent),
        profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.SYMBOLIC_EXPOSURE]: traitTooltip(
      'Symbol hits inflict vulnerability. Deal increased strike damage to vulnerable targets.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'guardian.symbolic-exposure',
          'factor',
          'Strike damage against vulnerable targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.SYMBOLIC_AVENGER]: traitTooltip(
      'Symbol hits grant stacking strike damage. New stacks replace the shortest remaining stack at the cap.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'guardian.symbolic-avenger', 'damagePerStack', 'Strike damage per stack'),
        modifierFact(
          balanceContext,
          'guardian.symbolic-avenger',
          'maximumStacks',
          'Maximum damage stacks',
          tooltipDecimal
        ),
        profileFact(balanceContext, id, 'pulseInterval', 'Stack duration', tooltipSeconds)
      ]
    ),
    [TRAIT.WRATHFUL_SPIRIT]: outsideScopeTooltip,
    [TRAIT.FIERY_WRATH]: traitTooltip('Deal increased strike damage to burning targets.', (balanceContext) => [
      modifierFact(
        balanceContext,
        'guardian.fiery-wrath',
        'factor',
        'Strike damage against burning targets',
        tooltipFactorChange
      )
    ]),
    [TRAIT.ZEALOUS_SCEPTER]: outsideScopeTooltip,
    [TRAIT.RENEWING_SPLENDOR]: outsideScopeTooltip,
    [TRAIT.ZEALOUS_BLADE]: traitTooltip(
      'Gain power, with an additional bonus while wielding a greatsword. Greatsword skills recharge faster.',
      (balanceContext, id) => [
        profileFact(balanceContext, TRAIT.ZEALOUS_BLADE, 'attributeBonus', 'Power', tooltipDecimal),
        profileFact(
          balanceContext,
          TRAIT.ZEALOUS_BLADE,
          'weaponAttributeBonus',
          'Power with a greatsword',
          tooltipDecimal
        ),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Greatsword recharge duration', tooltipFactorChange)
      ]
    ),
    // Attribute facts use the same patchable fields as the build calculator and runtime.
    [TRAIT.KINDLED_ZEAL]: traitTooltip('Gain condition damage from eligible power.', (balanceContext, id) => [
      profileFact(
        balanceContext,
        id,
        'attributeConversion',
        'Eligible power converted to condition damage',
        tooltipPercent
      )
    ]),
    [TRAIT.ETERNAL_ARMORY]: traitTooltip('Spirit weapon skills gain additional ammunition.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Additional ammunition')
    ]),
    [TRAIT.SHATTERED_AEGIS]: outsideScopeTooltip,
    [TRAIT.FURIOUS_FOCUS]: traitTooltip(
      'Activating Justice creates Lesser Symbol of Blades. Deal increased strike damage while you have fury.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'guardian.furious-focus', 'amount', 'Strike damage with fury'),
        profileFact(balanceContext, id, 'cooldown', 'Base symbol recharge', tooltipSeconds)
      ]
    ),
    [TRAIT.JUSTICE_IS_BLIND]: traitTooltip(
      'Activating Justice blinds the target. For Luminary, the activation also grants a light aura.'
    ),
    [TRAIT.RENEWED_JUSTICE]: outsideScopeTooltip,
    [TRAIT.RADIANT_POWER]: traitTooltip(
      'Gain ferocity and additional critical-strike chance against burning targets.',
      (balanceContext) => [
        profileFact(balanceContext, TRAIT.RADIANT_POWER, 'attributeBonus', 'Ferocity', tooltipDecimal),
        profileFact(
          balanceContext,
          TRAIT.RADIANT_POWER,
          'criticalChance',
          'Critical chance against burning targets',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.INNER_FIRE]: outsideScopeTooltip,
    [TRAIT.RIGHT_HAND_STRENGTH]: traitTooltip(
      'Gain precision and additional power with a one-handed main-hand weapon.',
      (balanceContext) => [
        profileFact(balanceContext, TRAIT.RIGHT_HAND_STRENGTH, 'attributeBonus', 'Precision', tooltipDecimal),
        profileFact(
          balanceContext,
          TRAIT.RIGHT_HAND_STRENGTH,
          'attributeBonus',
          'Power with a one-handed main hand',
          tooltipDecimal
        )
      ]
    ),
    [TRAIT.HEALERS_RESOLUTION]: traitTooltip('Committing a healing skill grants resolution.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.WRATH_OF_JUSTICE]: outsideScopeTooltip,
    [TRAIT.RADIANT_FIRE]: traitTooltip(
      "Burning lasts longer. Torch skills recharge faster; Zealot's Flame gains ammunition and its burning has an additional base-duration multiplier.",
      (balanceContext, id) => [
        profileFact(balanceContext, TRAIT.RADIANT_FIRE, 'conditionDurationBonus', 'Burning duration', tooltipPercent),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Torch recharge duration', tooltipFactorChange),
        profileFact(balanceContext, id, 'maximumStacks', "Zealot's Flame ammunition"),
        profileFact(
          balanceContext,
          id,
          'durationMultiplier',
          "Zealot's Flame base burning duration",
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.RETRIBUTION]: traitTooltip('Deal increased strike damage while you have resolution.', (balanceContext) => [
      modifierFact(balanceContext, 'guardian.retribution', 'amount', 'Strike damage with resolution')
    ]),
    [TRAIT.AMPLIFIED_WRATH]: traitTooltip(
      'Burning deals increased damage. Justice passive burning also lasts longer.',
      (balanceContext, id) => [
        modifierFact(
          balanceContext,
          'guardian.amplified-wrath-damage',
          'factor',
          'Burning damage',
          tooltipFactorChange
        ),
        profileFact(balanceContext, id, 'durationMultiplier', 'Justice passive burning duration', tooltipFactorChange)
      ]
    ),
    [TRAIT.PERFECT_INSCRIPTIONS]: traitTooltip(
      'Supported signet passives become stronger and remain active during recharge.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.PERFECT_INSCRIPTIONS,
          'attributeMultiplier',
          'Bane Signet passive bonus',
          tooltipFactorChange
        ),
        profileFact(
          balanceContext,
          TRAIT.PERFECT_INSCRIPTIONS,
          'attributeMultiplier',
          'Signet of Wrath passive bonus',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.RIGHTEOUS_INSTINCTS]: traitTooltip(
      'Resolution grants critical-strike chance and periodically grants might while active.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          TRAIT.RIGHTEOUS_INSTINCTS,
          'criticalChance',
          'Critical chance with resolution',
          tooltipPercent
        ),
        profileFact(balanceContext, id, 'pulseInterval', 'Might interval', tooltipSeconds)
      ]
    ),
    [TRAIT.VALOROUS_DEFENSE]: outsideScopeTooltip,
    [TRAIT.STEADFAST_COURAGE]: outsideScopeTooltip,
    [TRAIT.MIGHT_OF_THE_PROTECTOR]: outsideScopeTooltip,
    [TRAIT.STRENGTH_OF_THE_FALLEN]: outsideScopeTooltip,
    [TRAIT.SMITERS_BOON]: outsideScopeTooltip,
    [TRAIT.FOCUS_MASTERY]: traitTooltip('Focus skills recharge faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'rechargeMultiplier', 'Focus recharge duration', tooltipFactorChange)
    ]),
    [TRAIT.STALWART_DEFENDER]: traitTooltip(
      'Gain toughness while wielding an off-hand shield.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Toughness with an off-hand shield')]
    ),
    [TRAIT.REDEMPTION]: outsideScopeTooltip,
    [TRAIT.COMMUNAL_DEFENSES]: outsideScopeTooltip,
    [TRAIT.ALTRUISTIC_HEALING]: outsideScopeTooltip,
    [TRAIT.MONKS_FOCUS]: outsideScopeTooltip,
    [TRAIT.TENACIOUS_DEFENSE]: outsideScopeTooltip,
    [TRAIT.VIGOROUS_PRECISION]: outsideScopeTooltip,
    [TRAIT.SELFLESS_DARING]: outsideScopeTooltip,
    [TRAIT.PURITY_OF_BODY]: outsideScopeTooltip,
    [TRAIT.INVIGORATED_BULWARK]: outsideScopeTooltip,
    [TRAIT.PROTECTIVE_REVIVER]: outsideScopeTooltip,
    [TRAIT.PROTECTORS_RESTORATION]: (balanceContext, entity) => {
      const profile = tooltipProfile(balanceContext, entity.id);
      return {
        description:
          'Committing a healing skill creates Lesser Symbol of Protection. Each strike pulse also grants party protection.',
        facts: [
          profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
          ...simulationEffectFacts(
            profile.effects?.map((effect) =>
              effect.type === 'boon' ? { ...effect, audience: { recipients: 'party' as const } } : effect
            )
          ).facts
        ]
      };
    },
    [TRAIT.HONORABLE_STAFF]: traitTooltip('Gain concentration.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Concentration')
    ]),
    [TRAIT.PURE_OF_HEART]: outsideScopeTooltip,
    [TRAIT.EMPOWERING_MIGHT]: outsideScopeTooltip,
    [TRAIT.PURE_OF_VOICE]: outsideScopeTooltip,
    [TRAIT.WRIT_OF_PERSISTENCE]: (balanceContext, entity) => {
      const effects = tooltipProfile(balanceContext, entity.id).effects || [];
      return {
        description:
          'Extend supported symbol fields and their strike pulses. Symbol of Punishment uses its separately authored extra strikes and might pulses; other symbols repeat their own final strike.',
        facts: [
          ...simulationEffectFacts(
            effects.filter((effect) => effect.type === 'buff'),
            'field extension'
          ).facts,
          ...simulationEffectFacts(
            effects.filter((effect) => effect.type !== 'buff'),
            'Symbol of Punishment only'
          ).facts
        ]
      };
    },
    [TRAIT.FORCE_OF_WILL]: traitTooltip('Gain vitality.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Vitality')
    ]),
    [TRAIT.INSPIRED_VIRTUE]: (balanceContext, entity) => {
      const tooltip = virtueBoons(
        'Activating a virtue grants the corresponding boon to the party. Deal increased strike damage for each different boon on you.'
      )(balanceContext, entity);
      return {
        ...tooltip,
        facts: [
          modifierFact(balanceContext, 'guardian.inspired-virtue', 'damagePerBoon', 'Strike damage per boon'),
          ...tooltip.facts
        ]
      };
    },
    [TRAIT.VIRTUE_OF_RESOLUTION]: traitTooltip(
      'Activating a virtue grants resolution. Resolution applications last longer.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Resolution duration', tooltipFactorChange)
      ]
    ),
    [TRAIT.POWER_OF_THE_VIRTUOUS]: traitTooltip(
      'Gain condition damage from vitality. Virtues recharge faster; Firebrand tome dormancy is also shortened.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          TRAIT.POWER_OF_THE_VIRTUOUS,
          'attributeConversion',
          'Vitality converted to condition damage'
        ),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Virtue recharge duration', tooltipFactorChange)
      ]
    ),
    [TRAIT.UNSCATHED_CONTENDER]: traitTooltip(
      'Deal increased strike damage at full health, as assumed by the combat simulation. Aegis grants an additional strike-damage bonus.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'guardian.unscathed-contender-health',
          'factor',
          'Full-health strike damage',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'guardian.unscathed-contender-aegis',
          'amount',
          'Additional strike damage with aegis'
        )
      ]
    ),
    [TRAIT.RESOLUTE_SUBCONSCIOUS]: outsideScopeTooltip,
    [TRAIT.MASTER_OF_CONSECRATIONS]: traitTooltip(
      'Purging Flames gains additional strike and burning pulses and a longer fire field.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Purging Flames fire field duration', tooltipFactorChange)
      ],
      'additional Purging Flames effects'
    ),
    [TRAIT.INSPIRING_VIRTUE]: traitTooltip(
      'Activating a virtue temporarily increases strike damage.',
      (balanceContext) => [
        modifierFact(balanceContext, 'guardian.inspiring-virtue', 'amount', 'Strike damage during the bonus')
      ]
    ),
    [TRAIT.ABSOLUTE_RESOLVE]: outsideScopeTooltip,
    [TRAIT.GLACIAL_HEART]: outsideScopeTooltip,
    [TRAIT.PERMEATING_WRATH]: traitTooltip(
      'Justice triggers burning after fewer qualifying hits.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'threshold', 'Hits per trigger')]
    ),
    [TRAIT.BATTLE_PRESENCE]: traitTooltip("Willbender's Phoenix Protocol alacrity also affects the party."),
    [TRAIT.INDOMITABLE_COURAGE]: traitTooltip(
      "Activating Courage grants stability. Dragonhunter's Courage passive triggers more frequently.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'pulseInterval', 'Dragonhunter Courage passive interval', tooltipSeconds)
      ]
    ),
    [TRAIT.VIRTUOUS_ACTION]: traitTooltip(
      'Replace the core virtues with Spear of Justice, Wings of Resolve, and Shield of Courage.'
    ),
    [TRAIT.DEFENDERS_DOGMA]: traitTooltip('Gain vitality.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Vitality')
    ]),
    [TRAIT.PURE_OF_SIGHT]: traitTooltip(
      "Deal increased strike damage within the simulator's fixed positioning assumptions.",
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'guardian.dragonhunter.pure-of-sight',
          'factor',
          'Strike damage',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.HUNTERS_PREMONITION]: traitTooltip('Using a trap grants aegis.'),
    [TRAIT.DULLED_SENSES]: traitTooltip('Applying player control effects inflicts crippled.'),
    [TRAIT.SOARING_DEVASTATION]: traitTooltip('Wings of Resolve strikes and immobilizes the target.'),
    [TRAIT.HUNTERS_DETERMINATION]: traitTooltip('Using an elite skill restores endurance.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Endurance restored')
    ]),
    [TRAIT.ZEALOTS_AGGRESSION]: traitTooltip('Deal increased strike damage to crippled targets.', (balanceContext) => [
      modifierFact(
        balanceContext,
        'guardian.dragonhunter.zealots-aggression',
        'factor',
        'Strike damage against crippled targets',
        tooltipFactorChange
      )
    ]),
    [TRAIT.BULWARK]: outsideScopeTooltip,
    [TRAIT.HUNTERS_FORTIFICATION]: outsideScopeTooltip,
    [TRAIT.HEAVY_LIGHT]: traitTooltip(
      'Control effects grant stability. Deal increased strike damage to disabled or defiant targets.',
      (balanceContext, id) => [
        modifierFact(
          balanceContext,
          'guardian.dragonhunter.heavy-light',
          'factor',
          'Strike damage against disabled targets',
          tooltipFactorChange
        ),
        profileFact(balanceContext, id, 'internalCooldown', 'Stability cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.BIG_GAME_HUNTER]: traitTooltip(
      'Spear of Justice keeps its tether longer. Strikes during the tether apply vulnerability and deal increased damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'pulseInterval', 'Tether duration', tooltipSeconds),
        modifierFact(
          balanceContext,
          'guardian.dragonhunter.big-game-hunter',
          'factor',
          'Strike damage while tethered',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.PURITY_OF_WORD]: traitTooltip('Unlock tomes and their shared page resource.'),
    [TRAIT.SWIFT_SCHOLAR]: traitTooltip(
      'Opening a tome with a ready passive grants quickness. Consecutive page skills in the same tome refund a page.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'minimumStacks', 'Consecutive page skills required'),
        profileFact(balanceContext, id, 'resourceGain', 'Pages refunded')
      ]
    ),
    [TRAIT.IMBUED_HASTE]: traitTooltip(
      'Quickness grants condition damage, healing power, and vitality.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.IMBUED_HASTE,
          'attributeBonus',
          'Each attribute with quickness',
          tooltipDecimal
        )
      ]
    ),
    [TRAIT.UNRELENTING_CRITICISM]: traitTooltip('Player axe strikes inflict bleeding.'),
    [TRAIT.LIBERATORS_VOW]: traitTooltip(
      'Using a healing skill grants quickness to the party.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.ARCHIVIST_OF_WHISPERS]: traitTooltip('Increase the shared tome-page capacity.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'maximumStacks', 'Maximum pages')
    ]),
    [TRAIT.WEIGHTY_TERMS]: traitTooltip(
      "Using a mantra's final charge grants pages and inflicts slow.",
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Pages gained')]
    ),
    [TRAIT.STALWART_SPEED]: traitTooltip(
      'Applying aegis or stability grants quickness to the party.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.LEGENDARY_LORE]: virtueBoons('Using a tome page grants a boon according to the active tome.'),
    [TRAIT.STOIC_DEMEANOR]: traitTooltip('Control, immobilize, or slow applications grant resistance and might.'),
    [TRAIT.QUICKFIRE]: traitTooltip(
      'Applying quickness grants an Ashes of the Just charge to a recipient. Justice retains its passive while dormant.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Charge-grant cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.LOREMASTER]: traitTooltip('Tome pages regenerate faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'pulseInterval', 'Page regeneration interval', tooltipSeconds)
    ]),
    [TRAIT.WILLBENDER_TRAINING]: traitTooltip(
      'Replace passive virtues with active Willbender virtue windows and their hit-triggered effects.'
    ),
    [TRAIT.RIGHTEOUS_SPRINT]: outsideScopeTooltip,
    [TRAIT.LETHAL_TEMPO]: traitTooltip(
      'Virtue activations and completed virtue triggers grant stacking damage. New grants refresh the active stack window.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        modifierFact(
          balanceContext,
          'guardian.willbender.lethal-tempo-strike',
          'damagePerStack',
          'Strike damage per stack'
        ),
        modifierFact(
          balanceContext,
          'guardian.willbender.lethal-tempo-condition',
          'damagePerStack',
          'Condition damage per stack'
        )
      ]
    ),
    [TRAIT.SEARING_PACT]: traitTooltip(
      'Gain condition damage. Willbender flames also inflict burning.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Condition damage')]
    ),
    [TRAIT.POWER_FOR_POWER]: traitTooltip(
      'Gain power. Willbender flame strikes deal increased damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Power'),
        modifierFact(
          balanceContext,
          'guardian.willbender.power-for-power',
          'factor',
          'Willbender flame strike damage',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.CONCEITED_CURATE]: traitTooltip('Gain vitality.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Vitality')
    ]),
    [TRAIT.RESTORATIVE_VIRTUES]: traitTooltip(
      'Activating Resolve grants vigor. Completed virtue triggers reduce active-weapon cooldowns.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeReduction', 'Weapon recharge reduction per trigger', tooltipSeconds)
      ]
    ),
    [TRAIT.HOLY_RECKONING]: traitTooltip(
      'Completed virtue triggers grant might to the party. Rushing Justice also grants fury to yourself.'
    ),
    [TRAIT.VANGUARD_TACTICS]: outsideScopeTooltip,
    [TRAIT.PHOENIX_PROTOCOL]: traitTooltip(
      'Activating Resolve grants alacrity; completed Resolve triggers grant the shorter application. Battle Presence shares these applications with the party.'
    ),
    [TRAIT.TYRANTS_MOMENTUM]: traitTooltip(
      'Lethal Tempo grants stronger damage bonuses with a shorter stack window. Rushing Justice uses the extended Justice window.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'guardian.willbender.lethal-tempo-strike',
          'tyrantsMomentumDamagePerStack',
          'Strike damage per stack'
        ),
        modifierFact(
          balanceContext,
          'guardian.willbender.lethal-tempo-condition',
          'tyrantsMomentumDamagePerStack',
          'Condition damage per stack'
        )
      ]
    ),
    [TRAIT.DEATHLESS_COURAGE]: outsideScopeTooltip,
    [TRAIT.LUMINARY]: traitTooltip('Unlock Radiant Forge, radiant weapons, and radiant virtues.'),
    [TRAIT.LIGHTS_GIFT]: traitTooltip('Gain vitality.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Vitality')
    ]),
    [TRAIT.RADIANT_ARMAMENTS]: traitTooltip(
      'Equipping a radiant hammer temporarily increases strike damage. Equipping another radiant weapon removes the hammer bonus.',
      (balanceContext) => [
        modifierFact(balanceContext, 'guardian.radiant-armaments', 'amount', 'Radiant hammer strike damage')
      ]
    ),
    [TRAIT.SHIMMERING_STANCES]: outsideScopeTooltip,
    [TRAIT.RESOLUTE_BLESSING]: outsideScopeTooltip,
    [TRAIT.PERSISTENT_BLESSING]: outsideScopeTooltip,
    [TRAIT.RESPLENDENT_WEAPONRY]: traitTooltip(
      'Successfully equipping a radiant weapon grants alacrity, might, and fury to the party.'
    ),
    [TRAIT.PURGING_LIGHT]: outsideScopeTooltip,
    [TRAIT.EMPOWERED_ARMAMENTS]: traitTooltip(
      'Equipping radiant weapons grants or extends a strike-damage bonus, up to its remaining-duration cap.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'guardian.empowered-armaments', 'amount', 'Strike damage'),
        profileFact(balanceContext, id, 'resourceGain', 'Duration added per equip', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum remaining duration', tooltipSeconds)
      ]
    ),
    [TRAIT.ILLUMINATING_INSPIRATION]: traitTooltip(
      'Equipping radiant weapons reduces radiant virtue cooldowns.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeReduction', 'Virtue recharge reduction', tooltipSeconds)
      ]
    ),
    [TRAIT.SOVEREIGN_OF_LIGHT]: traitTooltip(
      'Entering Radiant Forge grants a light aura. Eligible Luminary skills detonate an active light aura, dealing a strike. Glaring Burst is excluded.'
    ),
    [TRAIT.MASTER_AT_ARMS]: traitTooltip(
      'Activating a radiant virtue resets the recharge of its corresponding radiant weapon skills: Justice resets hammer, Resolve resets staff, and Courage resets sword and shield.'
    )
  }
};
