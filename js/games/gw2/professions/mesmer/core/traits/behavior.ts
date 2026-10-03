import { emitMesmerTraitBuffs } from '#gw2/professions/mesmer/core/mechanics/trait-buffs.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, Skill, StrikeTick } from '#gw2/platform/engine/skills/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { timedStacks } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerShatter, MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerProfiledTraitDamage } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerConditionApplication, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type {
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerEmitDerivedEvent,
  MesmerMechanics,
  MesmerResolverContext,
  MesmerResolverEvent,
  MesmerRuntime,
  MesmerRuntimeState
} from '#gw2/professions/mesmer/types.js';
import { EPSILON } from '#kernel/core/clock.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';

interface MethodOfMadnessContext {
  readonly state: MesmerRuntime;
  readonly addDamage: MesmerAddDamage;
  readonly addTraitProc: MesmerAddTraitProc;
}

/**
 * Recharges the active weapon set's deterministic phantasm target when a
 * qualifying interrupt lands, evaluating cooldown state at the impact time.
 */
export function triggerChaoticInterruption(context: MesmerRuntime, event: SimulationEvent, skillName: string): void {
  const runtime = mesmerMechanicsFor(context);
  if (!hasTrait(context, TRAIT.CHAOTIC_INTERRUPTION) || !context.config.target?.activatingSkills) {
    return;
  }

  const defiant = Boolean(context.config.target.defiant);
  const set = context.activeWeaponSet;
  const [configuredMainhand, configuredOffhand] = gw2ConfiguredWeaponSet(context.config, set);
  const [primaryMainhand, primaryOffhand] = gw2ConfiguredWeaponSet(context.config, 1);
  const mainhand = configuredMainhand || primaryMainhand;
  const offhand = configuredOffhand || primaryOffhand;

  let targetId: number | null = null;
  if (mainhand === 'Staff') targetId = ID.PHANTASMAL_WARLOCK;
  else if (offhand === 'Pistol') targetId = ID.PHANTASMAL_DUELIST;
  else if (offhand === 'Torch') targetId = ID.PHANTASMAL_MAGE;

  if (targetId == null) return;

  // Only affects weapon skills that are recharging.
  const readyAt = context.cooldowns.get(targetId) || 0;
  if (!(readyAt > event.at + EPSILON)) return;
  const chaoticInterruptionProfile = requireBalanceProfileFromContext(context, TRAIT.CHAOTIC_INTERRUPTION);
  const reduction = balanceProfileNumber(chaoticInterruptionProfile, 'recharge');
  const target = context.helpers.skillsById.get(targetId);
  if (!target) return;
  // Only a defiant target consumes an interval, after a recharging weapon skill has been selected.
  if (defiant && !context.procs.claim(TRAIT.CHAOTIC_INTERRUPTION, TRAIT.CHAOTIC_INTERRUPTION, event.at)) return;
  context.cooldownController.reduceSkillRecharge(target, reduction, event.at);

  runtime.addTraitProc(
    'Chaotic Interruption',
    event.at,
    skillName,
    `${context.helpers.skillsById.get(targetId)?.name || 'weapon skill'} recharge -${reduction}s`
  );
}

/** Applies Illusionary Membrane after earlier post-resolution shatter traits. */
export function triggerIllusionaryMembrane(
  context: Readonly<Pick<MesmerMechanics, 'context' | 'addEvent' | 'addTraitProc'>>,
  shatter: MesmerShatter | undefined,
  skillName: string,
  at: number
): void {
  if (shatter?.slot !== 2 || !hasTrait(context.context, TRAIT.ILLUSIONARY_MEMBRANE)) return;
  const illusionaryMembraneProfile = requireBalanceProfileFromContext(context.context, TRAIT.ILLUSIONARY_MEMBRANE);
  const effect = requireEffect(illusionaryMembraneProfile, 'buff', 'illusionary-membrane');
  if (!effect) return;
  emitMesmerTraitBuffs(context, TRAIT.ILLUSIONARY_MEMBRANE, at, skillName, [
    {
      // Resolve after the same-time shatter packets without inventing elapsed time.
      priority: 5,
      kind: 'illusionary-membrane',
      stacks: Number(effect.stacks),
      duration: effect.duration
    }
  ]);
}

/** Emits Method of Madness at the owning healing-skill completion position. */
export function triggerMethodOfMadness(
  context: MethodOfMadnessContext,
  skill: MesmerSkill,
  at: number,
  storm: MesmerTraitDamage
): void {
  if (skill.type !== 'Heal' || !hasTrait(context.state, TRAIT.METHOD_OF_MADNESS)) return;
  const readyAt = context.state.procs.readyAt[TRAIT.METHOD_OF_MADNESS] || 0;
  if (!isInternalCooldownReady(at, readyAt)) return;
  // A removed storm has no attack, proc, or attack-owned cooldown.
  if (storm.type !== 'strike') return;
  context.addDamage(
    {
      id: 'Lesser Chaos Storm',
      name: 'Lesser Chaos Storm',
      weapon: 'Utility',
      blade: false
    },
    at,
    {
      ...storm,
      summonKind: undefined,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      source: 'Player',
      weapon: 'utility'
    }
  );
  context.addTraitProc('Method of Madness', at, skill.name);
  // Elite consequences follow the accepted mechanic, independently of its diagnostic marker.
  mesmerMechanicsFor(context.state).methodOfMadnessCommitted?.(at);
  context.state.procs.readyAt[TRAIT.METHOD_OF_MADNESS] = at + (storm.cooldown || 0);
}

/** Compile the selected storm before the shared runtime begins processing casts. */
export function methodOfMadnessDamage(context: unknown): MesmerTraitDamage {
  return mesmerProfiledTraitDamage(context, { requiresCooldown: true }, TRAIT.METHOD_OF_MADNESS);
}

/** Selection and fixed profile values share the parent attribute-query cache. */
export function prepareChaoticPersistence(context: Gw2ModifierContext) {
  const selected = hasTrait(context, TRAIT.CHAOTIC_PERSISTENCE);
  return {
    expertise: selected
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CHAOTIC_PERSISTENCE), 'expertiseBonus')
      : 0,
    concentration: selected
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CHAOTIC_PERSISTENCE), 'concentrationBonus')
      : 0
  };
}

/** Reconcile assumed Regeneration against its live state without applying the build bonus twice. */
export function chaoticPersistenceAttributes(
  context: Gw2ModifierContext,
  facts: ReturnType<typeof prepareChaoticPersistence>
) {
  const delta =
    Number(boonActive(context, 'regeneration')) -
    Number(professionStaticRulesApplied(context.config) && Boolean(context.config?.boons?.regeneration));
  return { expertise: delta * facts.expertise, concentration: delta * facts.concentration };
}

/** The shared lifecycle owns entities; this trait supplies only its selected spawn policy. */
export function bountifulBladesSpawnModifiers(
  context: MesmerRuntime
): Record<number, { countMultiplier: number; damageMultiplier: number }> {
  if (!hasTrait(context, TRAIT.BOUNTIFUL_BLADES)) return {};
  const bountifulBladesProfile = requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_BLADES);
  return {
    [ID.PHANTASMAL_BERSERKER]: {
      countMultiplier: balanceProfileNumber(bountifulBladesProfile, 'summons'),
      damageMultiplier: balanceProfileNumber(bountifulBladesProfile, 'damageMultiplier')
    }
  };
}

/** Add trait-owned bounces before emission so base projectile commitment and targeting still apply. */
export const bountifulBladesMirrorBlade: NonNullable<Skill['effectVariants']>[number] = {
  when: (runtime) => hasTrait(runtime, TRAIT.BOUNTIFUL_BLADES),
  profileId: TRAIT.BOUNTIFUL_BLADES,
  transform: (_runtime, cast, effects) => [
    ...(cast.skill.effects ?? []),
    ...effects
      .filter((effect) => effect.type === 'strike' && effect.name === 'Strike')
      .map((effect) => ({
        ...effect,
        source: 'Player',
        sourceId: TRAIT.BOUNTIFUL_BLADES,
        actorType: 'player' as const,
        name: 'Additional target hits from Bountiful Blades',
        persistsAfterInterrupt: true
      }))
  ]
};

export interface MesmerDuelingCriticalContext {
  readonly state: MesmerRuntime;
  readonly emitEvent: MesmerEmitDerivedEvent;
  readonly boonDuration: (boon: string, baseDuration: number) => number;
  readonly addTraitProc: MesmerAddTraitProc;
}

interface FencersFinesseContext {
  readonly context: MesmerRuntime;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
}

type BlindingDissipationContext = Pick<MesmerMechanics, 'context' | 'addEvent' | 'addTraitProc'>;

// Attach Ineptitude's Confusion to a qualifying blindness application through
// the resolver condition hook, preserving causal attribution.
function applyIneptitudeConfusion(context: MesmerResolverContext, event: MesmerResolverEvent, detail: string): void {
  if (!hasTrait(context, TRAIT.INEPTITUDE)) return;
  const count = Math.max(1, Math.trunc(event.count || 1));
  const ineptitudeProfile = requireBalanceProfileFromContext(context, TRAIT.INEPTITUDE);
  const effect = requireEffect(ineptitudeProfile, 'condition', 'Confusion');
  if (!effect) return;
  context.recordProc(
    'trait',
    'Ineptitude',
    event.at,
    event.skillName,
    count > 1 ? `${detail}, ${count} strikes` : detail
  );
  // Resolve Ineptitude immediately so nested condition hooks observe the
  // confusion application during the originating blind/control reaction, with explicit player attribution.
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      name: `${event.skillName} — Ineptitude`,
      skillName: event.skillName,
      condition: String(effect.condition),
      duration: Number(effect.duration),
      stacks: Number(effect.stacks) * count,
      source: 'Player',
      sourceId: TRAIT.INEPTITUDE,
      actorType: 'player'
    })
  );
}

/** Applies the interrupt half of Ineptitude with its defiant-target interval. */
export function triggerIneptitudeFromInterrupt(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  if (!context.config.target?.activatingSkills || !hasTrait(context, TRAIT.INEPTITUDE)) return;
  const ineptitudeProfile = requireBalanceProfileFromContext(context, TRAIT.INEPTITUDE);
  // A removed Confusion packet owns no interrupt cooldown.
  if (!requireEffect(ineptitudeProfile, 'condition', 'Confusion')) return;
  const defiant = Boolean(context.config.target.defiant);
  // Non-defiant interrupts remain unlimited; defiant targets claim before Confusion can react.
  if (defiant && !context.procs.claim(TRAIT.INEPTITUDE, 'mesmer.core.ineptitude', event.at)) return;

  applyIneptitudeConfusion(context, { ...event, count: defiant ? 1 : event.count }, 'interrupt → blind → confusion');
}

/** Applies the direct-blind half of Ineptitude without an internal cooldown. */
export function triggerIneptitudeFromBlind(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  applyIneptitudeConfusion(context, event, 'blind → confusion');
}

/** Emits Blinding Dissipation after the owning shatter has materialized its Confusion. */
export function triggerBlindingDissipation(
  context: BlindingDissipationContext,
  skillName: string,
  at: number,
  count: number
): void {
  if (!hasTrait(context.context, TRAIT.BLINDING_DISSIPATION)) return;
  context.addEvent({ type: 'blind', at, skillName, count });
  context.addTraitProc('Blinding Dissipation', at, skillName);
}

/** Emits one Fencer's Finesse stack after each eligible resolved sword hit. */
function emitFencersFinesseStacks(
  context: FencersFinesseContext,
  skill: MesmerSkill,
  at: number,
  announce: boolean
): void {
  if (!hasTrait(context.context, TRAIT.FENCERS_FINESSE) || skill.weapon !== 'Sword') {
    return;
  }

  const fencersFinesseProfile = requireBalanceProfileFromContext(context.context, TRAIT.FENCERS_FINESSE);
  // The profile supplies stack lifetime; the attribute modifier owns the cap.
  const duration = balanceProfileNumber(fencersFinesseProfile, 'durationMultiplier');
  emitMesmerTraitBuffs(
    context,
    TRAIT.FENCERS_FINESSE,
    at,
    skill.name,
    [
      {
        // The triggering sword packet resolves before its same-time stack.
        priority: 5,
        kind: 'fencer',
        stacks: 1,
        duration
      }
    ],
    { announce }
  );
}

/** Materializes Master Fencer before later critical-hit trait effects. */
export function triggerMasterFencer(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  if (
    !hasTrait(context.state, TRAIT.MASTER_FENCER) ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient) > 0) ||
    event.canCrit === false
  ) {
    return;
  }

  // One resolved owner supplies both fury effects and the ICD for this proc attempt.
  const masterFencerProfile = requireBalanceProfileFromContext(context.state, TRAIT.MASTER_FENCER);
  const furyEffects = ['Self Fury', 'Allied Fury'].flatMap((name) => {
    const effect = requireEffect(masterFencerProfile, 'boon', name);
    return effect ? [effect] : [];
  });
  if (!furyEffects.length) return;
  const application = advanceCriticalProc(
    criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined),
    {
      id: 'mesmer.core.master-fencer',
      at: event.at
    }
  );
  // Only the canonical critical outcome can claim Master Fencer's cooldown.
  if (!application) return;

  if (
    !context.state.procs.claimCooldown(
      TRAIT.MASTER_FENCER,
      event.at,
      balanceProfileNumber(masterFencerProfile, 'internalCooldown')
    )
  )
    return;
  // Record one canonical proc as the cause of both grants so the log can summarize their resolved durations.
  const proc = context.state.emitDerived(event, {
    type: 'proc',
    procType: 'trait',
    at: event.at,
    name: masterFencerProfile.name,
    sourceSkill: event.skillName,
    source: 'Trait',
    sourceId: TRAIT.MASTER_FENCER,
    actorType: 'effect'
  });
  for (const effect of furyEffects) {
    context.emitEvent(proc, {
      type: 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.MASTER_FENCER,
      actorType: 'player',
      skillId: TRAIT.MASTER_FENCER,
      skillName: 'Master Fencer',
      name: `Master Fencer — ${effect.audience?.recipients ?? 'self'} fury`,
      kind: 'fury',
      duration: context.boonDuration(String(effect.boon), effect.duration),
      stacks: Number(effect.stacks),
      audience: effect.audience
    });
  }
}

/** Materializes Sharper Images for clone and phantasm critical observations. */
export function triggerSharperImages(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  if (!hasTrait(context.state, TRAIT.SHARPER_IMAGES) || !['clone', 'phantasm'].includes(event.summonKind || '')) {
    return;
  }

  const sharperImagesProfile = requireBalanceProfileFromContext(context.state, TRAIT.SHARPER_IMAGES);
  const effect = requireEffect(sharperImagesProfile, 'condition', 'Bleeding');
  if (!effect) return;
  const application = advanceCriticalProc(
    criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined),
    {
      id: 'mesmer.core.sharper-images',
      at: event.at
    }
  );
  if (!application) return;
  const procCount = application.quantity;

  context.emitEvent(event, {
    type: 'condition',
    at: event.at,
    name: `${event.name} — Sharper Images`,
    skillName: event.skillName,
    condition: 'Bleeding',
    duration: Number(effect.duration),
    stacks: procCount * Number(effect.stacks),
    source: 'Player',
    sourceId: TRAIT.SHARPER_IMAGES,
    actorType: 'player'
  });
  context.addTraitProc(
    'Sharper Images',
    event.at,
    event.skillName,
    `${procCount} critical-hit proc${procCount === 1 ? '' : 's'}`
  );
}

/** Read fixed stack tuning with the parent query cache while the applied stacks remain live. */
export function prepareFencersFinesse(context: Gw2ModifierContext) {
  const profile = requireBalanceProfileFromContext(context, TRAIT.FENCERS_FINESSE);
  return {
    duration: balanceProfileNumber(profile, 'durationMultiplier'),
    maximum: balanceProfileNumber(profile, 'maximumStacks'),
    perStack: balanceProfileNumber(profile, 'attributePerStack')
  };
}

/** Applied sword stacks retain their contribution even if the current selection changes. */
export function fencersFinesseFerocity(
  context: Gw2ModifierContext,
  facts: ReturnType<typeof prepareFencersFinesse>
): number {
  return timedStacks(context, 'fencer', facts.duration, facts.maximum) * facts.perStack;
}

/** Resolve the sword reward after the shared critical observation and before later elite reactions. */
export function applyFencersFinesse(runtime: MesmerRuntime, event: SimulationEvent): void {
  const mechanics = mesmerMechanicsFor(runtime);
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if (!skill) return;
  if (event.summonKind !== 'clone')
    emitFencersFinesseStacks(mechanics, skill, event.at, Number(event.hitIndex ?? 1) === 1);
}

/** The dispatcher supplies the duration callback while Master Fencer owns its boon attribution. */
export function masterFencerBoonDuration(context: MesmerRuntime, boon: string, duration: number): number {
  return gw2ResolverBoonDuration(
    context,
    { type: 'buff', at: context.time, source: 'Trait', sourceId: TRAIT.MASTER_FENCER, actorType: 'player' },
    boon,
    duration
  );
}

export function triggerDeceptiveEvasion(runtime: MesmerRuntime): void {
  if (!hasTrait(runtime, TRAIT.DECEPTIVE_EVASION)) return;
  const mechanics = mesmerMechanicsFor(runtime);
  mechanics.resources.queueResources(runtime.time, 1, mechanics.activePrimaryWeapon(), 'Deceptive Evasion', {
    traitId: TRAIT.DECEPTIVE_EVASION,
    traitName: 'Deceptive Evasion'
  });
}

/** Apply the sword multiplier alongside shatter recharge before any flat resource reduction. */
export const fencersFinesseRecharge = compileRechargeRules<MesmerRuntimeState, MesmerSkill>([
  {
    trait: TRAIT.FENCERS_FINESSE,
    when: (_runtime, skill) => skill.weapon === 'Sword',
    multiplier: { profile: TRAIT.FENCERS_FINESSE, field: 'rechargeMultiplier' }
  }
]);

/** Master Fencer must resolve before Sharper Images observes the same critical hit. */
export function triggerMesmerCriticalTraits(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  triggerMasterFencer(context, event, chance);
  triggerSharperImages(context, event, chance);
}

/** Adds The Pledge only to the skill's player Burning, inheriting its timing and excluding summon or trait procs. */
export function triggerThePledge(context: MesmerRuntime, event: SimulationEvent): void {
  if (
    !hasTrait(context, TRAIT.THE_PLEDGE) ||
    event.type !== 'condition' ||
    event.condition !== 'Burning' ||
    !isGw2PlayerActorEvent(event) ||
    event.sourceId !== event.skillId ||
    (event.skillId !== ID.PHANTASMAL_MAGE && event.skillId !== ID.THE_PRESTIGE)
  )
    return;
  const thePledgeProfile = requireBalanceProfileFromContext(context, TRAIT.THE_PLEDGE);
  const effect = requireEffect(thePledgeProfile, 'condition', 'Burning');
  if (!effect) return;
  context.emitDerived(
    event,
    buildResolverCondition({
      actorType: 'player',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.THE_PLEDGE,
      skillId: event.skillId,
      skillName: event.skillName,
      condition: 'Burning',
      duration: Number(effect.duration),
      stacks: Number(effect.stacks)
    })
  );
}

/** Returns Cry of Pain's Confusion override before the owning shatter emits packets. */
export function applyCryOfPain(
  context: MesmerRuntime,
  condition: MesmerConditionApplication | undefined
): MesmerConditionApplication | undefined {
  if (!hasTrait(context, TRAIT.CRY_OF_PAIN)) return condition;
  const cryOfPainProfile = requireBalanceProfileFromContext(context, TRAIT.CRY_OF_PAIN);
  const effect = requireEffect(cryOfPainProfile, 'condition', 'Confusion');
  return effect ? { ...effect, summonKind: undefined, name: effect.condition! } : condition;
}

/** Emits Compounding Power stacks and its proc record at the owning lifecycle position. */
export function triggerCompoundingPower(
  context: Readonly<Pick<MesmerMechanics, 'context' | 'addEvent' | 'addTraitProc'>>,
  at: number,
  count: number,
  sourceSkill: string,
  detail: string
): void {
  if (!hasTrait(context.context, TRAIT.COMPOUNDING_POWER) || count <= 0) return;
  const compoundingPowerProfile = requireBalanceProfileFromContext(context.context, TRAIT.COMPOUNDING_POWER);
  const duration = balanceProfileNumber(compoundingPowerProfile, 'durationMultiplier');
  // Simultaneous gains retain independent applications under one trait activation.
  emitMesmerTraitBuffs(
    context,
    TRAIT.COMPOUNDING_POWER,
    at,
    sourceSkill,
    Array.from({ length: count }, () => ({
      kind: 'compounding',
      stacks: 1,
      duration
    })),
    { detail }
  );
}

/** Applies Maim the Disillusioned to the first-strike groups reported by the shatter resolver. */
export function triggerMaimTheDisillusioned(
  context: Readonly<Pick<MesmerMechanics, 'context' | 'addCondition' | 'addTraitProc'>>,
  resolution: MesmerShatterResolution
): void {
  if (!resolution.traitHits.length || !hasTrait(context.context, TRAIT.MAIM_THE_DISILLUSIONED)) return;
  const maimTheDisillusionedProfile = requireBalanceProfileFromContext(context.context, TRAIT.MAIM_THE_DISILLUSIONED);
  const effect = requireEffect(maimTheDisillusionedProfile, 'condition', 'Torment');
  if (!effect) return;
  const maim = {
    name: String(effect.condition),
    duration: Number(effect.duration),
    stacks: Number(effect.stacks)
  };
  for (const hit of resolution.traitHits) {
    if (hit.count <= 0) continue;
    context.addCondition(
      resolution.skill.name,
      hit.at,
      { ...maim, stacks: maim.stacks * hit.count },
      'Player',
      `${resolution.skill.name} — Maim the Disillusioned`,
      { metadata: { shatterTraitEligible: true } }
    );
  }

  context.addTraitProc('Maim the Disillusioned', resolution.at, resolution.skill.name);
}

/** Returns the profile-owned Phantasmal Haste speed before phantasm packet times are derived. */
export function phantasmalHasteSpeed(context: MesmerRuntime): number {
  return hasTrait(context, TRAIT.PHANTASMAL_HASTE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PHANTASMAL_HASTE), 'quicknessCastMultiplier')
    : 1;
}

/** Shatter and instrument recharge is multiplied before shared flat resource reductions. */
export const masterOfMisdirectionRecharge = compileRechargeRules<MesmerRuntimeState, MesmerSkill>([
  {
    trait: TRAIT.MASTER_OF_MISDIRECTION,
    when: (runtime, skill) =>
      Boolean(mesmerMechanicsFor(runtime).shatters[skill.id] || mesmerMechanicsFor(runtime).instruments[skill.id]),
    multiplier: { profile: TRAIT.MASTER_OF_MISDIRECTION, field: 'rechargeMultiplier' }
  }
]);

/** Only native slot-one shatters and instruments receive Shatter Storm's extra charge. */
export function shatterStormMaximumAmmo(context: MesmerRuntime, skill: MesmerSkill, maximum: number): number {
  const id = skill.id;
  const runtime = mesmerMechanicsFor(context);
  const isSlot1 = runtime.shatters[id]?.slot === 1 || runtime.instruments[id]?.slot === 1;
  return isSlot1 && hasTrait(context, TRAIT.SHATTER_STORM)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SHATTER_STORM), 'maximumStacks')
    : maximum;
}

/** Continuum duration is extended only by the currently selected Core trait. */
export function masterOfFragmentationDuration(context: MesmerRuntime): number {
  return hasTrait(context, TRAIT.MASTER_OF_FRAGMENTATION)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION),
        'durationMultiplier'
      )
    : 0;
}

/** Requiem appends one matching pulse before emission, preserving an empty or removed strike. */
export function masterOfFragmentationRequiem(context: MesmerRuntime, packets: readonly StrikeTick[]): StrikeTick[] {
  const ticks = [...packets];
  if (ticks.length && hasTrait(context, TRAIT.MASTER_OF_FRAGMENTATION)) {
    const last = ticks[ticks.length - 1];
    ticks.push({ ...last, atMs: last.atMs + masterOfFragmentationDuration(context) * 1000 });
  }

  return ticks;
}

/** Crescendo uses the trait's per-instrument coefficient only when selected. */
export function masterOfFragmentationCrescendo(context: MesmerRuntime, profile: BalanceProfile): number {
  return hasTrait(context, TRAIT.MASTER_OF_FRAGMENTATION)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION),
        'damageIncreasePerStack'
      )
    : balanceProfileNumber(profile, 'damageIncreasePerStack');
}
