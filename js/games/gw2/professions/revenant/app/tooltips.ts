import {
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileTooltip,
  profileFact,
  modifierFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RENEGADE_PROFILE_IDS as RENEGADE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { CONDUIT_BALANCE_PROFILE_IDS as CONDUIT } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/revenant/core/profiles.js';
import { VINDICATOR_BALANCE_PROFILE_IDS as VINDICATOR } from '#gw2/professions/revenant/specializations/vindicator/profiles.js';
import { HERALD_NATURE_ASSASSIN_PROFILE_ID } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { VINDICATOR_DODGE_AUTO_ACTION } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';

/** Keep legend and trigger variants distinct; metadata provides identity, while these local labels provide prose. */
function variantFacts(effects: readonly SkillEffect[] = [], context = '') {
  const labels: Readonly<Record<string, string>> = {
    LegendaryAssassin: 'Assassin',
    LegendaryDemon: 'Demon',
    LegendaryDwarf: 'Dwarf',
    LegendaryCentaur: 'Centaur',
    LegendaryEntity: 'Entity',
    'entity-skill': 'using an Entity skill',
    'beguiling-haze': 'Beguiling Haze',
    'hex-eater-vortex': 'Hex Eater Vortex',
    'gladiators-defense': "Gladiator's Defense",
    'twin-moon-sweep': 'Twin Moon Sweep',
    'diabolic-inferno': 'requires Diabolic Inferno'
  };
  return effects.flatMap((effect) => {
    const key = effect.metadata?.legendId ?? effect.metadata?.trigger;
    const qualifier = typeof key === 'string' ? labels[key] : '';
    if (key != null && !qualifier) throw new Error(`Unknown Revenant tooltip variant: ${String(key)}`);
    return simulationEffectFacts([effect], [context, qualifier].filter(Boolean).join(' · ')).facts;
  });
}

/** Local Revenant explanations reference the same trait and mechanic profiles used by legend and form handlers. */
export const revenantTooltips: ProfessionTooltips = {
  skillFacts: (_c, entity) => [
    ...[
      ['energyCost', 'Base energy cost'],
      ['upkeepCost', 'Energy upkeep per second'],
      ['resourceCost', 'Endurance spent']
    ].flatMap(([field, name]) =>
      entity[field] == null ? [] : [{ name, detail: tooltipDecimal(tooltipNumber(entity, field)) }]
    ),
    ...(entity.manualReleaseCooldown == null
      ? []
      : [{ name: 'Manual release cooldown', detail: tooltipSeconds(tooltipNumber(entity, 'manualReleaseCooldown')) }]),
    ...(entity.starvationCooldown == null
      ? []
      : [{ name: 'Energy exhaustion cooldown', detail: tooltipSeconds(tooltipNumber(entity, 'starvationCooldown')) }])
  ],
  handlers: {
    'revenant.weapon-swap': skillTooltip(
      'Switch weapon sets. At maximum Crushing Abyss, swapping to a different weapon loadout consumes the stacks and triggers Abyssal Raze. The triggered strike uses its base coefficient and retains the stack-scaled torment.'
    ),
    'revenant.legend-swap': skillTooltip(
      'Invoke your other equipped legend and reset energy. Ordinary upkeep skills stop; Facet of Nature can continue across legends. Combat invocation traits and swap sigils apply.',
      (balanceContext, entity) => [
        { name: 'Energy after invoking', detail: tooltipDecimal(tooltipNumber(entity, 'resourceGain')) },
        profileFact(balanceContext, CORE.chargedMists, 'resourceGain', 'Energy with Charged Mists'),
        profileFact(
          balanceContext,
          CORE.chargedMists,
          'threshold',
          'Charged Mists threshold: previous energy rounded down'
        )
      ]
    ),
    'revenant.dodge': skillTooltip(
      'Spend endurance to dodge. Vindicator also applies the grandmaster-selected landing package; other specializations only apply their supported dodge-related traits. Incoming damage is outside simulation scope.'
    ),
    'revenant.vindicator-jump': (balanceContext) => ({
      description:
        "Spend endurance to leap, then apply the landing selected by your grandmaster trait. Reaver's Curse can empower the next landing. Death Drop starts its Forerunner of Death bonus after its own damage resolves.",
      facts: [ID.DEATH_DROP, ID.IMPERIAL_IMPACT, ID.SAINTS_SHIELD].flatMap((id) => {
        const landing = balanceContext.catalog.skillsById.get(id)!;
        return simulationEffectFacts(landing.effects, `${landing.name}: alternative landing`).facts;
      })
    }),
    'revenant.ancient-echo': (balanceContext, entity) => ({
      description: 'Restore energy and apply only the package matching your active core legend.',
      facts: [
        ...variantFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects),
        {
          name: 'Energy restored',
          detail: tooltipDecimal(tooltipNumber(balanceContext.catalog.skillsById.get(entity.id)!, 'resourceGain'))
        }
      ]
    }),
    'revenant.upkeep': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id)! as RevenantSkill;
      const pulse = selected.upkeepPulse;
      return {
        description: pulse
          ? 'Maintain this facet to pulse its boon to your party while draining energy. Its consume skill stops the upkeep. Draconic Echo can retain the passive temporarily after consumption.'
          : 'Maintain this skill while draining energy. Its recurring effects stop when the upkeep ends or energy is exhausted.',
        facts: [
          ...simulationEffectFacts(selected.effects, 'per upkeep pulse').facts,
          ...(pulse
            ? simulationEffectFacts(
                [
                  {
                    type: 'boon',
                    boon: pulse.kind,
                    duration: pulse.duration,
                    stacks: pulse.stacks,
                    audience: { recipients: 'party', maximumRecipients: 5 }
                  }
                ],
                'per upkeep pulse'
              ).facts
            : []),
          ...(selected.pulseInterval == null
            ? []
            : [{ name: 'Pulse interval', detail: tooltipSeconds(selected.pulseInterval) }])
        ]
      };
    },
    'revenant.upkeep-release': skillTooltip(
      "End the parent skill's upkeep and stop its recurring effects.",
      (balanceContext, entity) => {
        const parent =
          entity.flipParentId == null ? undefined : balanceContext.catalog.skillsById.get(entity.flipParentId);
        return parent?.manualReleaseCooldown == null
          ? []
          : [
              {
                name: 'Parent cooldown on release',
                detail: tooltipSeconds(tooltipNumber(parent, 'manualReleaseCooldown'))
              }
            ];
      }
    ),
    'revenant.facet-consume': skillTooltip(
      'Consume the active facet to perform this skill and stop its energy upkeep. Its cooldown belongs to the parent facet. Draconic Echo can retain the passive after consumption.'
    ),
    'revenant.enchanted-daggers': (balanceContext, entity) => ({
      description:
        'Prepare a finite set of enchanted daggers. Qualifying player strikes consume one ready, unexpired charge for additional life-siphon damage. Siphons cannot critically strike.',
      facts: (balanceContext.catalog.skillsById.get(entity.id)!.effects || []).flatMap(
        (effect) =>
          simulationEffectFacts(
            [{ ...effect, ...(effect.type === 'strike' ? { noCrit: true } : {}) }],
            effect.type === 'strike' ? 'per consumed charge' : ''
          ).facts
      )
    }),
    'revenant.band-together': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id)!;
      const enhanced = balanceContext.catalog.skillsById.get(RENEGADE_ENHANCED_SKILL_BY_ID[Number(entity.id)])!;
      return {
        description:
          'Call a warband member. An ordinary cast primes Band Together; the next supported warband skill within its window consumes the enhancement and uses its enhanced package instead. Enhanced casts do not prime another enhancement.' +
          (selected.id === ID.RAZORCLAWS_RAGE
            ? ' Razorclaw grants finite bleeding charges to you and the assumed attacking allies.'
            : ''),
        facts: [
          ...simulationEffectFacts(selected.effects, 'ordinary cast').facts,
          ...simulationEffectFacts(enhanced.effects, 'enhanced cast instead').facts,
          ...simulationEffectFacts(tooltipProfile(balanceContext, RENEGADE.bandTogether).effects).facts,
          ...(selected.id === ID.RAZORCLAWS_RAGE
            ? [
                ...simulationEffectFacts(
                  balanceContext.catalog.skillsById.get(RENEGADE.razorclawsRageProc)!.effects,
                  'per charge consumed'
                ).facts,
                {
                  name: 'Bleed trigger cooldown',
                  detail: tooltipSeconds(
                    tooltipNumber(balanceContext.catalog.skillsById.get(RENEGADE.razorclawsRageProc)!, 'cooldown')
                  )
                }
              ]
            : [])
        ]
      };
    },
    'revenant.heroic-command': (balanceContext, entity) => ({
      description:
        "Refresh your active Kalla's Fervor stacks and grant might for each stack. Lasting Legacy replaces the base might amount. With no active Fervor, this grants no might.",
      facts: [
        ...simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'per Fervor stack').facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, RENEGADE.heroicCommandLastingLegacy).effects,
          'per Fervor stack with Lasting Legacy instead'
        ).facts
      ]
    }),
    'revenant.orders-from-above': (balanceContext, entity) => ({
      description:
        'Pulse alacrity. Righteous Rebel replaces the base pulse package; together with Bold Reversal it also adds protection.',
      facts: [
        ...simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'base pulses').facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, RENEGADE.ordersFromAboveRighteousRebel).effects,
          'with Righteous Rebel instead'
        ).facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, RENEGADE.boldReversalRighteousRebel).effects,
          'additional pulses with both Righteous Rebel and Bold Reversal'
        ).facts
      ]
    }),
    'revenant.spear-recharge': skillTooltip(
      "Attack and reduce Abyssal Raze's ammunition recharge when this skill's first damage packet lands.",
      (_c, entity) => [
        { name: 'Abyssal Raze recharge reduction', detail: tooltipSeconds(tooltipNumber(entity, 'rechargeReduction')) }
      ]
    ),
    'revenant.abyssal-raze': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id)!;
      const strike = selected.effects!.find((effect) => effect.type === 'strike')!;
      return {
        description:
          'Strike and inflict torment, increasing damage and adding torment for each Crushing Abyss stack already active at impact. Then gain a stack if below the cap. At the cap, swapping to a different weapon loadout consumes the stacks for an additional Raze with base strike damage.',
        facts: [
          ...simulationEffectFacts(
            selected.effects!.filter((effect) => !effect.metadata?.trigger),
            'base cast'
          ).facts,
          ...simulationEffectFacts(
            selected.effects!.filter((effect) => effect.metadata?.trigger === 'crushing-abyss'),
            'additional torment per Crushing Abyss stack'
          ).facts,
          {
            name: 'Strike damage per Crushing Abyss stack',
            detail: tooltipPercent(tooltipNumber(strike, 'damageIncreasePerStack'))
          },
          { name: 'Maximum Crushing Abyss stacks', detail: tooltipDecimal(tooltipNumber(selected, 'maximumStacks')) }
        ]
      };
    },
    'revenant.blossoming-aura': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id)!;
      const final = selected.effects!.find((effect) => effect.type === 'strike' && effect.name === 'Final Damage')!;
      return {
        description:
          "Attach an aura that pulses damage, then detonates and weakens the target. Detonating early cancels remaining pulses. The final strike grows with elapsed pulse intervals, up to the engine's detonation cap.",
        facts: [
          ...simulationEffectFacts(selected.effects, 'complete aura; final strike shown before growth').facts,
          { name: 'Aura duration', detail: tooltipSeconds(tooltipNumber(selected, 'duration')) },
          { name: 'Pulse interval', detail: tooltipSeconds(tooltipNumber(selected, 'pulseInterval')) },
          {
            name: 'Final damage increase per elapsed interval',
            detail: tooltipPercent(tooltipNumber(final, 'damageIncreasePerStack'))
          }
        ]
      };
    },
    'revenant.detonate-blossoming-aura': skillTooltip(
      'Detonate your active Blossoming Aura immediately. Its final damage scales with elapsed pulse intervals, applies weakness, and cancels remaining pulses.',
      (balanceContext) =>
        simulationEffectFacts(
          balanceContext.catalog.skillsById
            .get(ID.BLOSSOMING_AURA)!
            .effects?.filter((effect) => effect.name !== 'Pulsing Damage'),
          'base detonation before elapsed-interval scaling'
        ).facts
    ),
    'revenant.beguiling-haze': (balanceContext, entity) => ({
      description:
        'Strike and prepare follow-up charges. Each follow-up costs no energy and uses its smaller attack. The original main-cast recharge resumes after the charges are spent. Shared Wisdom grants its matching boon.',
      facts: [
        ...simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'main cast').facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, CONDUIT.beguilingHazeFollowUp).effects,
          'per follow-up instead'
        ).facts,
        profileFact(balanceContext, CONDUIT.beguilingHazeFollowUp, 'maximumStacks', 'Follow-up charges')
      ]
    }),
    'revenant.hex-eater-vortex': (balanceContext, entity) => ({
      description:
        'Remove conditions from yourself and fire a tormenting projectile for each removed condition, up to the authored projectile limit. Equipping Demon fires the full salvo even without self-conditions. Shared Wisdom grants its matching boon.',
      facts: simulationEffectFacts(
        balanceContext.catalog.skillsById.get(entity.id)!.effects,
        'maximum salvo; fewer projectiles without Demon or enough self-conditions'
      ).facts
    }),
    'revenant.gladiators-defense': skillTooltip(
      'Strike, weaken the target, and gain the listed boons when this action completes. Shared Wisdom adds its matching boon. Incoming attacks are not required to produce these simulated effects.'
    ),
    'revenant.twin-moon-sweep': (balanceContext, entity) => ({
      description:
        'You and a fragment strike together, applying bleeding and might. Both attacks are player-owned. Equipped Assassin adds immobilization; equipped Demon adds later shatter and confusion packets. Gain affinity once from the main hit; Shared Wisdom adds might.',
      facts: variantFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects)
    }),
    'revenant.cosmic-wisdom': skillTooltip(
      'Enter the form associated with your active legend. Swapping legends changes the form during the window. Assassin triggers lesser daggers; Dervish triggers scythe attacks from Entity skills; Mesmer changes Demon skill costs. Affinity and Conduit traits modify these effects.',
      (balanceContext) => [
        ...simulationEffectFacts(
          balanceContext.catalog.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS)!.effects,
          'Assassin form: per dagger trigger'
        ).facts,
        ...simulationEffectFacts(
          balanceContext.catalog.skillsById.get(ID.FORM_OF_THE_DERVISH_ATTACK)!.effects,
          'Dervish form: per Entity cast'
        ).facts,
        ...simulationEffectFacts(
          balanceContext.catalog.skillsById.get(ID.FORM_OF_THE_DERVISH_ATTACK_ELITE)!.effects,
          'Dervish form: additional Twin Moon Sweep attack'
        ).facts
      ]
    ),
    'revenant.release-potential': (balanceContext, entity) => {
      const selected = balanceContext.catalog.skillsById.get(entity.id)!;
      const conditions = selected.effects?.filter((effect) => effect.type === 'condition') || [];
      return {
        description:
          "Release the power of your current form. Affinity increases the listed enemy-condition durations and reduces Mesmer's self-torment duration. Dervish gains its legend-specific effects from an equipped matching legend or sufficient affinity. Kinetic Insight adds virtual affinity for these calculations without spending your actual affinity.",
        facts: [
          ...variantFacts(selected.effects, 'base values before affinity scaling'),
          ...conditions.flatMap((effect) => [
            ...(effect.durationPerAffinity == null
              ? []
              : [
                  {
                    name: `${effect.condition} duration per affinity`,
                    detail: tooltipPercent(tooltipNumber(effect, 'durationPerAffinity'))
                  }
                ]),
            ...(effect.durationReductionPerAffinity == null
              ? []
              : [
                  {
                    name: 'Self-torment duration reduction per affinity',
                    detail: tooltipPercent(-tooltipNumber(effect, 'durationReductionPerAffinity'))
                  }
                ])
          ]),
          ...(selected.id === ID.RELEASE_POTENTIAL_DERVISH
            ? [
                profileFact(
                  balanceContext,
                  CONDUIT.affinity,
                  'minimumStacks',
                  'Affinity for all Dervish legend effects'
                )
              ]
            : [])
        ]
      };
    }
  },
  skills: {
    [VINDICATOR_DODGE_AUTO_ACTION]: () => ({
      description:
        'Start a Vindicator dodge and the current autoattack together. Endurance is spent at takeoff; the grandmaster-selected landing occurs after the airborne phase.',
      facts: []
    }),
    [ID.EMBRACE_THE_DARKNESS]: (balanceContext, entity) => ({
      description:
        'Maintain a damaging aura that drains energy and pulses torment. Completing a skill that costs energy, including this activation, empowers the next torment pulse. Normal and empowered torment are alternatives; pulses do not empower themselves.',
      facts: [
        ...(balanceContext.catalog.skillsById.get(entity.id)!.effects || []).flatMap(
          (effect) =>
            simulationEffectFacts(
              [effect],
              effect.metadata?.trigger ? 'empowered pulse instead of normal torment' : 'normal pulse'
            ).facts
        ),
        {
          name: 'Pulse interval',
          detail: tooltipSeconds(tooltipNumber(balanceContext.catalog.skillsById.get(entity.id)!, 'pulseInterval'))
        }
      ]
    }),
    [ID.IMPOSSIBLE_ODDS]: skillTooltip(
      'Maintain upkeep to trigger an additional strike after eligible player-owned hits, subject to its trigger cooldown. These follow-ups cannot trigger themselves.',
      (_c, entity) => [
        { name: 'Trigger cooldown', detail: tooltipSeconds(tooltipNumber(entity, 'triggerIntervalMs') / 1000) }
      ]
    ),
    [ID.FACET_OF_NATURE]: skillTooltip(
      'Maintain a passive tied to the active legend. Dragon extends outgoing boon duration beyond its normal cap; Assassin adds life siphons to player strikes. The upkeep persists through legend swaps and exposes the matching True Nature consume. Draconic Echo can retain its passive.',
      (balanceContext) => [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, HERALD_NATURE_ASSASSIN_PROFILE_ID).effects,
          'Assassin: per eligible strike'
        ).facts,
        profileFact(
          balanceContext,
          HERALD_NATURE_ASSASSIN_PROFILE_ID,
          'cooldown',
          'Assassin siphon cooldown',
          tooltipSeconds
        )
      ]
    ),
    [ID.TRUE_NATURE_DRAGON]: (balanceContext, entity) => {
      const extension = balanceContext.catalog.skillsById
        .get(entity.id)!
        .effects?.find((effect) => effect.type === 'custom');
      return {
        description:
          'Consume Facet of Nature to extend existing party boons. The consume ends upkeep and starts the shared facet cooldown; Draconic Echo can retain its passive.',
        facts: [{ name: 'Party boon extension', detail: tooltipSeconds(tooltipNumber(extension?.event, 'duration')) }]
      };
    },
    [ID.SOULCLEAVES_SUMMIT]: skillTooltip(
      "Maintain Soulcleave's upkeep. Eligible attacks trigger additional life-siphon damage with an internal cooldown. The simulation also includes the configured allied attackers; Kalla's Fervor increases the siphon damage.",
      (balanceContext) => [
        ...simulationEffectFacts(
          balanceContext.catalog.skillsById.get(RENEGADE.soulcleavesSummitProc)!.effects,
          'per eligible attack'
        ).facts,
        {
          name: 'Siphon trigger cooldown',
          detail: tooltipSeconds(
            tooltipNumber(balanceContext.catalog.skillsById.get(RENEGADE.soulcleavesSummitProc)!, 'cooldown')
          )
        }
      ]
    ),
    [ID.DROP_THE_HAMMER]: skillTooltip(
      'Drop a hammer that strikes and controls your target. Its damage impact resets Coalescence of Ruin.'
    ),
    [ID.CALL_TO_ANGUISH]: skillTooltip(
      'Leap to your target and apply the listed effects. Completing this action unlocks Unyielding Impact until the follow-up is used or legend state clears it.'
    ),
    [ID.UNYIELDING_IMPACT]: skillTooltip(
      'Use the follow-up unlocked by Call to Anguish, then consume its availability.'
    ),
    [ID.IMPERIAL_GUARD]: skillTooltip(
      'Enter the blocking animation and unlock True Strike. Its follow-up window remains briefly after the channel ends. The simulation does not require an incoming attack to unlock True Strike.'
    ),
    [ID.TRUE_STRIKE]: skillTooltip(
      'Strike using the follow-up unlocked by Imperial Guard, then consume the follow-up window.'
    ),
    [ID.OTHERWORLDLY_BOND]: skillTooltip(
      'Apply the supported bond effects and open the temporary scepter follow-up window.'
    ),
    [ID.ETERNITYS_REQUIEM]: (balanceContext, entity) => ({
      description: 'Strike repeatedly. Additional packets hit only a target configured with a large hitbox.',
      // Packet metadata is the same exclusion gate used by the scheduler's hitbox filter.
      facts: (balanceContext.catalog.skillsById.get(entity.id)!.effects || []).flatMap((effect) =>
        effect.type === 'strike' && effect.ticks
          ? [false, true].flatMap((large) => {
              const ticks = effect.ticks!.filter((tick) => (tick.metadata?.largeHitboxOnly === true) === large);
              return ticks.length
                ? simulationEffectFacts(
                    [{ ...effect, ticks }],
                    large ? 'additional hits on a large target' : 'hits on either target size'
                  ).facts
                : [];
            })
          : simulationEffectFacts([effect]).facts
      )
    }),
    ...Object.fromEntries(
      [ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058].map((id) => [
        id,
        skillTooltip(
          "Restore endurance. Song of Arboreum replaces the base refund and grants vigor. Reaver's Curse empowers the next landing; Angsiyan's Trust also restores energy when used in combat.",
          (balanceContext, entity) => [
            { name: 'Base endurance restored', detail: tooltipDecimal(tooltipNumber(entity, 'resourceGain')) },
            profileFact(
              balanceContext,
              VINDICATOR.songOfArboreum,
              'resourceGain',
              'Endurance with Song of Arboreum instead'
            ),
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, VINDICATOR.songOfArboreum).effects,
              'with Song of Arboreum'
            ).facts
          ]
        )
      ])
    )
  },
  traits: {
    [TRAIT.INVOKERS_RAGE]: traitTooltip('Invoking a legend grants fury.'),
    [TRAIT.FEROCIOUS_AGGRESSION]: traitTooltip(
      'Player-owned strike and condition damage increases while you have fury.',
      (balanceContext) => [
        modifierFact(balanceContext, 'revenant.ferocious-aggression', 'amount', 'Strike and condition damage with fury')
      ]
    ),
    [TRAIT.CONTAINED_TEMPER]: outsideScopeTooltip,
    [TRAIT.CLEANSING_CHANNEL]: outsideScopeTooltip,
    [TRAIT.RISING_TIDE]: traitTooltip(
      'Player-owned strikes deal increased damage at the full health used by combat simulations.',
      (balanceContext) => [
        modifierFact(balanceContext, 'revenant.rising-tide', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.GLARING_RESOLVE]: outsideScopeTooltip,
    [TRAIT.SPIRIT_BOON]: (balanceContext, entity) => ({
      description:
        "Invoking a legend grants its corresponding boon. Entity invocation uses the paired core legend's boon.",
      facts: [
        ...variantFacts(tooltipProfile(balanceContext, entity.id).effects),
        ...simulationEffectFacts(tooltipProfile(balanceContext, 'revenant.spirit-boon.dragon').effects, 'Dragon').facts,
        ...simulationEffectFacts(tooltipProfile(balanceContext, RENEGADE.spiritBoon).effects, 'Renegade').facts,
        ...simulationEffectFacts(tooltipProfile(balanceContext, 'revenant.spirit-boon.alliance').effects, 'Alliance')
          .facts
      ]
    }),
    [TRAIT.RAPID_FLOW]: outsideScopeTooltip,
    [TRAIT.INCENSED_RESPONSE]: traitTooltip('Receiving a player-owned fury application grants might.'),
    [TRAIT.SONG_OF_THE_MISTS]: (balanceContext, entity) => ({
      description:
        "Invoking a core legend triggers its corresponding attack. Dragon invocation uses Call of the Dragon; Renegade invocation grants Kalla's Fervor. Entity invocation uses the paired core legend's effect.",
      facts: variantFacts(tooltipProfile(balanceContext, entity.id).effects)
    }),
    [TRAIT.CHARGED_MISTS]: traitTooltip(
      'Swapping legends below the energy threshold resets energy to the increased starting amount.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'threshold', 'Energy threshold'),
        profileFact(balanceContext, id, 'resourceGain', 'Energy after the swap')
      ]
    ),
    // Show the fixed bonuses applied by Revenant's runtime and build attribute rules.
    [TRAIT.ROILING_MISTS]: traitTooltip('Fury grants additional critical-strike chance.', () => [
      { name: 'Additional critical-strike chance with Fury', detail: tooltipPercent(0.25) }
    ]),
    [TRAIT.ENDURING_RECOVERY]: traitTooltip('Endurance regenerates faster.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'enduranceRegenerationMultiplier', 'Endurance regeneration', tooltipFactorChange)
    ]),
    [TRAIT.UNWAVERING_AVOIDANCE]: outsideScopeTooltip,
    [TRAIT.DETERMINED_RESOLUTION]: outsideScopeTooltip,
    [TRAIT.PLANAR_PROTECTION]: outsideScopeTooltip,
    [TRAIT.CLOSE_QUARTERS]: outsideScopeTooltip,
    [TRAIT.SPIRITUAL_RECKONING]: outsideScopeTooltip,
    [TRAIT.SET_IN_STONE]: outsideScopeTooltip,
    [TRAIT.RESOLUTE_EVASION]: outsideScopeTooltip,
    [TRAIT.DWARVEN_BATTLE_TRAINING]: traitTooltip(
      'Control effects apply weakness. Player-owned strikes deal increased damage to weakened targets.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'revenant.dwarven-battle-training',
          'factor',
          'Strike damage against weakened targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.VICIOUS_REPRISAL]: traitTooltip(
      'Resolution increases player-owned strike and condition damage. Qualifying strikes with resolution grant might.',
      (balanceContext, id) => [
        modifierFact(
          balanceContext,
          'revenant.vicious-reprisal',
          'amount',
          'Strike and condition damage with resolution'
        ),
        profileFact(balanceContext, id, 'cooldown', 'Might cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.VERSED_IN_STONE]: traitTooltip('Gain power from the common toughness attribute pool.'),
    [TRAIT.STEADFAST_REJUVENATION]: outsideScopeTooltip,
    [TRAIT.HEALERS_GIFT]: outsideScopeTooltip,
    [TRAIT.LIFE_ATTUNEMENT]: traitTooltip('Gain healing power and convert eligible healing power to concentration.'),
    // Show the supported skill-specific boons while explicitly excluding healing effectiveness.
    [TRAIT.SERENE_REJUVENATION]: (balanceContext, entity) => ({
      description:
        'Legendary Centaur skills grant boons to nearby allies, including yourself. Increased healing effectiveness is outside simulation scope.',
      facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect) =>
          simulationEffectFacts(
            [effect],
            `on ${balanceContext.catalog.skillsById.get(Number(effect.metadata?.trigger))!.name}`
          ).facts
      )
    }),
    [TRAIT.INVOKING_HARMONY]: outsideScopeTooltip,
    [TRAIT.BLINDING_TRUTHS]: outsideScopeTooltip,
    [TRAIT.ELUDING_NULLIFICATION]: outsideScopeTooltip,
    [TRAIT.WORDS_OF_CENSURE]: outsideScopeTooltip,
    [TRAIT.RESILIENT_SPIRIT]: outsideScopeTooltip,
    [TRAIT.FORTIFIED_BLESSING]: outsideScopeTooltip,
    [TRAIT.GENEROUS_ABUNDANCE]: outsideScopeTooltip,
    [TRAIT.UNYIELDING_DEVOTION]: outsideScopeTooltip,
    [TRAIT.INVIGORATING_DISMISSAL]: outsideScopeTooltip,
    [TRAIT.INVOKING_TORMENT]: (balanceContext, entity) => ({
      description: 'Invoking a legend triggers Invoke Torment. Diabolic Inferno adds its separate condition packets.',
      facts: variantFacts(tooltipProfile(balanceContext, entity.id).effects)
    }),
    [TRAIT.SEETHING_MALICE]: traitTooltip('Gain condition damage.', () => [
      { name: 'Condition Damage', detail: '+120' }
    ]),
    [TRAIT.YEARNING_EMPOWERMENT]: traitTooltip(
      'Damaging conditions last longer. Numinous Gift strengthens this duration bonus.',
      () => [{ name: 'Damaging-condition duration', detail: tooltipPercent(0.1) }]
    ),
    [TRAIT.ACOLYTE_OF_TORMENT]: traitTooltip('Player-owned torment deals increased damage.', (balanceContext) => [
      modifierFact(balanceContext, 'revenant.acolyte-of-torment', 'factor', 'Torment damage', tooltipFactorChange)
    ]),
    [TRAIT.DEMONIC_DEFIANCE]: outsideScopeTooltip,
    [TRAIT.REPLENISHING_DESPAIR]: outsideScopeTooltip,
    [TRAIT.ABYSSAL_CHILL]: traitTooltip('Applying chill also inflicts torment.'),
    [TRAIT.DEMONIC_RESISTANCE]: outsideScopeTooltip,
    [TRAIT.PACT_OF_PAIN]: traitTooltip('Outgoing conditions last longer.', () => [
      { name: 'Condition duration', detail: tooltipPercent(0.15) }
    ]),
    [TRAIT.DIABOLIC_INFERNO]: (balanceContext) => ({
      description: 'Invoke Torment applies additional conditions.',
      facts: simulationEffectFacts(
        tooltipProfile(balanceContext, TRAIT.INVOKING_TORMENT).effects?.filter(
          (effect) => effect.metadata?.trigger === 'diabolic-inferno'
        )
      ).facts
    }),
    [TRAIT.FIENDISH_TENACITY]: outsideScopeTooltip,
    [TRAIT.PERMEATING_PESTILENCE]: outsideScopeTooltip,
    [TRAIT.EXPOSE_DEFENSES]: traitTooltip('Your first qualifying strike after combat begins inflicts vulnerability.'),
    // Fixed runtime bonuses show both off-hand alternatives and the per-stack rate without requiring a selected build.
    [TRAIT.DESTRUCTIVE_IMPULSES]: traitTooltip(
      'Player-owned strikes and conditions deal increased damage. Wielding an off-hand weapon strengthens the bonus.',
      () => [
        { name: 'Strike and condition damage without an off-hand weapon', detail: tooltipPercent(0.05) },
        { name: 'Strike and condition damage with an off-hand weapon', detail: tooltipPercent(0.075) }
      ]
    ),
    [TRAIT.TARGETED_DESTRUCTION]: traitTooltip(
      'Player-owned strikes deal increased damage for each vulnerability stack on the target.',
      () => [{ name: 'Strike damage per vulnerability stack', detail: tooltipPercent(0.005) }]
    ),
    [TRAIT.AGGRESSIVE_ARRIVAL]: outsideScopeTooltip,
    [TRAIT.UNSUSPECTING_STRIKES]: traitTooltip(
      'Player-owned strikes deal increased damage while the target remains above its high-health threshold.',
      (balanceContext) => [
        modifierFact(balanceContext, 'revenant.unsuspecting-strikes', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.BATTLE_SCARRED]: traitTooltip(
      'Completing a healing skill grants Battle Scars. Qualifying player strikes consume a scar to deal life-siphon damage.'
    ),
    [TRAIT.ASSASSINS_PRESENCE]: traitTooltip(
      'Periodically grant fury to the party during combat.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Fury interval', tooltipSeconds)]
    ),
    [TRAIT.NOTORIETY]: traitTooltip(
      'Legendary stance skills grant might. Your might grants more power and less condition damage.'
    ),
    [TRAIT.THRILL_OF_COMBAT]: traitTooltip(
      'Periodically gain Battle Scars during combat. Qualifying player strikes consume a scar to deal life-siphon damage.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Scar interval', tooltipSeconds)]
    ),
    [TRAIT.BRUTALITY]: traitTooltip('Completing a weapon swap grants quickness.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)
    ]),
    [TRAIT.SWIFT_TERMINATION]: traitTooltip(
      'Player-owned strikes deal increased damage while the target is below half health.',
      (balanceContext) => [
        modifierFact(balanceContext, 'revenant.swift-termination', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.DANCE_OF_DEATH]: traitTooltip(
      'Applying vulnerability grants Battle Scars according to the stacks applied. Qualifying player strikes consume a scar to deal life-siphon damage.'
    ),
    [TRAIT.CRYSTAL_HARBINGER]: traitTooltip('Unlock the Legendary Dragon stance, facets, and Facet of Nature.'),
    [TRAIT.DRACONIC_FORTITUDE]: outsideScopeTooltip,
    [TRAIT.REINFORCED_POTENCY]: traitTooltip(
      'Gain concentration. Each different boon on you increases player strike damage.',
      () => [
        { name: 'Concentration', detail: '+240' },
        { name: 'Strike damage per unique boon', detail: tooltipPercent(0.01) }
      ]
    ),
    [TRAIT.ELDERS_RESPITE]: outsideScopeTooltip,
    [TRAIT.CORE_VALUE]: traitTooltip("Facet of Nature's boon-extension effect extends boons further.", () => [
      { name: 'Additional boon extension', detail: tooltipSeconds(1) }
    ]),
    [TRAIT.RISING_MOMENTUM]: outsideScopeTooltip,
    [TRAIT.SHARED_EMPOWERMENT]: profileTooltip(
      'revenant.shared-empowerment',
      'Applying a boon to an ally grants might to the party.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.SHINING_ASPECTS]: outsideScopeTooltip,
    [TRAIT.HARDENING_PERSISTENCE]: outsideScopeTooltip,
    [TRAIT.ELEVATED_COMPASSION]: profileTooltip(
      'revenant.elevated-compassion',
      'Gain concentration from the common power attribute pool. Maintaining enough aggregate upkeep periodically grants party quickness.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'threshold', 'Required aggregate upkeep'),
        profileFact(balanceContext, id, 'cooldown', 'Quickness interval', tooltipSeconds)
      ]
    ),
    [TRAIT.DRACONIC_ECHO]: profileTooltip(
      'revenant.draconic-echo',
      'Consumed facets retain their passive effects temporarily. Strength grants strike damage, Elements grants condition damage, Darkness grants critical chance, and Nature grants boon duration.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'duration', 'Echo duration', tooltipSeconds),
        profileFact(balanceContext, id, 'damageBonus', 'Strength strike / Elements condition damage', tooltipPercent),
        profileFact(balanceContext, id, 'criticalChanceBonus', 'Darkness critical chance', tooltipPercent),
        profileFact(balanceContext, id, 'boonDurationBonus', 'Nature boon duration', (value) => `${value}%`)
      ]
    ),
    // Count each active upkeep skill, rather than its energy drain, using the runtime's two additive rates.
    [TRAIT.FORCEFUL_PERSISTENCE]: traitTooltip(
      'Each active upkeep skill adds to player strike damage. Facets and other upkeep skills grant different bonuses.',
      () => [
        { name: 'Strike damage per active facet', detail: tooltipPercent(0.1) },
        { name: 'Strike damage per other active upkeep skill', detail: tooltipPercent(0.25) }
      ]
    ),
    [TRAIT.AMBUSH_COMMANDER]: profileTooltip(
      RENEGADE.kallasFervor,
      "Qualifying critical or positional hits grant Kalla's Fervor. Defiant targets satisfy the simulator's positional condition.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        modifierFact(balanceContext, 'revenant.kallas-fervor-strike', 'damagePerStack', 'Strike damage per stack'),
        modifierFact(
          balanceContext,
          'revenant.kallas-fervor-condition',
          'damagePerStack',
          'Condition damage per stack'
        ),
        profileFact(balanceContext, id, 'lifeSiphonDamagePerStack', 'Life-siphon damage per stack', tooltipPercent)
      ]
    ),
    [TRAIT.ENDLESS_ENMITY]: profileTooltip(
      RENEGADE.endlessEnmity,
      'Eligible critical hits grant fury to the party.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.BRUTAL_MOMENTUM]: profileTooltip(
      RENEGADE.brutalMomentum,
      'Gain critical-strike chance. Receiving fury grants vigor.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Vigor cooldown', tooltipSeconds)]
    ),
    [TRAIT.ASHEN_DEMEANOR]: profileTooltip(
      RENEGADE.ashenDemeanor,
      "Using a healing skill grants boons and Kalla's Fervor.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds),
        profileFact(balanceContext, id, 'fervorStacks', 'Fervor stacks gained')
      ]
    ),
    [TRAIT.BLOOD_FURY]: profileTooltip(
      RENEGADE.bloodFury,
      "Fury applications grant Kalla's Fervor. Bleeding lasts longer while you have fury.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'cooldown', 'Fervor cooldown', tooltipSeconds),
        modifierFact(balanceContext, 'revenant.blood-fury-bleeding-duration', 'amount', 'Bleeding duration with fury')
      ]
    ),
    [TRAIT.WROUGHT_IRON_WILL]: outsideScopeTooltip,
    [TRAIT.BOLD_REVERSAL]: profileTooltip(
      RENEGADE.boldReversalRighteousRebel,
      'Orders from Above also grants protection when Righteous Rebel is selected.',
      undefined,
      'with Righteous Rebel'
    ),
    [TRAIT.HEARTPIERCER]: traitTooltip(
      'Player-owned strikes deal increased damage to bleeding targets. Bleeding also deals increased damage.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'revenant.heartpiercer-strike',
          'factor',
          'Strike damage against bleeding targets',
          tooltipFactorChange
        ),
        modifierFact(balanceContext, 'revenant.heartpiercer-bleeding', 'factor', 'Bleeding damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.ALL_FOR_ONE]: profileTooltip(
      RENEGADE.allForOne,
      'An empowered Band Together skill recharges faster.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Empowered summon recharge duration', tooltipFactorChange)
      ]
    ),
    [TRAIT.VINDICATION]: profileTooltip(
      RENEGADE.vindication,
      "Citadel Bombardment's first impact applies a daze control event."
    ),
    [TRAIT.LASTING_LEGACY]: profileTooltip(
      RENEGADE.kallasFervorLastingLegacy,
      "Kalla's Fervor lasts longer and grants stronger damage bonuses. Heroic Command grants additional might per Fervor stack.",
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        modifierFact(
          balanceContext,
          'revenant.kallas-fervor-strike',
          'improvedDamagePerStack',
          'Strike damage per stack'
        ),
        modifierFact(
          balanceContext,
          'revenant.kallas-fervor-condition',
          'improvedDamagePerStack',
          'Condition damage per stack'
        ),
        profileFact(balanceContext, id, 'lifeSiphonDamagePerStack', 'Life-siphon damage per stack', tooltipPercent)
      ]
    ),
    [TRAIT.RIGHTEOUS_REBEL]: profileTooltip(
      RENEGADE.ordersFromAboveRighteousRebel,
      'Orders from Above uses its extended alacrity pulse sequence.'
    ),
    [TRAIT.TENACIOUS_RUIN]: traitTooltip('Replace the ordinary dodge with the selected Vindicator dodge attack.'),
    [TRAIT.BALANCE_IN_DISCORD]: outsideScopeTooltip,
    [TRAIT.EMPIRE_DIVIDED]: traitTooltip('Gain power at the full player health used by combat simulations.', () => [
      { name: 'Power', detail: '+240' }
    ]),
    [TRAIT.LEVIATHAN_STRENGTH]: traitTooltip(
      'Player-owned strikes deal increased damage while endurance is below full.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'revenant.leviathan-strength',
          'factor',
          'Strike damage below full endurance',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.AMNESTY_OF_SHING_JEA]: outsideScopeTooltip,
    [TRAIT.REDEMPTORS_SERMON]: outsideScopeTooltip,
    [TRAIT.REAVERS_CURSE]: traitTooltip(
      'Energy Meld recharges faster and empowers the next dodge that lands within its buff window.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Energy Meld recharge duration', tooltipFactorChange),
        profileFact(balanceContext, id, 'damageMultiplier', 'Empowered dodge damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.ANGSIYANS_TRUST]: traitTooltip(
      'Energy Meld costs no energy and grants energy during combat.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Energy gained')]
    ),
    [TRAIT.SONG_OF_ARBOREUM]: traitTooltip(
      'Energy Meld grants increased endurance and vigor.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Endurance gained')]
    ),
    [TRAIT.FORERUNNER_OF_DEATH]: traitTooltip(
      'Death Drop grants a temporary player strike-damage bonus.',
      (balanceContext) => [
        modifierFact(balanceContext, 'revenant.forerunner-of-death', 'amount', 'Strike damage during the bonus')
      ]
    ),
    [TRAIT.VASSALS_OF_THE_EMPIRE]: traitTooltip(
      'Use Imperial Impact as the dodge skill, applying its strike and boon effects.'
    ),
    [TRAIT.SAINT_OF_ZU_HELTZER]: traitTooltip(
      "Use Saint's Shield as the dodge skill. Incoming damage and healing are outside combat simulation scope."
    ),
    [TRAIT.ENIGMATIC_CONNECTION]: traitTooltip(
      'Unlock Legendary Entity, affinity, Release Potential, and Cosmic Wisdom forms determined by the equipped legends.'
    ),
    [TRAIT.BOLSTERED_BONDS]: traitTooltip(
      'Equipped legends grant attributes: Assassin grants power and ferocity; Demon grants condition damage and expertise; Dwarf grants toughness and vitality; Centaur grants healing power and concentration; Entity grants all supported primary attributes. Cosmic Wisdom doubles these bonuses.'
    ),
    [TRAIT.NUMINOUS_GIFT]: (balanceContext) => ({
      description:
        'Cosmic Wisdom grants might and boons determined by equipped legends. Targeted Destruction and Yearning Empowerment gain additional bonuses.',
      facts: [
        ...variantFacts(tooltipProfile(balanceContext, CONDUIT.numinousGift).effects),
        // Each enhancement identifies the affected trait with its catalog icon.
        {
          ...modifierFact(
            balanceContext,
            'revenant.targeted-destruction-numinous-gift',
            'bonus',
            'Additional Targeted Destruction bonus'
          ),
          icon: String(
            balanceContext.catalog.traits.find((trait) => trait.id === TRAIT.TARGETED_DESTRUCTION)?.icon || ''
          )
        },
        {
          ...modifierFact(
            balanceContext,
            'revenant.yearning-empowerment-numinous-gift',
            'amount',
            'Additional damaging-condition duration'
          ),
          icon: String(
            balanceContext.catalog.traits.find((trait) => trait.id === TRAIT.YEARNING_EMPOWERMENT)?.icon || ''
          )
        }
      ]
    }),
    [TRAIT.CONDUCTIVE_ARMAMENTS]: traitTooltip('Casting weapon skills also generates affinity.'),
    [TRAIT.SHARED_WISDOM]: (balanceContext) => ({
      description: 'Entity skills grant swiftness. Specific Entity skills grant additional boons.',
      facts: variantFacts(tooltipProfile(balanceContext, CONDUIT.sharedWisdom).effects)
    }),
    [TRAIT.LINGERING_DETERMINATION]: profileTooltip(
      CONDUIT.lingeringDetermination,
      'Swapping legends in combat grants affinity after the swap resets it.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Affinity gained')]
    ),
    [TRAIT.KINETIC_INSIGHT]: traitTooltip('Release Potential recharges faster.'),
    [TRAIT.EXPANDED_CONSCIOUSNESS]: profileTooltip(
      CONDUIT.expandedConsciousness,
      'Reaching maximum affinity grants energy.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Energy gained')]
    ),
    [TRAIT.ETHEREAL_PURIFICATION]: outsideScopeTooltip,
    [TRAIT.MISTFIRE]: profileTooltip(
      CONDUIT.mistfire,
      'Control effects inflict burning. Twin Moon Sweep is excluded.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'cooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.ENHANCED_EMBODIMENT]: profileTooltip(
      CONDUIT.enhancedEmbodiment,
      'Legend swaps in combat recharge faster and extend Cosmic Wisdom.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Legend-swap recharge duration', tooltipFactorChange)
      ]
    ),
    [TRAIT.FOUND_PURPOSE]: (balanceContext) => ({
      description: 'Swapping legends in combat shares the Numinous Gift boon package with nearby allies.',
      facts: variantFacts(tooltipProfile(balanceContext, CONDUIT.numinousGift).effects)
    })
  }
};
