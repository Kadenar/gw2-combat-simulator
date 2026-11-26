import {
  fromModifier,
  fromSkill,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipNumber,
  tooltipPercent,
  tooltipSeconds,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import type { DescribeSimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import { equippedEliteSpecialization } from '#gw2/platform/builds/elite-specialization.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { mesmerChaosTooltips } from '#gw2/professions/mesmer/app/tooltips/chaos.js';
import { mesmerDominationTooltips } from '#gw2/professions/mesmer/app/tooltips/domination.js';
import { mesmerDuelingTooltips } from '#gw2/professions/mesmer/app/tooltips/dueling.js';
import { mesmerIllusionsTooltips } from '#gw2/professions/mesmer/app/tooltips/illusions.js';
import { mesmerInspirationTooltips } from '#gw2/professions/mesmer/app/tooltips/inspiration.js';
import { chaosStormPoisonFacts, shatterTooltip } from '#gw2/professions/mesmer/app/tooltips/shared.js';
import { phantasmAttackCycle } from '#gw2/professions/mesmer/core/mechanics/illusions/phantasm-attack-cycle.js';
import { MESMER_CORE_SKILLS } from '#gw2/professions/mesmer/core/skills/index.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerPhantasmTiming } from '#gw2/professions/mesmer/family-mechanics.js';
import { mesmerResourceKind } from '#gw2/professions/mesmer/family-state.js';

// Phantasm condition budgets are distributed across their authored hit packets, independently for each summoned entity.
const phantasmTooltip: DescribeSimulationTooltip = (balanceContext, entity, _specialization, build) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)! as MesmerSkill;
  const specialization = equippedEliteSpecialization(balanceContext.catalog, build);
  const timing = mesmerPhantasmTiming(selected, specialization);
  const facts = (selected.effects || []).flatMap((effect) => {
    const companion = effect.actorType === ACTOR.SUMMON;
    const entityIndex = effect.type === 'condition' ? effect.phantasmEntityIndex : undefined;
    const qualifier = companion
      ? entityIndex == null
        ? 'per phantasm'
        : `phantasm ${entityIndex + 1} only`
      : 'player effect';

    if (effect.type !== 'condition' || !effect.packetLabel) return simulationEffectFacts([effect], qualifier).facts;

    const label = effect.packetLabel;
    const packetCount = (index: number) => phantasmAttackCycle(selected, timing, index, label).initial?.length;
    const factsFor = (count: number | undefined, recipient: string) =>
      simulationEffectFacts(
        [count ? { ...effect, ticks: undefined, stacks: (effect.stacks ?? 1) / count, applications: count } : effect],
        recipient
      ).facts;

    if (entityIndex != null) return factsFor(packetCount(entityIndex), qualifier);

    // Co-summoned phantasms share one fact only when they apply the same number of packets.
    const entities = Math.max(
      selected.resource?.count ?? 1,
      selected.resource?.clarityCount ?? 0,
      timing?.damageTicksByEntity?.length ?? 0
    );
    const counts = Array.from({ length: entities }, (_, index) => packetCount(index));
    return counts.every((count) => count === counts[0])
      ? factsFor(counts[0], qualifier)
      : counts.flatMap((count, index) => factsFor(count, `phantasm ${index + 1}`));
  });
  facts.push({ name: 'Base phantasms summoned', detail: tooltipDecimal(tooltipNumber(selected.resource!, 'count')) });
  return {
    description:
      `Summon phantasms to attack your target and generate ${mesmerResourceKind(specialization)}. Effects from your character apply once per cast; phantasm effects are listed per summon. Traits can summon extra phantasms or make them attack again.` +
      (selected.id === ID.PHANTASMAL_LANCER
        ? ' Consuming Clarity summons an additional Lancer; only that second phantasm immobilizes.'
        : ''),
    facts
  };
};

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const mesmerCoreTooltips = {
  skillFacts: (context, entity, build) => {
    const selected = entity as MesmerSkill;
    const resource = mesmerResourceKind(equippedEliteSpecialization(context.catalog, build));
    // Follow-up facts use the runtime's window and fraction of parent base recharge.
    return [
      ...(selected.resource?.mode === 'add'
        ? [
            {
              name: 'Resources generated',
              detail: `${tooltipDecimal(tooltipNumber(selected.resource, 'count'))} ${selected.resource.count === 1 ? resource.slice(0, -1) : resource}`
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
      ...(selected.cost?.amount == null
        ? []
        : [{ name: 'Endurance spent', detail: tooltipDecimal(selected.cost.amount) }])
    ];
  },
  skills: {
    [ID.ETHER_FEAST]: skillTooltip('Heal yourself and cleanse conditions. Active clones improve the heal.'),
    [ID.MIRROR]: skillTooltip('Reflect incoming projectiles while healing yourself.'),
    [ID.TEMPORAL_CURTAIN]: skillTooltip('Place a curtain and unlock Into the Void to pull foes through it.'),
    [ID.MIRROR_IMAGES]: skillTooltip("Create images of yourself and gain your specialization's illusion resource."),
    [ID.MANTRA_OF_PAIN]: skillTooltip('Prepare Power Spike and refill its charges.'),
    [ID.MANTRA_OF_RECOVERY]: skillTooltip('Prepare Power Return and refill its charges.'),
    [ID.POWER_RETURN]: skillTooltip('Spend a prepared charge to heal yourself.'),
    [ID.MASS_INVISIBILITY]: skillTooltip('Hide yourself and nearby allies. This cast has no simulated stealth effect.'),
    [ID.ILLUSIONARY_COUNTER]: skillTooltip('Raise a block and unlock Counterspell.'),
    [ID.ILLUSIONARY_RIPOSTE]: skillTooltip('Raise a block and unlock Counter Blade.'),
    [ID.FEEDBACK]: skillTooltip('Create a dome that reflects incoming projectiles.'),
    [ID.PHASE_RETREAT]: skillTooltip(
      "Teleport away from your target and gain your specialization's illusion resource."
    ),
    [ID.SWAP]: skillTooltip('Trade places with your clone and unlock Disenchant.'),
    [ID.DIMENSIONAL_APERTURE]: skillTooltip(
      "Collapse the singularity to open a portal and lengthen Singularity Shot's recharge."
    ),
    [ID.SINGULARITY_SHOT]: skillTooltip('Place a singularity and unlock Dimensional Aperture.'),
    // The skill card and modifier reference share Mind Stab's selected intrinsic rule parameters.
    [ID.MIND_STAB]: skillTooltip(
      "Strike your target. Gain an additional damage bonus per Vulnerability stack, multiplying separately from the target's ordinary Vulnerability bonus.",
      [
        fromModifier(
          'mesmer.mind-stab-vulnerability',
          'damagePerStack',
          'Additional strike damage per Vulnerability stack'
        )
      ]
    ),
    ...Object.fromEntries(
      MESMER_CORE_SKILLS.filter((skill) => skill.phantasmTiming).map((skill) => [skill.id, phantasmTooltip])
    ),
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
      'Create a storm that strikes repeatedly. The first pulse dazes the target. Each pulse has a one-in-three chance to apply Poisoned.',
      (context) =>
        chaosStormPoisonFacts(
          simulationEffectFacts(requireSkillAction(requireSkill(context.catalog, ID.CHAOS_STORM), 'poison').effects)
            .facts
        )
    ),
    [ID.SIGNET_OF_ILLUSIONS]: (context, entity, _specialization, build) => {
      const resource = mesmerResourceKind(equippedEliteSpecialization(context.catalog, build));
      return skillTooltip(
        `Signet Passive: Generate ${resource} while equipped and recharged. Signet Active: Reset shatter and instrument cooldowns, restoring one ammunition charge where applicable. Continuum Split is excluded. The passive resumes when the signet recharges.`,
        [
          fromSkill(ID.SIGNET_OF_ILLUSIONS, 'pulseInterval', 'Passive interval', tooltipSeconds),
          fromSkill(
            ID.SIGNET_OF_ILLUSIONS,
            'resourceGain',
            `${resource[0].toUpperCase()}${resource.slice(1)} per passive pulse`
          )
        ]
      )(context, entity);
    },
    [ID.SIGNET_OF_THE_ETHER]: skillTooltip(
      "Reset phantasm skill cooldowns. Its healing has no effect on the simulator's fixed player health."
    ),
    [ID.SIGNET_OF_DOMINATION]: skillTooltip(
      'Passively gain condition damage while the signet is available. Activate to stun your target.',
      (context) => [
        {
          name: 'Passive condition damage',
          detail: tooltipDecimal(
            skillNumber(requireSkill(context.catalog, ID.SIGNET_OF_DOMINATION), 'attributeBonuses.conditionDamage')
          )
        }
      ]
    ),
    [ID.SIGNET_OF_MIDNIGHT]: skillTooltip(
      'Passively gain expertise while the signet is available. Activate to blind nearby enemies.',
      (context) => [
        {
          name: 'Passive expertise',
          detail: tooltipDecimal(
            skillNumber(requireSkill(context.catalog, ID.SIGNET_OF_MIDNIGHT), 'attributeBonuses.expertise')
          )
        }
      ]
    ),
    [ID.MIMIC]: skillTooltip(
      "Arm a window for your next completed utility skill. If its cast begins within the window, reduce its recharge to 1 second and add its original recharge to Mimic's base 20-second recharge, before Alacrity. Continuum Split does not restore Mimic's recharge. Follow-up skills do not consume Mimic; ammunition charges are not replenished.",
      [fromSkill(ID.MIMIC, 'duration', 'Mimic window', tooltipSeconds)]
    ),
    [ID.MIND_THE_GAP]: skillTooltip('Strike, generate a resource, and gain Clarity for a later spear skill.'),
    [ID.IMAGINARY_INVERSION]: skillTooltip(
      "Strike your target and consume Clarity if present. Healing and incoming-damage avoidance do not change the simulated player's health."
    ),
    [ID.ETHER_CLONE]: skillTooltip(
      'Strike and generate a clone. If already at the clone limit when the strike lands, inflict the additional condition instead. Other specializations generate their own resource.',
      (context) =>
        simulationEffectFacts(
          requireSkillAction(requireSkill(context.catalog, ID.ETHER_CLONE), 'clone-limit').effects,
          'instead of creating a clone at the clone limit'
        ).facts
    ),
    [ID.FLYING_CUTTER]: (context, entity) => {
      // Separate the triggered burst from the projectile, using the selected patch for its trigger and damage.
      const skill = requireSkill(context.catalog, entity.id) as MesmerSkill;
      const tracked = skill.trackedHitDamage!;
      const projectile = simulationEffectFacts(skill.effects?.map((effect) => ({ ...effect, name: undefined })));
      const burst = simulationEffectFacts([{ ...tracked, type: 'strike', name: undefined }]);
      return {
        description: `Throw a blade at your target. Land ${tooltipDecimal(tracked.hitsRequired)} Flying Cutter hits within ${tooltipSeconds(tracked.duration)} to trigger ${tracked.name}.`,
        facts: projectile.facts.map((fact) => ({
          ...fact,
          name: fact.name === 'Strike damage' ? 'Projectile' : fact.name
        })),
        factSections: [{ label: tracked.name, facts: burst.facts.map((fact) => ({ ...fact, name: 'Damage' })) }],
        incomplete: projectile.incomplete || burst.incomplete
      };
    },
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
