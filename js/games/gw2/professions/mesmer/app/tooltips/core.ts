import { ACTOR } from '#gw2/platform/constants.js';
import { MESMER_CORE_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/core/skills/index.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  fromProfile,
  tooltipSeconds,
  skillTooltip,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/definitions.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { DescribeSimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import { shatterTooltip } from '#gw2/professions/mesmer/app/tooltips/shared.js';
import { mesmerDominationTooltips } from '#gw2/professions/mesmer/app/tooltips/domination.js';
import { mesmerDuelingTooltips } from '#gw2/professions/mesmer/app/tooltips/dueling.js';
import { mesmerChaosTooltips } from '#gw2/professions/mesmer/app/tooltips/chaos.js';
import { mesmerInspirationTooltips } from '#gw2/professions/mesmer/app/tooltips/inspiration.js';
import { mesmerIllusionsTooltips } from '#gw2/professions/mesmer/app/tooltips/illusions.js';

// Phantasm condition budgets are distributed across their authored hit packets, independently for each summoned entity.
const phantasmTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)! as MesmerSkill;
  const timing = { ...MESMER_CORE_PHANTASM_ATTACK_TIMINGS, ...MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS }[
    selected.id
  ];
  const facts = (selected.effects || []).flatMap((effect) => {
    const companion = effect.actorType === ACTOR.SUMMON;
    const entityIndex = effect.type === 'condition' ? effect.phantasmEntityIndex : undefined;
    const packetLabel = effect.type === 'condition' ? effect.packetLabel : undefined;
    const packetCount = packetLabel
      ? (
          timing?.damageTicksByEntity?.[entityIndex ?? 0]?.[packetLabel] ??
          timing?.damageTicks?.[packetLabel] ??
          selected.effects?.filter((effect) => effect.type === 'strike').find((effect) => effect.name === packetLabel)
            ?.ticks
        )?.length
      : undefined;
    const formatted =
      effect.type === 'condition' && packetCount
        ? { ...effect, stacks: (effect.stacks ?? 1) / packetCount, applications: packetCount }
        : effect;
    return simulationEffectFacts(
      [formatted],
      companion ? (entityIndex == null ? 'per phantasm' : `phantasm ${entityIndex + 1} only`) : 'player effect'
    ).facts;
  });
  facts.push({ name: 'Base phantasms summoned', detail: tooltipDecimal(tooltipNumber(selected.resource!, 'count')) });
  return {
    description:
      "Summon phantasms that perform their own attacks before converting into your specialization's resource. Player effects occur once; companion effects are per phantasm. Traits can change the count, repeat attacks, or modify conversion." +
      (selected.id === ID.PHANTASMAL_LANCER
        ? ' Consuming Clarity summons an additional Lancer; only that second phantasm immobilizes.'
        : ''),
    facts
  };
};

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const mesmerCoreTooltips = {
  skillFacts: (_c, entity) => {
    const selected = entity as MesmerSkill;
    // Follow-up facts use the runtime's window and fraction of parent base recharge.
    return [
      ...(selected.resource?.mode === 'add'
        ? [
            {
              name: 'Resources generated',
              detail: `${tooltipDecimal(tooltipNumber(selected.resource, 'count'))} clones, blades, or notes according to specialization`
            }
          ]
        : []),
      ...(selected.flipArm?.duration == null
        ? []
        : [{ name: 'Follow-up window', detail: tooltipSeconds(selected.flipArm.duration) }]),
      ...(selected.parentCooldownIncrease == null
        ? []
        : [
            {
              name: 'Additional parent recharge',
              detail: `${tooltipPercent(selected.parentCooldownIncrease)} of parent base recharge`
            }
          ]),
      ...(selected.resourceCost == null
        ? []
        : [{ name: 'Endurance spent', detail: tooltipDecimal(tooltipNumber(selected, 'resourceCost')) }])
    ];
  },
  skills: {
    ...Object.fromEntries(Object.keys(MESMER_CORE_PHANTASM_ATTACK_TIMINGS).map((id) => [Number(id), phantasmTooltip])),
    ...Object.fromEntries(Object.keys(MESMER_CORE_SHATTERS).map((id) => [Number(id), shatterTooltip])),
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: skillTooltip(
      'Switch weapon sets. Existing illusions keep their own weapons and attack patterns.'
    ),
    [ID.MENTAL_COLLAPSE]: skillTooltip(
      'Strike your target and reset Mind the Gap. Consuming Clarity also stuns the target.'
    ),
    [ID.INSPIRING_IMAGERY]: (balanceContext, entity) => ({
      description:
        'Create an ethereal field and open Abstraction. If the image expires naturally, gain its boons. Detonating it with Abstraction ends the field and replaces this boon outcome with the follow-up attack.',
      facts: simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'on natural expiry only')
        .facts
    }),
    [ID.CHAOS_STORM]: skillTooltip(
      'Create a storm that strikes repeatedly, dazes on its opening pulse, and poisons the target on the subsequent condition pulses.',
      (_c, entity) => simulationEffectFacts([(entity as MesmerSkill).mesmerMechanic!.chaosStormPoison!]).facts
    ),
    [ID.SIGNET_OF_ILLUSIONS]: skillTooltip(
      "Passively generate your specialization's resource while equipped and recharged. Activate to reset eligible shatter and instrument cooldowns, restoring one ammunition charge where applicable. Continuum Split is excluded. The passive restarts after the signet recharges.",
      [
        fromProfile(CORE.signetOfIllusions, 'pulseInterval', 'Passive interval', tooltipSeconds),
        fromProfile(CORE.signetOfIllusions, 'resourceGain', 'Resources per passive pulse')
      ]
    ),
    [ID.SIGNET_OF_THE_ETHER]: skillTooltip(
      "Reset phantasm skill cooldowns. Its healing has no effect on the simulator's fixed player health."
    ),
    [ID.SIGNET_OF_DOMINATION]: skillTooltip(
      'Passively gain condition damage while the signet is available. Activate to stun your target.',
      [fromProfile(CORE.signetOfDomination, 'conditionDamageBonus', 'Passive condition damage')]
    ),
    [ID.SIGNET_OF_MIDNIGHT]: skillTooltip(
      'Passively gain expertise while the signet is available. Activate to blind nearby enemies.',
      [fromProfile(CORE.signetOfMidnight, 'expertiseBonus', 'Passive expertise')]
    ),
    [ID.MIMIC]: skillTooltip(
      "Arm a window for your next completed utility skill. If its cast begins within the window, reduce its recharge to 1 second and add its original recharge to Mimic's base 20-second recharge, before Alacrity. Continuum Split does not restore Mimic's recharge. Follow-up skills do not consume Mimic; ammunition charges are not replenished.",
      [fromProfile(CORE.mimic, 'durationMultiplier', 'Mimic window', tooltipSeconds)]
    ),
    [ID.MIND_THE_GAP]: skillTooltip('Strike, generate a resource, and gain Clarity for a subsequent spear skill.'),
    [ID.IMAGINARY_INVERSION]: skillTooltip(
      "Strike your target and consume Clarity if present. Healing and incoming-damage avoidance do not change the simulated player's health."
    ),
    [ID.ETHER_CLONE]: skillTooltip(
      'Strike and generate a clone. If already at the clone limit when the strike lands, inflict the additional condition instead. Other specializations generate their own resource.',
      (context) =>
        simulationEffectFacts(
          tooltipProfile(context, CORE.etherClone).effects,
          'instead of creating a clone at the clone limit'
        ).facts
    ),
    [ID.FLYING_CUTTER]: skillTooltip(
      'Strike your target. Repeated qualifying hits within the tracking window trigger an additional Cutter Burst.',
      (_c, entity) => {
        const tracked = (entity as MesmerSkill).trackedHitDamage!;
        return [
          ...simulationEffectFacts([{ ...tracked, type: 'strike' }], 'additional Cutter Burst').facts,
          { name: 'Hits required', detail: tooltipDecimal(tracked.hitsRequired) },
          { name: 'Hit tracking window', detail: tooltipSeconds(tracked.duration) }
        ];
      }
    ),
    [ID.AXES_OF_SYMMETRY_NON_MIRAGE]: skillTooltip(
      'Strike and confuse your target. Add further player-owned confusion for each clone present when this cast begins.'
    ),
    [ID.ABSTRACTION]: skillTooltip(
      "Detonate the active Inspiring Imagery for its attack and a blast finisher in that image's ethereal field. The detonation prevents the image's natural boon explosion."
    )
  },
  traits: {
    ...mesmerDominationTooltips,
    ...mesmerDuelingTooltips,
    ...mesmerChaosTooltips,
    ...mesmerInspirationTooltips,
    ...mesmerIllusionsTooltips
  }
} satisfies ProfessionTooltips;
