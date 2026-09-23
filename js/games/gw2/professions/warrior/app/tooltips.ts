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
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/warrior/core/profiles.js';
import { BERSERKER_BALANCE_PROFILE_IDS as BERSERKER } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as BLADESWORN } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { PARAGON_BALANCE_PROFILE_IDS as PARAGON } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Describes Warrior triggers and alternatives without copying balance numbers out of their simulation owners. */
export const warriorTooltips: ProfessionTooltips = {
  skillFacts: (balanceContext, entity) => [
    ...Object.entries({ adrenalineGain: 'Adrenaline gained', flowGain: 'Flow gained' }).flatMap(([field, name]) =>
      entity[field] == null ? [] : [{ name, detail: tooltipDecimal(tooltipNumber(entity, field)) }]
    ),
    ...(entity.adrenalineCost == null
      ? []
      : [
          {
            name:
              entity.primalBurst || entity.specialization === 'Spellbreaker' || entity.handlerId === 'warrior.berserk'
                ? 'Adrenaline cost'
                : 'Minimum adrenaline',
            detail: tooltipDecimal(tooltipNumber(entity, 'adrenalineCost'))
          }
        ]),
    ...(entity.categories?.includes('Rage') && entity.id !== ID.BERSERK
      ? [
          profileFact(
            balanceContext,
            BERSERKER.rageExtensions,
            entity.id === ID.WILD_BLOW
              ? 'maximumStacks'
              : [ID.OUTRAGE, ID.SUNDERING_LEAP, ID.SHATTERING_BLOW].some((id) => id === entity.id)
                ? 'threshold'
                : 'minimumStacks',
            'Base extension while Berserk is active',
            tooltipSeconds
          )
        ]
      : [])
  ],
  handlers: {
    'warrior.command': (balanceContext, entity) =>
      skillTooltip(
        "Apply this command's initial effects and queue an echo. A completed burst triggers pending echoes early. Reverberation adds another echo. " +
          (entity.id === ID.FIND_THEIR_WEAKNESS
            ? 'The echo grants party might and adrenaline.'
            : entity.id === ID.ON_YOUR_KNEES
              ? 'The echo strikes and immobilizes your target.'
              : entity.id === ID.WE_SHALL_RETURN
                ? 'The echo grants adrenaline; revival is outside simulation scope.'
                : 'The defensive echo has no direct damage in the simulator.'),
        (context) => [profileFact(context, PARAGON.commands, 'pulseInterval', 'Delay before echo', tooltipSeconds)]
      )(balanceContext, entity),
    'warrior.chant': (balanceContext, entity) => {
      const action = entity.id === ID.CHANT_OF_ACTION;
      const recovery = entity.id === ID.CHANT_OF_RECUPERATION;
      const effects = tooltipProfile(balanceContext, PARAGON.chants).effects || [];
      // Match runtime packet identities even when an earlier boon was removed.
      const names = action ? ['might', 'fury'] : recovery ? ['vigor'] : ['stability'];
      const opening = effects.filter((effect) => effect.type === 'boon' && names.includes(String(effect.name)));
      return {
        description:
          'Spend adrenaline, gain Motivation, and replace the active refrain. The refrain pulses until Motivation runs out; each pulse uses the Motivation tier before spending its cost. ' +
          (action
            ? 'Action pulses might, adding Fury at higher tiers. Enduring Refrain increases its might.'
            : recovery
              ? 'Recuperation has defensive effects, adding regeneration at the highest tier. Healing is outside combat simulation scope.'
              : 'Freedom pulses swiftness, adds resolution at higher tiers, and adds protection at the highest tier.'),
        facts: [
          ...simulationEffectFacts(
            opening.map((effect) => ({ ...effect, audience: { recipients: 'party' as const } })),
            'on activation'
          ).facts,
          profileFact(balanceContext, PARAGON.chants, 'resourceGain', 'Base Motivation gained'),
          profileFact(balanceContext, PARAGON.resources, 'pulseInterval', 'Refrain pulse interval', tooltipSeconds),
          profileFact(balanceContext, PARAGON.resources, 'minimumStacks', 'Motivation required for tier two'),
          profileFact(balanceContext, PARAGON.resources, 'threshold', 'Motivation required for tier three')
        ]
      };
    },
    'warrior.artillery-slash': (balanceContext, entity) => {
      const sharp = entity.id === ID.SHARP_ARTILLERY_SLASH;
      const profile = tooltipProfile(
        balanceContext,
        sharp ? BLADESWORN.sharpArtillerySlash : BLADESWORN.artillerySlash
      );
      return {
        description:
          'Consume all available ammunition for an explosive attack. ' +
          (sharp
            ? 'Sharp as the Wind applies Bleeding, increasing it with more rounds spent; consuming both rounds upgrades daze to stun.'
            : 'Consuming both rounds increases strike damage. The attack also dazes.'),
        facts: sharp
          ? simulationEffectFacts(profile.effects).facts
          : (profile.effects || []).flatMap(
              (effect) =>
                simulationEffectFacts(
                  [effect],
                  effect.type === 'strike' ? (effect.name === 'One round' ? 'one round spent' : 'two rounds spent') : ''
                ).facts
            )
      };
    },
    'warrior.resource': (balanceContext, entity) =>
      skillTooltip(
        entity.burst
          ? entity.primalBurst
            ? 'Spend adrenaline to perform a primal burst and trigger eligible burst traits.'
            : 'Spend adrenaline to perform a burst and trigger eligible burst traits. Ordinary bursts consume available adrenaline; specialization variants follow their own spending limit.'
          : 'Apply the listed effects and gain adrenaline when the activation succeeds.'
      )(balanceContext, entity),
    'warrior.counterblow': skillTooltip(
      'Begin a block and unlock Tactical Blow for the original block window. Tactical Blow can be used as a manual follow-up. Incoming attacks are outside simulation scope.'
    ),
    'warrior.fierce-blow': skillTooltip(
      'Strike your target. Damage increases against a controlled or defiant target.',
      undefined
    ),
    'warrior.mighty-throw': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id);
      if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
      const effects = simulationEffectFacts(
        selected.effects
          ?.map((effect) =>
            effect.type === 'strike' && effect.ticks
              ? {
                  ...effect,
                  ticks: effect.ticks.filter((tick) => tick.metadata?.packetKind !== 'warrior.mighty-throw-shard')
                }
              : effect
          )
          .filter((effect) => effect.metadata?.packetKind !== 'warrior.mighty-throw-shard')
      );
      return {
        ...effects,
        description:
          'Throw your spear at the primary target. Shards that only hit secondary enemies are excluded from this single-target simulation.'
      };
    },
    'warrior.combustive-shot': (balanceContext) => {
      const profile = tooltipProfile(balanceContext, CORE.combustiveShot);
      return {
        description:
          'Spend adrenaline to create a fire field that repeatedly strikes and burns your target. Higher burst tiers add pulses and extend the field; each listed tier is an alternative.',
        facts: [
          profileFact(balanceContext, CORE.combustiveShot, 'pulseInterval', 'Pulse interval', tooltipSeconds),
          ...[1, 2, 3].flatMap((tier) => [
            ...simulationEffectFacts(
              profile.effects?.map((effect) => ({ ...effect, applications: tier + 1 })),
              `burst tier ${tier}`
            ).facts,
            {
              name: `Fire field at burst tier ${tier}`,
              detail: tooltipSeconds(tier * tooltipNumber(profile, 'durationPerTier'))
            }
          ])
        ]
      };
    },
    'warrior.dragons-roar': (balanceContext) => ({
      description: 'Consume all available ammunition and fire one explosive strike for each round spent.',
      facts: simulationEffectFacts(tooltipProfile(balanceContext, CORE.dragonsRoar).effects, 'per round spent').facts
    }),
    'warrior.berserk': skillTooltip(
      'Enter Berserk, reduce your adrenaline capacity, and unlock primal bursts. Rage skills and eligible traits can extend the active duration.',
      (balanceContext) => [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, BERSERKER.resources).effects,
          'base duration before trait extensions'
        ).facts,
        profileFact(balanceContext, BERSERKER.resources, 'maximumStacks', 'Adrenaline capacity while Berserk')
      ]
    ),
    'warrior.blood-reckoning': skillTooltip(
      'Gain adrenaline and reset primal-burst recharges when the activation succeeds. Healing is outside combat simulation scope.'
    ),
    'warrior.full-counter': skillTooltip(
      'Spend adrenaline and apply the modeled counterattack and control effects. Incoming damage is outside simulation scope.'
    ),
    'warrior.gunsaber-enter': skillTooltip(
      'Draw your Gunsaber, replace your weapon skills, and trigger applicable weapon-swap and Gunsaber-entry effects.'
    ),
    'warrior.gunsaber-exit': skillTooltip(
      'Sheathe your Gunsaber and restore your weapon skills. End an active Dragon Trigger and trigger applicable weapon-swap effects.'
    ),
    'warrior.dragon-trigger': skillTooltip(
      'Enter Dragon Trigger, drawing the Gunsaber if needed. Spend Flow at each charging opportunity to build Dragon charges. Release with a Dragon Slash; recharge begins when you leave the trigger. Tactical Reload increases charges gained per opportunity.',
      (balanceContext) => [
        profileFact(balanceContext, BLADESWORN.dragonTrigger, 'maximumStacks', 'Maximum Dragon charges'),
        profileFact(balanceContext, BLADESWORN.dragonTrigger, 'minimumStacks', 'Maximum charges with Daring Dragon'),
        profileFact(balanceContext, BLADESWORN.dragonTrigger, 'resourceCost', 'Base Flow cost per charge opportunity'),
        profileFact(balanceContext, BLADESWORN.dragonTrigger, 'cooldown', 'Maximum trigger duration', tooltipSeconds)
      ]
    ),
    'warrior.dragon-slash': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id);
      if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
      return {
        description:
          'Consume your Dragon charges and leave Dragon Trigger to release an explosive burst. Strike damage scales linearly from the minimum to the maximum charge value. Sharp as the Wind variants also scale Burning with charges.',
        facts: [
          ...simulationEffectFacts(
            [{ type: 'strike', coefficient: tooltipNumber(selected, 'dragonSlashMinimumCoefficient') }],
            'minimum charge'
          ).facts,
          ...simulationEffectFacts(
            [{ type: 'strike', coefficient: tooltipNumber(selected, 'dragonSlashMaximumCoefficient') }],
            'maximum charges'
          ).facts,
          ...(Number(selected.dragonSlashMinimumBurningDuration) > 0
            ? [
                {
                  name: 'Burning duration at minimum charge',
                  detail: tooltipSeconds(tooltipNumber(selected, 'dragonSlashMinimumBurningDuration'))
                },
                {
                  name: 'Burning duration at maximum charges',
                  detail: tooltipSeconds(tooltipNumber(selected, 'dragonSlashMaximumBurningDuration'))
                }
              ]
            : [])
        ]
      };
    },
    'warrior.overcharged-cartridges': (balanceContext) => {
      const profile = tooltipProfile(balanceContext, BLADESWORN.overchargedCartridges);
      return {
        description:
          'Empower your explosions and add Burning to qualifying player explosions. Casting again during the ordinary window replaces it with Supercharged Cartridges. Further casts while supercharged spend ammunition without extending the window.',
        facts: [
          ...simulationEffectFacts(
            profile.effects?.filter((effect) =>
              ['overcharged-cartridges', 'Overcharged Burning'].includes(String(effect.name))
            ),
            'ordinary cartridges; Burning per explosion'
          ).facts,
          ...simulationEffectFacts(
            profile.effects?.filter((effect) =>
              ['supercharged-cartridges', 'Supercharged Burning'].includes(String(effect.name))
            ),
            'supercharged; replaces ordinary cartridges'
          ).facts,
          ...(profile.effects
            ?.filter((effect) => effect.type === 'buff')
            .map((effect) => ({
              name: `${effect.kind === 'supercharged-cartridges' ? 'Supercharged' : 'Ordinary'} explosion damage`,
              detail: tooltipPercent(tooltipNumber(effect, 'damageIncreasePerStack'))
            })) || [])
        ]
      };
    },
    'warrior.dodge': skillTooltip(
      'Spend endurance to dodge and trigger applicable dodge traits. Incoming attacks are outside simulation scope.',
      (balanceContext) => [profileFact(balanceContext, CORE.resources, 'resourceCost', 'Endurance cost')]
    ),
    'warrior.weapon-swap': skillTooltip('Swap to your other weapon set and trigger applicable weapon-swap effects.')
  },
  skills: {
    // Signet attributes live in mechanic profiles, separate from the active skill packets.
    [ID.SIGNET_OF_MIGHT]: skillTooltip(
      'Passively grants power while ready. Activation grants might.',
      (balanceContext) => [profileFact(balanceContext, CORE.signetPassives, 'attributeBonus', 'Passive power')]
    ),
    [ID.SIGNET_OF_FURY]: skillTooltip(
      'Passively grants precision while ready. Activation grants adrenaline and temporarily increases precision and ferocity.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.signetPassives, 'attributeBonus', 'Passive precision'),
        profileFact(
          balanceContext,
          CORE.signetOfFuryActive,
          'attributeBonus',
          'Precision and ferocity during the active buff'
        )
      ]
    ),
    [ID.RIFLE_BUTT]: skillTooltip(
      'Strike and knock back your target. Restore ammunition to your other rifle skills and reset Kill Shot and Gun Flame.'
    ),
    [ID.TREMOR]: skillTooltip("Apply the listed effects and reset Crushing Blow's recharge."),
    [ID.BACKBREAKER]: skillTooltip("Apply the listed effects and reset Fierce Blow's recharge."),
    [ID.GUNSTINGER]: skillTooltip("Strike your target and restore Dragon's Roar ammunition.", (_c, entity) => [
      {
        name: 'Ammunition restored',
        detail: tooltipDecimal(
          tooltipNumber(
            entity.mechanicTriggers?.find((trigger) => trigger.type === 'warrior.core.restore-dragons-roar-ammo'),
            'count'
          )
        )
      }
    ]),
    [ID.TACTICAL_RELOAD]: skillTooltip(
      'Restore ammunition to Bladesworn skills and prepare a bonus to charge gain for your next Dragon Trigger. Entering Dragon Trigger consumes the bonus.'
    ),
    [ID.DRAGONSPIKE_MINE]: skillTooltip("Apply the listed effects and reset Dragon Trigger's recharge."),
    [ID.FLOW_STABILIZER]: skillTooltip(
      'Gain Fury and a temporary increase to passive Flow generation. If Fury was already active before this cast, also gain Flow immediately.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          BLADESWORN.resources,
          'resourceGain',
          'Additional Flow per second per active window'
        )
      ]
    ),
    [ID.TO_THE_LIMIT]: skillTooltip(
      'Restore endurance and gain adrenaline. Healing is outside combat simulation scope.',
      (_c, entity) => [
        {
          name: 'Endurance restored',
          detail: tooltipDecimal(
            tooltipNumber(
              entity.mechanicTriggers?.find((trigger) => trigger.type === 'warrior.core.restore-endurance'),
              'count'
            )
          )
        }
      ]
    ),
    [ID.EVISCERATE]: (balanceContext, entity) => ({
      description:
        'Spend available adrenaline on a burst and gain might. Its strike uses the profile for the adrenaline tier spent.',
      facts: [
        ...simulationEffectFacts(
          balanceContext.catalog.skillsById.get(entity.id)?.effects?.filter((effect) => effect.type !== 'strike')
        ).facts,
        ...[CORE.eviscerateTier1, CORE.eviscerateTier2, CORE.eviscerateTier3].flatMap(
          (id, index) =>
            simulationEffectFacts(tooltipProfile(balanceContext, id).effects, `burst tier ${index + 1}`).facts
        )
      ]
    }),
    [ID.BLOODTHIRSTER]: (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id);
      if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
      return {
        description:
          'Spend adrenaline to strike your target. Replace the base Bleeding application with the tier for the adrenaline spent.',
        facts: [
          ...simulationEffectFacts(selected.effects?.filter((effect) => effect.type !== 'condition')).facts,
          ...(tooltipProfile(balanceContext, CORE.bloodthirsterTiers).effects?.flatMap(
            (effect, index) => simulationEffectFacts([effect], `burst tier ${index + 1}`).facts
          ) || [])
        ]
      };
    },
    [ID.KILL_SHOT]: skillTooltip(
      'Fire a burst shot. The listed strike is the first-tier base; higher adrenaline tiers increase its coefficient.'
    ),
    [ID.ARCING_SLICE]: skillTooltip(
      "Deliver a burst strike and gain Fury. Higher adrenaline tiers extend Fury's duration."
    )
  },
  traits: {
    [TRAIT.RECKLESS_DODGE]: traitTooltip('Completing a dodge strikes the target and grants might.'),
    [TRAIT.BUILDING_MOMENTUM]: traitTooltip(
      'The first qualifying burst hit restores endurance.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Endurance gained')]
    ),
    [TRAIT.PINNACLE_OF_STRENGTH]: traitTooltip(
      'Might grants additional power. Gain critical-strike chance.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Power per might stack'),
        profileFact(balanceContext, TRAIT.PINNACLE_OF_STRENGTH, 'criticalChance', 'Critical chance', tooltipPercent)
      ]
    ),
    [TRAIT.BRAVE_STRIDE]: traitTooltip(
      'Completing a movement skill grants adrenaline and stability.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Adrenaline gained')]
    ),
    [TRAIT.RESTORATIVE_STRENGTH]: outsideScopeTooltip,
    [TRAIT.PEAK_PERFORMANCE]: traitTooltip(
      'Deal increased strike damage. Physical skills temporarily grant an additional bonus.',
      (balanceContext) => [
        modifierFact(balanceContext, 'warrior.peak-performance', 'baseBonus', 'Strike damage'),
        modifierFact(
          balanceContext,
          'warrior.peak-performance',
          'activeBonus',
          'Additional strike damage after a physical skill'
        )
      ]
    ),
    [TRAIT.BODY_BLOW]: traitTooltip('Player hard-control effects inflict weakness and vulnerability.'),
    [TRAIT.FORCEFUL_GREATSWORD]: traitTooltip(
      'Gain power and additional power while wielding a greatsword. Critical hits can grant might; the chance doubles with a greatsword.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Power'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Additional power with a greatsword'),
        profileFact(balanceContext, id, 'procChance', 'Base might chance on critical hit', tooltipPercent)
      ]
    ),
    [TRAIT.GREAT_FORTITUDE]: traitTooltip(
      'Gain vitality and ferocity from eligible power. The power gained during Berserk also contributes.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Power converted to each attribute', tooltipPercent)
      ]
    ),
    [TRAIT.BERSERKERS_POWER]: traitTooltip(
      'The first qualifying burst hit grants damage-bonus stacks according to the resource tier spent.',
      (balanceContext) => [
        modifierFact(balanceContext, 'warrior.berserkers-power', 'damagePerStack', 'Strike damage per stack'),
        modifierFact(balanceContext, 'warrior.berserkers-power', 'maximumStacks', 'Maximum stacks', tooltipDecimal)
      ]
    ),
    [TRAIT.MIGHT_MAKES_RIGHT]: outsideScopeTooltip,
    [TRAIT.AGGRESSIVE_ONSLAUGHT]: traitTooltip(
      'Applying a player control effect grants quickness.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.MARCHING_ORDERS]: traitTooltip(
      "The first eligible burst hit activates Soldier's Focus and grants might to the party.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', "Soldier's Focus cooldown", tooltipSeconds)
      ]
    ),
    [TRAIT.EMPOWERED]: traitTooltip(
      'Deal increased strike damage for each different boon on you.',
      (balanceContext) => [modifierFact(balanceContext, 'warrior.empowered', 'damagePerBoon', 'Strike damage per boon')]
    ),
    [TRAIT.MENDING_MIGHT]: outsideScopeTooltip,
    [TRAIT.LEG_SPECIALIST]: traitTooltip(
      'Cripple applications also immobilize. Deal increased strike damage to crippled, chilled, or immobilized targets.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'warrior.leg-specialist',
          'factor',
          'Strike damage against affected targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.SOLDIERS_COMFORT]: traitTooltip(
      "Soldier's Focus grants protection to the party. Healing is outside combat simulation scope."
    ),
    [TRAIT.ROARING_REVEILLE]: traitTooltip('Gain concentration.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'attributeBonus', 'Concentration')
    ]),
    [TRAIT.WARRIORS_CUNNING]: traitTooltip(
      'Deal increased strike damage while the target is above the high-health threshold.',
      (balanceContext) => [
        modifierFact(balanceContext, 'warrior.warriors-cunning', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.SHRUG_IT_OFF]: outsideScopeTooltip,
    [TRAIT.EMPOWER_ALLIES]: traitTooltip('Periodically grant might to the party.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'pulseInterval', 'Pulse interval', tooltipSeconds)
    ]),
    [TRAIT.MARTIAL_CADENCE]: traitTooltip(
      "Soldier's Focus grants stability to the party. Weapon swaps make Soldier's Focus ready again."
    ),
    // Healing-only traits have no build or runtime effects in combat simulation.
    [TRAIT.VIGOROUS_SHOUTS]: outsideScopeTooltip,
    [TRAIT.PHALANX_STRENGTH]: outsideScopeTooltip,
    [TRAIT.THICK_SKIN]: traitTooltip('Starting a healing skill grants protection.'),
    [TRAIT.ADRENAL_HEALTH]: outsideScopeTooltip,
    [TRAIT.HARDENED_ARMOR]: outsideScopeTooltip,
    [TRAIT.SHIELD_MASTER]: outsideScopeTooltip,
    [TRAIT.DOGGED_MARCH]: outsideScopeTooltip,
    [TRAIT.CULL_THE_WEAK]: traitTooltip(
      'A qualifying burst hit inflicts weakness. Deal increased strike damage to weakened targets.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'warrior.cull-the-weak',
          'factor',
          'Strike damage against weakened targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.DEFY_PAIN]: outsideScopeTooltip,
    [TRAIT.RESILIENT_ROLL]: outsideScopeTooltip,
    [TRAIT.MERCILESS_HAMMER]: traitTooltip(
      'Player control effects grant adrenaline. Hammer and mace strikes deal increased damage to controlled or defiant targets.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Adrenaline gained'),
        modifierFact(
          balanceContext,
          'warrior.merciless-hammer',
          'factor',
          'Hammer and mace strike damage',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.LAST_STAND]: outsideScopeTooltip,
    [TRAIT.CLEANSING_IRE]: outsideScopeTooltip,
    [TRAIT.STALWART_STRENGTH]: traitTooltip(
      'Player control effects grant stability. Deal increased strike damage while you have stability.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        modifierFact(
          balanceContext,
          'warrior.stalwart-strength',
          'factor',
          'Strike damage with stability',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.FURIOUS_BURST]: traitTooltip(
      'Weapon swapping grants fury. Fury grants additional critical-strike chance.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        profileFact(
          balanceContext,
          TRAIT.FURIOUS_BURST,
          'criticalChance',
          'Additional critical chance with fury',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.DEEP_STRIKES]: traitTooltip(
      'Gain condition damage while you have fury and critical-strike chance against bleeding targets.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Condition damage with fury'),
        profileFact(
          balanceContext,
          TRAIT.DEEP_STRIKES,
          'criticalChance',
          'Critical chance against bleeding targets',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.BLOODLUST]: traitTooltip(
      'Eligible critical hits can inflict bleeding. Bleeding lasts longer.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'procChance', 'Chance on critical hit', tooltipPercent)]
    ),
    [TRAIT.WOUNDING_PRECISION]: traitTooltip('Gain expertise from eligible precision.', (balanceContext, id) => [
      profileFact(
        balanceContext,
        id,
        'attributeConversion',
        'Eligible precision converted to expertise',
        tooltipPercent
      )
    ]),
    [TRAIT.SIGNET_MASTERY]: traitTooltip(
      "Activating signets grants stacking ferocity. A qualifying strike below the target's half-health threshold triggers Lesser Signet of Might.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Ferocity per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        profileFact(balanceContext, id, 'internalCooldown', 'Lesser Signet of Might cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.OPPORTUNIST]: traitTooltip(
      'Player control or immobilize applications grant adrenaline and fury.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Adrenaline gained'),
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.UNSUSPECTING_FOE]: traitTooltip(
      'Gain critical-strike chance against controlled or defiant targets.',
      (balanceContext) => [
        profileFact(balanceContext, TRAIT.UNSUSPECTING_FOE, 'criticalChance', 'Critical chance', tooltipPercent)
      ]
    ),
    [TRAIT.SUNDERING_BURST]: (balanceContext, entity) => {
      const profile = tooltipProfile(balanceContext, entity.id);
      return {
        description:
          'The first burst hit inflicts vulnerability. A critical hit uses the stronger application instead.',
        facts: [
          profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
          ...(profile.effects || []).flatMap(
            (effect, index) => simulationEffectFacts([effect], index === 0 ? 'noncritical hit' : 'critical hit').facts
          )
        ]
      };
    },
    [TRAIT.BLADEMASTER]: traitTooltip(
      'Gain expertise. Wielding a sword also grants condition damage.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'attributeBonus', 'Expertise / sword condition damage')]
    ),
    [TRAIT.BURST_PRECISION]: traitTooltip(
      'Burst hits gain critical-strike chance and open a temporary critical-chance and ferocity window. The highest adrenaline tier grants the longer window.',
      (balanceContext, id) => [
        profileFact(balanceContext, TRAIT.BURST_PRECISION, 'criticalChance', 'Critical chance', tooltipPercent),
        profileFact(balanceContext, id, 'attributeBonus', 'Ferocity during the window'),
        profileFact(balanceContext, id, 'minimumStacks', 'Base window', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumStacks', 'Highest-tier window', tooltipSeconds)
      ]
    ),
    [TRAIT.FURIOUS]: traitTooltip(
      'Eligible critical hits grant adrenaline and stacking condition damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'resourceGain', 'Adrenaline per critical hit'),
        profileFact(balanceContext, id, 'attributeBonus', 'Condition damage per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks')
      ]
    ),
    [TRAIT.DUAL_WIELDING]: traitTooltip(
      'Skills with measured Dual Wielding timings cast faster while using an eligible offhand weapon.'
    ),
    [TRAIT.VERSATILE_RAGE]: traitTooltip('Weapon swapping grants adrenaline.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Adrenaline per weapon swap')
    ]),
    [TRAIT.FAST_HANDS]: outsideScopeTooltip,
    [TRAIT.VERSATILE_POWER]: traitTooltip('Burst skills recharge faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'rechargeMultiplier', 'Burst recharge reduction', (value) =>
        tooltipPercent(1 - value)
      )
    ]),
    [TRAIT.CRACK_SHOT]: outsideScopeTooltip,
    [TRAIT.WARRIORS_SPRINT]: traitTooltip(
      'Deal increased strike damage while you have swiftness.',
      (balanceContext) => [
        modifierFact(balanceContext, 'warrior.warriors-sprint', 'amount', 'Strike damage with swiftness')
      ]
    ),
    [TRAIT.STALWART_FOCUS]: outsideScopeTooltip,
    [TRAIT.DOUBLED_STANDARDS]: outsideScopeTooltip,
    [TRAIT.DESTRUCTION_OF_THE_EMPOWERED]: outsideScopeTooltip,
    [TRAIT.BRAWLERS_RECOVERY]: outsideScopeTooltip,
    [TRAIT.AXE_MASTERY]: traitTooltip(
      'Gain ferocity, with an additional bonus while wielding an axe. Eligible axe critical hits grant adrenaline.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Ferocity'),
        profileFact(balanceContext, id, 'weaponAttributeBonus', 'Total ferocity while wielding an axe'),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Axe recharge reduction', (value) =>
          tooltipPercent(1 - value)
        ),
        profileFact(balanceContext, id, 'resourceGain', 'Adrenaline per axe critical hit')
      ]
    ),
    [TRAIT.HEIGHTENED_FOCUS]: outsideScopeTooltip,
    [TRAIT.BURST_MASTERY]: traitTooltip(
      'Bursts deal increased strike damage. Completing a burst refunds part of the resource spent and grants swiftness.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'warrior.burst-mastery', 'factor', 'Burst strike damage', tooltipFactorChange),
        profileFact(balanceContext, id, 'resourceGain', 'Resource refunded', tooltipPercent)
      ]
    ),
    [TRAIT.PRIMAL_RAGE]: traitTooltip(
      'Unlock Berserk and primal bursts. Primal bursts replace ordinary bursts while Berserk is active.'
    ),
    [TRAIT.BURST_OF_AGGRESSION]: traitTooltip('Entering Berserk grants quickness and fury.'),
    [TRAIT.FATAL_FRENZY]: traitTooltip('Berserk grants power and condition damage.', (balanceContext) => [
      profileFact(balanceContext, 'warrior.berserker.resources', 'attributeBonus', 'Power during Berserk'),
      profileFact(balanceContext, 'warrior.berserker.resources', 'attributePerStack', 'Condition damage during Berserk')
    ]),
    [TRAIT.SMASH_BRAWLER]: traitTooltip(
      'Gain critical-strike chance during Berserk. Completing primal bursts extends Berserk; Decapitate uses a shorter extension.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          TRAIT.SMASH_BRAWLER,
          'criticalChance',
          'Critical chance during Berserk',
          tooltipPercent
        ),
        profileFact(balanceContext, id, 'resourceGain', 'Primal-burst extension', tooltipSeconds),
        profileFact(balanceContext, id, 'minimumStacks', 'Decapitate extension', tooltipSeconds)
      ]
    ),
    [TRAIT.LAST_BLAZE]: traitTooltip(
      'Completed Rage skills inflict burning. Rage skills other than Outrage additionally extend an active Berserk window.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Additional Berserk extension', tooltipSeconds)
      ]
    ),
    [TRAIT.SAVAGE_INSTINCT]: outsideScopeTooltip,
    [TRAIT.BLOOD_REACTION]: traitTooltip(
      'Gain ferocity from precision and condition damage from power. The conversion is stronger during Berserk.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeConversion', 'Base conversion', tooltipPercent),
        profileFact(balanceContext, id, 'coefficientMultiplier', 'Conversion during Berserk', tooltipPercent)
      ]
    ),
    [TRAIT.HEAT_THE_SOUL]: traitTooltip(
      'Completed primal bursts grant quickness, fury, and might to the party. Decapitate grants a shorter quickness duration.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.SMASH_BRAWLER,
          'resourceGain',
          'Decapitate quickness duration',
          tooltipSeconds
        )
      ]
    ),
    [TRAIT.DEAD_OR_ALIVE]: outsideScopeTooltip,
    [TRAIT.BLOODY_ROAR]: traitTooltip(
      'Deal increased strike damage during Berserk. Entering Berserk grants resistance.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'warrior.bloody-roar',
          'factor',
          'Strike damage during Berserk',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.KING_OF_FIRES]: traitTooltip(
      'Burning lasts longer. Eligible critical hits grant a fire aura; completing a Berserker skill detonates an active aura to strike and burn the target.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Aura-grant cooldown', tooltipSeconds),
        profileFact(balanceContext, id, 'durationMultiplier', 'Burning duration', tooltipPercent)
      ]
    ),
    [TRAIT.ETERNAL_CHAMPION]: outsideScopeTooltip,
    [TRAIT.SPELLBREAKERS_CONVICTION]: traitTooltip('Unlock Full Counter and the Spellbreaker adrenaline limit.'),
    [TRAIT.DISPELLING_FORCE]: outsideScopeTooltip,
    [TRAIT.ATTACKERS_INSIGHT]: traitTooltip(
      'Player control effects grant stacking power, precision, and ferocity. Kick grants additional stacks against a defiant target.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributePerStack', 'Each attribute per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks')
      ]
    ),
    [TRAIT.PURE_STRIKE]: traitTooltip(
      'Critical strikes deal increased damage. Target boons are absent in this simulation.',
      (balanceContext) => [
        profileFact(balanceContext, TRAIT.PURE_STRIKE, 'criticalDamage', 'Critical damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.GUARD_COUNTER]: outsideScopeTooltip,
    [TRAIT.NO_ESCAPE]: traitTooltip('Player daze and stun applications also immobilize.'),
    [TRAIT.LOSS_AVERSION]: outsideScopeTooltip,
    [TRAIT.RESILIENT_COUNTER]: outsideScopeTooltip,
    [TRAIT.SUN_AND_MOON_STYLE]: traitTooltip(
      'Deal increased strike damage while wielding a main-hand dagger.',
      (balanceContext) => [
        modifierFact(balanceContext, 'warrior.sun-and-moon-style', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.ENCHANTMENT_COLLAPSE]: outsideScopeTooltip,
    [TRAIT.RESOLUTE_COUNTER]: outsideScopeTooltip,
    [TRAIT.MAGEBANE_TETHER]: traitTooltip(
      'Qualifying burst hits tether the target, increasing strike damage while the tether lasts. Alacrity shortens its recharge.',
      (balanceContext, id) => [
        modifierFact(
          balanceContext,
          'warrior.magebane-tether',
          'factor',
          'Strike damage while tethered',
          tooltipFactorChange
        ),
        profileFact(balanceContext, id, 'cooldown', 'Base tether recharge', tooltipSeconds)
      ]
    ),
    [TRAIT.GUN_X_SWORD]: traitTooltip(
      'Replace adrenaline with flow. Unlock the gunsaber, Dragon Trigger, and charged Dragon Slash attacks.'
    ),
    [TRAIT.DRAGONSCALE_DEFENSE]: traitTooltip('Entering Dragon Trigger grants stability.'),
    [TRAIT.GUNS_AND_GLORY]: traitTooltip(
      'Qualifying explosions extend a temporary ferocity bonus, up to its duration cap.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Ferocity'),
        profileFact(balanceContext, id, 'resourceGain', 'Duration added per explosion', tooltipSeconds),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum remaining duration', tooltipSeconds)
      ]
    ),
    [TRAIT.UNSEEN_SWORD]: traitTooltip(
      'Entering gunsaber in combat strikes the target and opens a positive-flow window.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Entry-trait cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.SHARP_AS_THE_WIND]: traitTooltip(
      'Entering gunsaber in combat inflicts burning and grants positive flow. Supported gunsaber and Dragon Slash skills use their burning variants.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Entry-trait cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.RIVERS_FLOW]: traitTooltip(
      'Entering gunsaber in combat grants might to the party and opens a positive-flow window.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Entry-trait cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.UNSHAKABLE_MOUNTAIN]: outsideScopeTooltip,
    [TRAIT.FIERCE_AS_FIRE]: traitTooltip(
      'Spending ammunition grants damage-bonus stacks, one per round spent.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'warrior.fierce-as-fire',
          'damagePerStack',
          'Strike and condition damage per stack'
        ),
        modifierFact(balanceContext, 'warrior.fierce-as-fire', 'maximumStacks', 'Maximum stacks', tooltipDecimal)
      ]
    ),
    [TRAIT.LUSH_FOREST]: traitTooltip(
      'Spending ammunition from a fully loaded skill reduces eligible active-bar cooldowns. Gunsaber swaps, Dragon Trigger, and Artillery Slash are excluded.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeReduction', 'Recharge reduction', tooltipSeconds)
      ]
    ),
    [TRAIT.IMMORTAL_DRAGON]: outsideScopeTooltip,
    [TRAIT.UNYIELDING_DRAGON]: traitTooltip(
      'Dragon Slash applies a stun control event, triggering supported control-dependent traits.'
    ),
    [TRAIT.DARING_DRAGON]: traitTooltip(
      'Dragon Trigger charges with fewer bullets and spends more flow per bullet. Releasing Dragon Slash grants alacrity to the party.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          BLADESWORN.dragonTrigger,
          'minimumStacks',
          'Maximum Dragon Trigger charges with Daring Dragon'
        ),
        profileFact(
          balanceContext,
          BLADESWORN.dragonTrigger,
          'maximumStacks',
          'Maximum Dragon Trigger charges without Daring Dragon'
        ),
        profileFact(
          balanceContext,
          id,
          'resourceCostMultiplier',
          'Flow cost per charge multiplier',
          (value) => `${tooltipDecimal(value)}×`
        )
      ]
    ),
    [TRAIT.RALLY_THE_VALIANT]: traitTooltip(
      'Starting a non-chant burst while a refrain is active grants motivation.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Motivation gained')]
    ),
    [TRAIT.INSPIRING_IMPLEMENTS]: traitTooltip(
      'Gain concentration. Weapon swapping grants adrenaline and motivation.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Concentration'),
        profileFact(balanceContext, id, 'resourceGain', 'Adrenaline gained'),
        profileFact(balanceContext, id, 'minimumStacks', 'Motivation gained'),
        profileFact(balanceContext, id, 'internalCooldown', 'Swap-reward cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.UNYIELDING_RESOLVE]: outsideScopeTooltip,
    [TRAIT.CALL_TO_ACTION]: traitTooltip(
      'Entering combat grants motivation and starts Chant of Action if no refrain is active.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Motivation gained')]
    ),
    [TRAIT.CALMING_TONGUE]: outsideScopeTooltip,
    [TRAIT.LIBERATING_LIAISE]: outsideScopeTooltip,
    [TRAIT.STRENGTHENING_STANZAS]: traitTooltip(
      'Deal increased damage while Chant of Action is the active refrain.',
      (balanceContext) => [
        modifierFact(balanceContext, 'warrior.strengthening-stanzas', 'strikeBonus', 'Strike damage'),
        modifierFact(balanceContext, 'warrior.strengthening-stanzas', 'conditionBonus', 'Condition damage')
      ]
    ),
    [TRAIT.INVIGORATING_TEMPO]: traitTooltip(
      'Refrain pulses grant adrenaline for the motivation actually spent.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Adrenaline per motivation spent')]
    ),
    [TRAIT.REVERBERATION]: traitTooltip(
      'Commands queue additional echoes. Bursts consume pending echoes immediately.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'maximumStacks', 'Echo count')]
    ),
    [TRAIT.FEVERISH_PULSE]: traitTooltip(
      'Activating a chant grants party alacrity and reduces the recharge of the other chants.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeReduction', 'Other-chant recharge reduction', tooltipSeconds)
      ]
    ),
    [TRAIT.BRISK_PACING]: traitTooltip(
      'Motivation increases strike and condition damage. Higher motivation tiers replace the lower-tier bonuses.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'warrior.brisk-pacing',
          'middleThreshold',
          'Middle-tier motivation',
          tooltipDecimal
        ),
        modifierFact(balanceContext, 'warrior.brisk-pacing', 'highThreshold', 'High-tier motivation', tooltipDecimal),
        ...(['Low', 'Middle', 'High'] as const).flatMap((tier) => [
          modifierFact(balanceContext, 'warrior.brisk-pacing', `strike${tier}`, `${tier}-tier strike damage`),
          modifierFact(balanceContext, 'warrior.brisk-pacing', `condition${tier}`, `${tier}-tier condition damage`)
        ])
      ]
    ),
    [TRAIT.ENDURING_REFRAIN]: traitTooltip(
      'Chants grant additional motivation. Chant of Action refrain pulses grant additional might according to the motivation tier.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Additional motivation')]
    )
  }
};
