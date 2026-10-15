import {
  fromModifier,
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import {
  RITUALIST_SPIRIT_SKILL_IDS,
  spiritAttackEffects
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-projection.js';
import { RITUALIST_BALANCE_PROFILE_IDS as RITUALIST } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { lifeForce, shroudTooltip } from '#gw2/professions/necromancer/app/tooltips/shared.js';

const innervateTooltip: DescribeSimulationTooltip = skillTooltip(
  'Command the corresponding active spirit to apply its listed effects and restore life force. The spirit must be available for the command.'
);

// Project charge grants from the selected build so the skill card agrees with Wielder's Boon's runtime grant.
const weaponSpellTooltip: DescribeSimulationTooltip = (balanceContext, entity, _specialization, build) => {
  const skill = balanceContext.catalog.skillsById.get(entity.id);
  if (!skill) throw new Error(`Missing tooltip skill: ${entity.id}`);
  const empowered = getActiveTraits(build?.specializations).some(({ id }) => id === TRAIT.WIELDERS_BOON);
  const effects = (skill.effects ?? []).map((effect) => {
    if (effect.type !== 'buff' || !['nightmare-weapon', 'splinter-weapon'].includes(String(effect.kind)))
      return simulationEffectFacts([effect]);
    const personal = tooltipNumber(effect, 'stacks');
    const allied = empowered ? personal : tooltipNumber(effect, 'allyStacks');
    return simulationEffectFacts(
      [{ ...effect, allyStacks: undefined }],
      `${personal} charges on yourself · ${allied} charges on each ally`
    );
  });
  const profileId = (
    {
      [ID.NIGHTMARE_WEAPON]: RITUALIST.nightmareWeaponProc,
      [ID.SPLINTER_WEAPON]: RITUALIST.splinterWeaponProc
    } as Record<number, string>
  )[Number(entity.id)];
  return {
    description:
      'Grant weapon-spell charges to yourself and eligible party recipients. Their qualifying strikes spend charges to trigger the listed attack, with an independent interval for each recipient.' +
      (empowered ? " Wielder's Boon is selected: allies receive your full charge count." : ''),
    incomplete: effects.some((model) => model.incomplete),
    facts: [
      ...effects.flatMap((model) => model.facts),
      ...(profileId
        ? [
            ...simulationEffectFacts(tooltipProfile(balanceContext, profileId).effects, 'per charge spent').facts,
            profileFact(balanceContext, profileId, 'internalCooldown', 'Minimum interval per recipient', tooltipSeconds)
          ]
        : [])
    ]
  };
};

// Spirit owners select named attack roles; this layer formats their selected summon and command packets.
const ritualistTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);
  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
  const id = Number(entity.id);
  if (id === ID.ESSENCE_BLAST)
    return skillTooltip("Strike your target. Each active spirit increases this attack's damage.", [
      fromModifier('necromancer.essence-blast-active-spirits', 'damagePerSpirit', 'Strike damage per active spirit')
    ])(balanceContext, entity);
  if (id === ID.SUMMON_SPIRITS)
    return {
      description:
        'Command available active spirits to perform their coordinated attacks. Spirits still in their opening attack cannot participate. Wanderlust also dazes; Preservation has no direct damage from this command.',
      facts: RITUALIST_SPIRIT_SKILL_IDS.flatMap((skillId) => {
        const attack = spiritAttackEffects(balanceContext, skillId)!.active;
        return attack
          ? simulationEffectFacts([attack], `requires ${balanceContext.catalog.skillsById.get(skillId)!.name}`).facts
          : [];
      })
    };
  const attacks = spiritAttackEffects(balanceContext, id)!;
  const { profile } = attacks;
  return {
    description:
      'Summon or replace this spirit, apply its opening effects, and start its autonomous attacks. Busy spirits skip recurring attack opportunities.' +
      (id === ID.ANGUISH
        ? ' Anguish opens with cripple and vulnerability; its first barrage hit applies Painful Bond for recurring damage.'
        : id === ID.WANDERLUST
          ? ' Wanderlust opens with a strike and a lingering field that successively applies chill, vulnerability, weakness, and slow.'
          : ' Preservation grants party protection and vigor.'),
    facts: [
      ...simulationEffectFacts(selected.effects, 'on summon').facts,
      ...simulationEffectFacts(
        [attacks.autoattack, attacks.initial, attacks.lingering].flatMap((effect) => (effect ? [effect] : []))
      ).facts,
      ...simulationEffectFacts(
        profile.effects?.filter((effect) => effect.type === 'condition'),
        'opening conditions'
      ).facts,
      profileFact(
        balanceContext,
        RITUALIST.resources,
        'pulseInterval',
        'Autonomous attack pulse interval',
        tooltipSeconds
      ),
      ...(id === ID.ANGUISH
        ? [
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, RITUALIST.painfulBond).effects?.filter((effect) => effect.type === 'buff')
            ).facts,
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, RITUALIST.painfulBond).effects?.filter(
                (effect) => effect.type === 'strike'
              ),
              'per Painful Bond pulse'
            ).facts,
            profileFact(
              balanceContext,
              RITUALIST.painfulBond,
              'pulseInterval',
              'Painful Bond pulse interval',
              tooltipSeconds
            )
          ]
        : [])
    ]
  };
};

/** Describe ritualist tooltips from the selected balance data. */
export const ritualistTooltips = {
  skills: {
    [ID.INNERVATE_PRESERVATION]: innervateTooltip,
    [ID.INNERVATE_WANDERLUST]: innervateTooltip,
    [ID.INNERVATE_ANGUISH]: innervateTooltip,
    [ID.NIGHTMARE_WEAPON]: weaponSpellTooltip,
    [ID.SPLINTER_WEAPON]: weaponSpellTooltip,
    [ID.SUMMON_SPIRITS]: ritualistTooltip,
    [ID.PRESERVATION]: ritualistTooltip,
    [ID.ANGUISH]: ritualistTooltip,
    [ID.WANDERLUST]: ritualistTooltip,
    [ID.ESSENCE_BLAST]: ritualistTooltip,
    [ID.EXIT_RITUALISTS_SHROUD]: shroudTooltip,
    [ID.RITUALISTS_SHROUD]: shroudTooltip,
    [ID.RESILIENT_WEAPON]: skillTooltip(
      "Grant Resilient Weapon charges to yourself and eligible party recipients. Wielder's Boon grants allies your full charge count. Its defensive effects add no damage within simulation scope."
    )
  },
  traits: {
    [TRAIT.SPAWNING_POWER]: traitTooltip(
      'This specialization summons spirits and uses soul shards and Innervate commands.'
    ),
    [TRAIT.BOON_OF_CREATION]: traitTooltip('Gain concentration. Summoning a creature generates life force.', [
      ['attributeBonus', 'Concentration'],
      ['lifeForceGain', 'Life force per creature summoned', lifeForce]
    ]),
    [TRAIT.CHARGED_SOULS]: traitTooltip(
      'Unlock Innervate skills that command your active spirits. Each Innervate restores life force.'
    ),
    [TRAIT.WANDERING_SPIRITS]: outsideScopeTooltip,
    [TRAIT.SPIRITS_GIFT]: outsideScopeTooltip,
    [TRAIT.EXPLOSIVE_GROWTH]: traitTooltip('Summoning a creature triggers a strike.'),
    [TRAIT.SPIRITS_REMEDY]: outsideScopeTooltip,
    [TRAIT.EMPOWERING_SPIRITS]: traitTooltip('Spirit interactions grant the modeled party boons.'),
    [TRAIT.SPIRITS_STRENGTH]: traitTooltip('Increase autonomous creature damage. Innervate attacks are excluded.', [
      ['damageMultiplier', 'Creature strike damage', tooltipFactorChange]
    ]),
    [TRAIT.WIELDERS_BOON]: traitTooltip(
      'Nightmare Weapon and Splinter Weapon grant each eligible ally as many charges as you receive, replacing their reduced ally charge count. Your own charge count stays the same.',
      // Read both counts from the selected skills so the explanation also follows balance previews.
      (context) =>
        [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON].flatMap((id) => {
          const skill = context.catalog.skillsById.get(id)!;
          return (skill.effects ?? [])
            .filter((effect) => effect.type === 'buff')
            .map((effect) => ({
              name: skill.name,
              icon: skill.icon,
              detail: `${tooltipNumber(effect, 'allyStacks')} → ${tooltipNumber(effect, 'stacks')} charges per ally`
            }));
        })
    ),
    [TRAIT.LINGERING_SPIRITS]: traitTooltip(
      'Spirits persist through the modeled shroud transition. Active Anguish increases strike damage.',
      [fromProfile(TRAIT.LINGERING_SPIRITS, 'damageIncrease', 'Strike damage with Anguish active', tooltipPercent)]
    ),
    [TRAIT.SOUL_TWISTING]: traitTooltip(
      "Entering Ritualist's Shroud causes your next spirit summon to clear its own cooldown."
    )
  }
} satisfies ProfessionTooltips;
