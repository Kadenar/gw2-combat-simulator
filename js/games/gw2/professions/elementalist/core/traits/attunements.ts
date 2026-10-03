import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import {
  emitElementalistBuff,
  emitElementalistCondition,
  emitElementalistDamage
} from '#gw2/professions/elementalist/core/events.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  combatStarted,
  elementalistEventSkill,
  emitElementalistProc,
  emitProfiledBuff,
  emitProfiledCondition
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistAttunementTraitDispatch } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Emits Electric Discharge from a qualifying Air-attunement transition. */
export function triggerElectricDischarge(context: ElementalistRuntime, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.ELECTRIC_DISCHARGE)) return;
  const electricDischargeProfile = requireBalanceProfileFromContext(context, TRAIT.ELECTRIC_DISCHARGE);
  const electricDischargeStrike = requireEffect(electricDischargeProfile, 'strike', 'Electric Discharge');
  if (electricDischargeStrike) {
    emitElementalistDamage(context, {
      at,
      source: 'Electric Discharge',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Electric Discharge',
      coefficient: effectNumber(electricDischargeProfile, electricDischargeStrike, 'coefficient'),
      skillWeapon: 'Unequipped'
    });
  }

  const conditionEmitted = emitProfiledCondition(
    context,
    at,
    TRAIT.ELECTRIC_DISCHARGE,
    'Electric Discharge',
    'Electric Discharge',
    sourceId
  );
  if (electricDischargeStrike || conditionEmitted)
    emitElementalistProc(context, {
      at,
      name: 'Electric Discharge',
      procType: 'trait',
      sourceId,
      sourceSkill: context.helpers.skillsById.get(sourceId)?.name
    });
}

/** Opens Fresh Air's ferocity window when an attunement transition newly enters Air. */
export function applyFreshAirAttunementEntry(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  previous: string
): void {
  if (previous === 'Air' || !hasTrait(context, TRAIT.FRESH_AIR)) return;
  const freshAirProfile = requireBalanceProfileFromContext(context, TRAIT.FRESH_AIR);
  const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
  if (freshAir) {
    emitElementalistBuff(context, {
      skill: skill,
      at,
      source: 'Trait',
      sourceId: TRAIT.FRESH_AIR,
      actorType: 'player',
      kind: 'fresh air',
      stacks: Number(freshAir.stacks),
      duration: freshAir.duration,
      skillName: skill.name,
      priority: -10
    });
  }
}

/** Reads Superspeed as a buff so profile overrides apply without boon-duration scaling. */
export function applyOneWithAir(context: ElementalistRuntime, at: number, skill: Skill): void {
  if (!hasTrait(context, TRAIT.ONE_WITH_AIR)) return;
  const oneWithAirProfile = requireBalanceProfileFromContext(context, TRAIT.ONE_WITH_AIR);
  const superspeed = requireEffect(oneWithAirProfile, 'buff', 'Superspeed');
  if (superspeed) {
    emitElementalistBuff(context, {
      skill: skill,
      at,
      source: 'Trait',
      sourceId: TRAIT.ONE_WITH_AIR,
      actorType: 'player',
      kind: String(superspeed.kind).toLowerCase(),
      stacks: Number(superspeed.stacks),
      duration: superspeed.duration,
      skillName: skill.name
    });
  }
}

/** Grants Inscription's dedicated Resistance effect after entering Air. */
export function applyInscriptionAirEntry(context: ElementalistRuntime, at: number, skill: Skill): void {
  if (hasTrait(context, TRAIT.INSCRIPTION)) {
    emitProfiledBuff(context, at, TRAIT.INSCRIPTION, 'Air Entry', skill.name, skill.id);
  }
}

/** Apply Air transition traits at the dispatcher's original phase, honoring elite entry vetoes. */
export function applyAirAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch
): void {
  const { at, skill, previous, target, shouldTrigger } = dispatch;
  if (target === 'Air') {
    if (shouldTrigger('Air', TRAIT.ELECTRIC_DISCHARGE)) triggerElectricDischarge(context, at, skill.id);
    applyFreshAirAttunementEntry(context, at, skill, previous);
    applyOneWithAir(context, at, skill);
    applyInscriptionAirEntry(context, at, skill);
  }
}

/** A familiar-triggered Air entry refreshes Fresh Air without requiring a preceding different element. */
export function applyFreshAirSyntheticEntry(context: ElementalistRuntime, at: number, skill: Skill): void {
  if (hasTrait(context, TRAIT.FRESH_AIR)) {
    const freshAirProfile = requireBalanceProfileFromContext(context, TRAIT.FRESH_AIR);
    const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
    if (freshAir) {
      emitElementalistBuff(context, {
        skill: skill,
        at,
        source: 'Trait',
        sourceId: TRAIT.FRESH_AIR,
        actorType: 'player',
        kind: String(freshAir.kind).toLowerCase(),
        stacks: Number(freshAir.stacks),
        duration: freshAir.duration,
        skillName: skill.name
      });
    }
  }
}

/** Grants Arcane Prowess might for one completed attunement transition. */
export function applyArcaneProwess(context: ElementalistRuntime, at: number, sourceId: Skill['id']): void {
  if (hasTrait(context, TRAIT.ARCANE_PROWESS)) {
    emitProfiledBuff(context, at, TRAIT.ARCANE_PROWESS, 'Might', 'Arcane Prowess', sourceId);
  }
}

/** Grants Elemental Attunement's boon matching the element just entered. */
export function grantElementalAttunementBoon(
  context: ElementalistRuntime,
  at: number,
  attunement: ElementalistAttunement,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, TRAIT.ELEMENTAL_ATTUNEMENT)) return;
  emitProfiledBuff(context, at, TRAIT.ELEMENTAL_ATTUNEMENT, attunement, 'Elemental Attunement', sourceId);
}

/** Accumulates Bountiful Power swaps and grants each completed threshold's timed effects. */
export function triggerBountifulPower(
  context: ElementalistRuntime,
  at: number,
  stacks: number,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, TRAIT.BOUNTIFUL_POWER)) return;
  const bountifulPowerProfile = requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_POWER);
  const threshold = balanceProfileNumber(bountifulPowerProfile, 'threshold');
  // Nonpositive custom thresholds disable this proc so each loop iteration must consume progress.
  if (threshold <= 0) return;
  const state = professionCoreState(context);
  state.bountifulPowerProgress += stacks;
  while (state.bountifulPowerProgress >= threshold) {
    state.bountifulPowerProgress -= threshold;
    emitProfiledBuff(context, at, TRAIT.BOUNTIFUL_POWER, 'Quickness', 'Bountiful Power', sourceId);
    const active = requireEffect(bountifulPowerProfile, 'buff', 'Damage Window');
    if (active) {
      emitElementalistBuff(context, {
        skill: elementalistEventSkill(context, 'Bountiful Power', sourceId),
        at,
        source: 'Trait',
        sourceId: TRAIT.BOUNTIFUL_POWER,
        actorType: 'player',
        kind: 'bountiful power active',
        stacks: Number(active.stacks),
        duration: active.duration,
        skillName: 'Bountiful Power'
      });
    }
  }
}

/** Apply Arcane transition traits at the dispatcher's original phase, honoring elite entry vetoes. */
export function applyArcaneAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch
): void {
  const { at, skill, previous, target, dualAttunement } = dispatch;
  applyArcaneProwess(context, at, skill.id);
  if (!dualAttunement || target !== previous) grantElementalAttunementBoon(context, at, target, skill.id);
  if (!dualAttunement) triggerBountifulPower(context, at, 1, skill.id);
}

const EARTHEN_BLAST_ICON = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';

/** Emits Earthen Blast's uncritable strike after entering Earth in combat. */
export function triggerEarthenBlast(context: ElementalistRuntime, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.EARTHEN_BLAST)) return;
  // Use the same attunement or overload trigger for the damage packet and its proc record.
  const sourceSkill = context.helpers.skillsById.get(sourceId)?.name || '';
  const earthenBlastProfile = requireBalanceProfileFromContext(context, TRAIT.EARTHEN_BLAST);
  const earthenBlastStrike = requireEffect(earthenBlastProfile, 'strike', 'Earthen Blast');
  if (earthenBlastStrike) {
    emitElementalistDamage(context, {
      at,
      source: 'Earthen Blast',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Earthen Blast',
      triggeredBy: sourceSkill,
      icon: EARTHEN_BLAST_ICON,
      coefficient: effectNumber(earthenBlastProfile, earthenBlastStrike, 'coefficient'),
      skillWeapon: 'Unequipped',
      canCrit: false
    });

    emitElementalistProc(context, {
      at,
      name: 'Earthen Blast',
      procType: 'trait',
      sourceId,
      sourceSkill,
      icon: EARTHEN_BLAST_ICON
    });
  }
}

/** Grants Rock Solid's Stability after entering Earth in combat. */
export function grantElementalistRockSolid(context: ElementalistRuntime, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.ROCK_SOLID)) return;
  emitProfiledBuff(context, at, TRAIT.ROCK_SOLID, 'Stability', 'Rock Solid', sourceId);
}

/** Apply Earth transition traits at the dispatcher's original phase, honoring elite entry vetoes. */
export function applyEarthAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch
): void {
  const { at, skill, target, shouldTrigger } = dispatch;
  if (target === 'Earth') {
    if (shouldTrigger('Earth', TRAIT.EARTHEN_BLAST)) triggerEarthenBlast(context, at, skill.id);
    if (shouldTrigger('Earth', TRAIT.ROCK_SOLID)) grantElementalistRockSolid(context, at, skill.id);
  }
}

const SUNSPOT_ICON = 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png';

const FLAME_EXPULSION_ICON = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';

// Materialize Sunspot's aura, strike, Burning, and proc at the entry timestamp.
export function triggerSunspot(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  applyAura: ElementalistAuraApplier
): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.SUNSPOT)) return;

  // Keep strike and Burning attribution aligned with the actual attunement or overload that triggered Sunspot.
  const sourceSkill = context.helpers.skillsById.get(sourceId)?.name || '';
  const sunspotProfile = requireBalanceProfileFromContext(context, TRAIT.SUNSPOT);
  const sunspotAura = requireEffect(sunspotProfile, 'buff', 'Sunspot Aura');
  if (sunspotAura) {
    applyAura(context, {
      at,
      aura: String(sunspotAura.kind),
      duration: sunspotAura.duration,
      skillName: 'Sunspot',
      sourceId
    });
  }

  const sunspotStrike = requireEffect(sunspotProfile, 'strike', 'Sunspot');
  if (sunspotStrike) {
    emitElementalistDamage(context, {
      at,
      source: 'Sunspot',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Sunspot',
      icon: SUNSPOT_ICON,
      triggeredBy: sourceSkill,
      coefficient: effectNumber(sunspotProfile, sunspotStrike, 'coefficient'),
      skillWeapon: 'Unequipped',
      canCrit: false
    });
  }

  const burningEmitted =
    hasTrait(context, TRAIT.BURNING_RAGE) &&
    emitProfiledCondition(context, at, TRAIT.BURNING_RAGE, 'Sunspot Burning', 'Sunspot', sourceId, sourceSkill);

  if (sunspotAura || sunspotStrike || burningEmitted)
    emitElementalistProc(context, {
      at,
      name: 'Sunspot',
      procType: 'trait',
      sourceId,
      sourceSkill,
      icon: SUNSPOT_ICON
    });
}

// Snapshot capped Might on Fire exit; the delayed blast damages enemies and grants that Might to other allies.
export function triggerFlameExpulsion(context: ElementalistRuntime, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.PYROMANCERS_PUISSANCE)) return;

  const pyromancersPuissanceProfile = requireBalanceProfileFromContext(context, TRAIT.PYROMANCERS_PUISSANCE);
  const impactAt = at + balanceProfileNumber(pyromancersPuissanceProfile, 'initialDelay');
  const cappedMight = Math.min(
    balanceProfileNumber(pyromancersPuissanceProfile, 'maximumStacks'),
    context.config.boons?.might
      ? Number(context.config.boons.might)
      : buffApplicationStacks(context.boons.get('might') ?? [], 'might', at, 25, {
          includes: (application) => application.resolvedAudience.includesSelf
        })
  );
  const flameExpulsionStrike = requireEffect(pyromancersPuissanceProfile, 'strike', 'Flame Expulsion');
  const flameExpulsionCondition = requireEffect(pyromancersPuissanceProfile, 'condition', 'Flame Expulsion');
  if (flameExpulsionStrike) {
    const baseCoefficient = effectNumber(pyromancersPuissanceProfile, flameExpulsionStrike, 'coefficient');
    const coefficientPerMight = balanceProfileNumber(pyromancersPuissanceProfile, 'damageIncreasePerStack');
    emitElementalistDamage(context, {
      at: impactAt,
      source: 'Flame Expulsion',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Flame Expulsion',
      icon: FLAME_EXPULSION_ICON,
      coefficient: baseCoefficient + coefficientPerMight * cappedMight,
      skillWeapon: 'Unequipped'
    });
  }

  if (flameExpulsionCondition) {
    const baseBurningDuration = Number(flameExpulsionCondition.duration);
    const burningDurationPerMight = balanceProfileNumber(pyromancersPuissanceProfile, 'durationPerTier');

    emitElementalistCondition(context, {
      skill: elementalistEventSkill(context, 'Flame Expulsion', sourceId),
      at: impactAt,
      source: 'Flame Expulsion',
      sourceId,
      condition: String(flameExpulsionCondition.condition),
      stacks: Number(flameExpulsionCondition.stacks),
      duration: Math.min(
        baseBurningDuration + burningDurationPerMight * cappedMight,
        baseBurningDuration +
          burningDurationPerMight * balanceProfileNumber(pyromancersPuissanceProfile, 'maximumStacks')
      ),
      skillName: 'Flame Expulsion'
    });
  }

  const pyromancersPuissanceFlameExpulsionMight = requireEffect(
    pyromancersPuissanceProfile,
    'boon',
    'Flame Expulsion Might'
  );
  if (cappedMight > 0) {
    if (pyromancersPuissanceFlameExpulsionMight) {
      emitElementalistBuff(context, {
        skill: elementalistEventSkill(context, 'Flame Expulsion', sourceId),
        at: impactAt,
        source: 'Trait',
        sourceId: TRAIT.PYROMANCERS_PUISSANCE,
        skillName: 'Flame Expulsion',
        kind: String(pyromancersPuissanceFlameExpulsionMight.boon).toLowerCase(),
        stacks: cappedMight,
        duration: pyromancersPuissanceFlameExpulsionMight.duration,
        audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 5 }
      });
    }
  }

  if (flameExpulsionStrike || flameExpulsionCondition || (cappedMight > 0 && pyromancersPuissanceFlameExpulsionMight))
    emitElementalistProc(context, {
      at: impactAt,
      name: 'Flame Expulsion',
      procType: 'trait',
      sourceId,
      sourceSkill: context.helpers.skillsById.get(sourceId)?.name,
      icon: FLAME_EXPULSION_ICON
    });
}

/** Apply Fire transition traits at the dispatcher's original phase, honoring elite entry vetoes. */
export function applyFireAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch,
  applyAura: ElementalistAuraApplier
): void {
  const { at, skill, previous, target, shouldTrigger } = dispatch;
  if (previous === 'Fire' && target !== 'Fire' && shouldTrigger('Fire', TRAIT.PYROMANCERS_PUISSANCE)) {
    triggerFlameExpulsion(context, at, skill.id);
  }

  if (target === 'Fire' && shouldTrigger('Fire', TRAIT.SUNSPOT)) triggerSunspot(context, at, skill.id, applyAura);
}
