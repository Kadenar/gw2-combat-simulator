import { BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import {
  fromProfile,
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
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as ANTIQUARY } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';

/** Artifact windows supplement the native cast; charges apply to later attacks rather than adding immediate damage. */
const artifactTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const facts = [...simulationEffectFacts(selected.effects).facts];
  let description = 'Use and consume this held artifact. Artifact-use traits apply.';
  const window = (kryptis = false) =>
    facts.push(
      profileFact(
        balanceContext,
        ANTIQUARY.artifactWindows,
        kryptis ? 'minimumStacks' : 'duration',
        'Effect window',
        tooltipSeconds
      ),
      profileFact(
        balanceContext,
        TRAIT.METICULOUS_CUSTODIAN,
        kryptis ? 'kryptisDuration' : 'duration',
        'Effect window with Meticulous Custodian',
        tooltipSeconds
      )
    );

  if (entity.id === ID.HOLO_DANCER_DECOY) {
    description +=
      ' Adds a timed charge that reduces the recharge of the next utility cast. Repeated grants queue and consume the oldest charge first.';
    window();
    facts.push(
      profileFact(
        balanceContext,
        ANTIQUARY.artifactWindows,
        'rechargeMultiplier',
        'Next utility recharge multiplier',
        (value) => `${tooltipDecimal(value)}×`
      )
    );
  } else if (entity.id === ID.CHAK_SHIELD) {
    description +=
      ' Refunds initiative spent while its window lasts. Spending still advances initiative-spending traits. Meticulous Custodian also triggers an additional strike.';
    window();
    facts.push(
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, TRAIT.METICULOUS_CUSTODIAN).effects,
        'additional strike with Meticulous Custodian'
      ).facts
    );
  } else if (entity.id === ID.SUMMON_KRYPTIS_TURRET) {
    description += ' Starts a temporary player strike-damage bonus.';
    window(true);
    facts.push(
      modifierFact(
        balanceContext,
        'thief.kryptis-turret-damage',
        'factor',
        'Player strike damage during window',
        tooltipFactorChange
      )
    );
  } else if (entity.id === ID.MISTBURN_MORTAR) {
    description +=
      ' Grants charges that add burning to later eligible player strikes. A new grant replaces remaining charges.';
    window();
    facts.push(
      profileFact(balanceContext, ANTIQUARY.artifactWindows, 'playerStacks', 'Charged strikes'),
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, ANTIQUARY.mistburnProc).effects,
        'per later charged strike'
      ).facts
    );
  } else if (entity.id === ID.METAL_LEGION_GUITAR) {
    description += ' Grants timed charges allowing stealth attacks without entering stealth.';
    window();
    facts.push(profileFact(balanceContext, ANTIQUARY.artifactWindows, 'resourceGain', 'Stealth-attack charges'));
  } else if (entity.id === ID.ZEPHYRITE_SUN_CRYSTAL) {
    description += ' Meticulous Custodian adds burning to each eligible strike.';
    facts.push(
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, ANTIQUARY.sunCrystalMeticulous).effects,
        'additional burning per strike with Meticulous Custodian'
      ).facts
    );
  }

  return { description, facts };
};

const reshuffleTooltip: DescribeSimulationTooltip = skillTooltip(
  'Replace the available artifact choices. Retains the number of artifact uses remaining. Requires the Card Swap trait.'
);

const unstableSkrittBombTooltip: DescribeSimulationTooltip = skillTooltip(
  'Consume a held Skritt Scuffle artifact grant to explode the bomb, dealing strike damage and knocking enemies back. This backfire does not trigger regular artifact-use traits. Self-damage and incoming-damage penalties are outside simulation scope.'
);

const skrittSwipeTooltip: DescribeSimulationTooltip = skillTooltip(
  'Trigger stealing traits and replace held artifacts with a new choice pool. Grants the base artifact use plus supported Skritt Swipe bonuses; resets the initiative-spending counter.',
  [
    fromProfile(ANTIQUARY.resources, 'maximumStacks', 'Base artifact uses'),
    fromProfile(TRAIT.PROLIFIC_PLUNDERER, 'resourceGain', 'Additional uses with Prolific Plunderer'),
    fromProfile(TRAIT.IMPROVISATION, 'resourceGain', 'Additional uses with Improvisation')
  ]
);

const skrittScuffleTooltip: DescribeSimulationTooltip = profileTooltip(
  ANTIQUARY.scuffle,
  'Summon an assistant that immediately pilfers artifacts and repeats while active. Each pilfer replaces artifact choices, including Unstable Skritt Bomb, and resets base uses. Multiple assistants run independently.',
  [
    ['duration', 'Assistant duration', tooltipSeconds],
    ['pulseInterval', 'Pilfer interval', tooltipSeconds]
  ]
);

const forgedSurferTooltip: DescribeSimulationTooltip = (balanceContext) => ({
  description:
    'Consume the artifact and schedule its dash followed by bombs while the buff lasts. Recasting restarts the bomb cadence and adds buff duration up to thirteen seconds. Meticulous Custodian grants a thirteen-second window and substitutes its enhanced packets.',
  facts: [
    profileFact(balanceContext, ANTIQUARY.forgedSurfer, 'initialDelay', 'Dash delay', tooltipSeconds),
    profileFact(balanceContext, ANTIQUARY.forgedSurfer, 'pulseInterval', 'Bomb interval', tooltipSeconds),
    profileFact(balanceContext, ANTIQUARY.forgedSurfer, 'duration', 'Base buff duration', tooltipSeconds),
    profileFact(
      balanceContext,
      ANTIQUARY.forgedSurfer,
      'maximumDuration',
      'Maximum remaining buff duration',
      tooltipSeconds
    ),
    ...[ANTIQUARY.forgedSurfer, ANTIQUARY.forgedSurferMeticulous].flatMap((id) =>
      tooltipProfile(balanceContext, id).effects!.flatMap(
        (effect) =>
          simulationEffectFacts(
            [effect],
            `${id === ANTIQUARY.forgedSurfer ? 'base' : 'with Meticulous Custodian'} · ${effect.name === 'Dash' ? 'dash' : 'per bomb'}`
          ).facts
      )
    )
  ]
});

const doubleEdgeTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const description =
    "Succeeds when ready. Reusing during recharge takes the configured success or backfire outcome; Scoundrel's Luck guarantees a risky success and consumes its charge. Further risky uses remain available after a backfire.";

  if (entity.id === ID.STONE_SUMMIT_CANNON) {
    const success = tooltipProfile(balanceContext, ANTIQUARY.cannonSuccess);
    return {
      description,
      facts: [
        ...simulationEffectFacts(success.effects, 'success').facts,
        ...simulationEffectFacts(tooltipProfile(balanceContext, ANTIQUARY.cannonBackfire).effects, 'backfire').facts,
        profileFact(balanceContext, ANTIQUARY.cannonBackfire, 'initialDelay', 'Backfire delay', tooltipSeconds)
      ]
    };
  }

  if (entity.id === ID.CANACH_COIN_TOSS)
    return {
      description: `${description} Coin tosses follow a deterministic alternating sequence. Heads restores more initiative than tails; backfire reduces the initiative returned.`,
      facts: []
    };

  return {
    description: `${description} Antivenom's healing and self-damage do not vary player health in combat simulation.`,
    facts: simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'success only').facts
  };
};

/** Describe antiquary tooltips from the selected balance data. */
export const antiquaryTooltips = {
  skills: {
    ...Object.fromEntries(
      [
        ID.HOLO_DANCER_DECOY,
        ID.EXALTED_HAMMER,
        ID.CHAK_SHIELD,
        ID.ZEPHYRITE_SUN_CRYSTAL,
        ID.SUMMON_KRYPTIS_TURRET,
        ID.MISTBURN_MORTAR,
        ID.METAL_LEGION_GUITAR,
        ID.METAL_LEGION_GUITAR_ID_76591,
        ID.ZEPHYRITE_SUN_CRYSTAL_ID_76733
      ].map((id) => [id, artifactTooltip])
    ),
    [ID.RESHUFFLE]: reshuffleTooltip,
    [ID.UNSTABLE_SKRITT_BOMB]: unstableSkrittBombTooltip,
    [ID.SKRITT_SWIPE]: skrittSwipeTooltip,
    [ID.SKRITT_SCUFFLE]: skrittScuffleTooltip,
    [ID.FORGED_SURFER_DASH]: forgedSurferTooltip,
    ...Object.fromEntries(
      [ID.STONE_SUMMIT_CANNON, ID.ANTIVENOM_DRAUGHT, ID.CANACH_COIN_TOSS].map((id) => [id, doubleEdgeTooltip])
    )
  },
  traits: {
    [TRAIT.TRINKET_COLLECTOR]: traitTooltip(
      'Unlock Antiquary, artifacts, Skritt Swipe, and double-edge skills. Pilfering replaces held artifacts; each artifact use consumes its selected slot.'
    ),
    [TRAIT.MAGPIES_DEFENSE]: outsideScopeTooltip,
    [TRAIT.ENTERPRISING_ARISTOCRAT]: traitTooltip('Using an artifact restores initiative.', [
      ['resourceGain', 'Initiative restored']
    ]),
    [TRAIT.CARD_SWAP]: traitTooltip(
      'Gain access to Reshuffle, which replaces the available artifact choices. Condition removal is not simulated.'
    ),
    [TRAIT.REPEAT_RANSACKER]: traitTooltip('Using an artifact reduces the active recharge of Skritt Swipe.', [
      ['rechargeReduction', 'Recharge removed', tooltipSeconds]
    ]),
    [TRAIT.PROLIFIC_PLUNDERER]: traitTooltip('Skritt Swipe grants an additional artifact use.', [
      ['resourceGain', 'Additional artifact uses']
    ]),
    [TRAIT.SCOUNDRELS_LUCK]: traitTooltip(
      "Skritt Swipe grants Scoundrel's Luck, making a risky double-edge cast succeed. New grants replace the charge instead of accumulating.",
      [
        ['maximumStacks', 'Charges'],
        ['internalCooldown', 'Grant cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.METICULOUS_CUSTODIAN]: traitTooltip(
      'Enhance artifacts: extend their special-effect windows, improve eligible strikes, burning and turret torment, and add a strike to Chak Shield.',
      [
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'guitarFactor', 'Guitar strike damage', tooltipFactorChange),
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'guitarFinalFactor', 'Guitar final strike damage', tooltipFactorChange),
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'mortarFactor', 'Mortar strike damage', tooltipFactorChange),
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'holoFactor', 'Holo Dancer strike damage', tooltipFactorChange),
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'kryptisFactor', 'Kryptis Turret strike damage', tooltipFactorChange),
        ['kryptisTormentDurationMultiplier', 'Kryptis Turret base torment duration', tooltipFactorChange],
        fromProfile(
          TRAIT.METICULOUS_CUSTODIAN,
          'mortarBurningDurationMultiplier',
          'Mortar burning duration',
          tooltipFactorChange
        ),
        fromProfile(
          TRAIT.METICULOUS_CUSTODIAN,
          'sunCrystalBurningDurationMultiplier',
          'Sun Crystal burning duration',
          tooltipFactorChange
        )
      ],
      'additional Chak Shield strike'
    ),
    [TRAIT.EXHILARATING_EPHEMERA]: traitTooltip(
      'Using an artifact extends a temporary strike-damage bonus, up to the maximum remaining duration.',
      [
        fromProfile(TRAIT.EXHILARATING_EPHEMERA, 'damageIncrease', 'Strike damage', tooltipPercent),
        ['durationExtension', 'Duration added', tooltipSeconds],
        ['maximumStacks', 'Maximum remaining duration', tooltipSeconds]
      ]
    ),
    [TRAIT.PRODIGIOUS_PINCHER]: traitTooltip(
      'Spending enough initiative in combat pilfers a new set of artifacts and resets the spending counter.',
      [['threshold', 'Initiative spent to pilfer']]
    ),
    [TRAIT.POSSESSIVE_HOARDER]: (balanceContext, entity) => ({
      description:
        'Using an artifact grants alacrity to you and nearby allies, up to five targets. Offensive artifacts also grant might; defensive artifacts grant protection instead.',
      // Artifact categories follow the same named boons selected by combat.
      facts: [
        [boonKey(BOON.MIGHT), 'offensive artifact'],
        [boonKey(BOON.PROTECTION), 'defensive artifact'],
        [boonKey(BOON.ALACRITY), 'any artifact']
      ].flatMap(([name, label]) => {
        const effect = requireEffect(tooltipProfile(balanceContext, entity.id), 'boon', name);
        return effect ? simulationEffectFacts([effect], label).facts : [];
      })
    }),
    [TRAIT.COMBAT_HIGH]: traitTooltip(
      'Skritt Swipe grants a full set of damage-bonus stacks, replacing earlier stacks. Stacks expire one at a time.',
      [
        fromProfile(TRAIT.COMBAT_HIGH, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        fromProfile(TRAIT.COMBAT_HIGH, 'conditionDamageIncreasePerStack', 'Condition damage per stack', tooltipPercent),
        ['maximumStacks', 'Initial stacks'],
        ['pulseInterval', 'Time between stack expirations', tooltipSeconds],
        ['duration', 'Final stack duration', tooltipSeconds]
      ]
    )
  }
} satisfies ProfessionTooltips;
