import type { BalanceProfile, CatalogEntity, Skill, SkillId, TooltipFact } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import { MODIFIER_EFFECT_ICONS, tooltipFactIcon } from '#gw2/app/shared/icons.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';

export interface SimulationTooltip {
  readonly description: string;
  readonly facts: readonly TooltipFact[];
  /** Alternative payloads use tabs while shared costs remain visible above them. */
  readonly factTabs?: readonly { readonly label: string; readonly facts: readonly TooltipFact[] }[];
  readonly incomplete?: boolean;
}

export type DescribeSimulationTooltip = (
  context: ProfessionBalanceContext,
  entity: CatalogEntity,
  specialization?: string,
  build?: Pick<Gw2CanonicalBuild, 'specializations'>
) => SimulationTooltip;

/** Separate entity namespaces retain identity even when a skill and trait share the same numeric API ID. */
export interface ProfessionTooltips {
  readonly traits: Readonly<Record<string, DescribeSimulationTooltip>>;
  readonly skills?: Readonly<Record<string, DescribeSimulationTooltip>>;
  /** Profession resources supplement both ordinary skills and explicitly described skills. */
  readonly skillFacts?: (context: ProfessionBalanceContext, skill: Skill) => readonly TooltipFact[];
}

/** Tuples read the described profile; named sources keep cross-profile and modifier facts explicit. */
export type FactSpec =
  | readonly [field: string, name: string, format?: (value: number) => string]
  | {
      readonly profile: SkillId;
      readonly field: string;
      readonly name: string;
      readonly format?: (value: number) => string;
    }
  | {
      readonly modifier: string;
      readonly field: string;
      readonly name: string;
      readonly format?: (value: number) => string;
    };

/** Computed payloads still need callbacks; scalar declarations can use facts directly. */
type TooltipFacts<T> = readonly FactSpec[] | ((context: ProfessionBalanceContext, entity: T) => readonly TooltipFact[]);

/** Select another profile without repeating balance-context plumbing in every authored row. */
export const fromProfile = (
  profile: SkillId,
  field: string,
  name: string,
  format?: (value: number) => string
): FactSpec => ({ profile, field, name, format });

/** Modifier facts retain their percentage default and may read named rule parameters. */
export const fromModifier = (
  modifier: string,
  field: string,
  name: string,
  format?: (value: number) => string
): FactSpec => ({ modifier, field, name, format });

/** Resolve at render time so selected patches, numeric validation, and source-specific defaults stay authoritative. */
function resolveFacts(
  context: ProfessionBalanceContext,
  id: SkillId,
  facts: readonly FactSpec[]
): readonly TooltipFact[] {
  return facts.map((fact) => {
    if ('profile' in fact) return profileFact(context, fact.profile, fact.field, fact.name, fact.format);
    if ('modifier' in fact) return modifierFact(context, fact.modifier, fact.field, fact.name, fact.format);
    return profileFact(context, id, ...fact);
  });
}

const effectNames = new Map(Object.keys(MODIFIER_EFFECT_ICONS).map((name) => [name.toLowerCase(), name]));
// Resolve authored buff IDs to display names so their facts receive the matching effect icons.
effectNames.set('kallas-fervor', "Kalla's Fervor");
// Resolve Vindicator's internal buff names to the named CDN icons used in trait tooltips.
effectNames.set('forerunner-of-death', 'Forerunner of Death');
effectNames.set('reavers-curse', "Reaver's Curse");
effectNames.set('razorclaws-rage', "Razorclaw's Rage");
effectNames.set('battle-scars', 'Battle Scars');
effectNames.set('peak-performance', 'Peak Performance');
effectNames.set('berserkers-power', "Berserker's Power");
// Cartridge buff IDs resolve to their skill-icon entries for both charge tiers.
effectNames.set('overcharged-cartridges', 'Overcharged Cartridges');
effectNames.set('supercharged-cartridges', 'Supercharged Cartridges');
effectNames.set('fresh-air', 'Fresh Air');
// Match named buff IDs to their display names so generated facts keep the granting skill or trait icon.
effectNames.set('fierce-as-fire', 'Fierce as Fire');
effectNames.set('signet-mastery', 'Signet Mastery');
effectNames.set('ashes-of-the-just', 'Ashes of the Just');
effectNames.set('lethal-tempo', 'Lethal Tempo');
effectNames.set('enchanted-daggers', 'Enchanted Daggers');
// Resolve weapon-spell charge kinds to their named skill icons.
effectNames.set('nightmare-weapon', 'Nightmare Weapon');
effectNames.set('splinter-weapon', 'Splinter Weapon');
effectNames.set('burst-of-strength', 'Burst of Strength');
effectNames.set('explosive-temper', 'Explosive Temper');
effectNames.set('twice-as-vicious', 'Twice as Vicious');
effectNames.set('relentless-fire', 'Relentless Fire');
effectNames.set('shattering-ice', 'Shattering Ice');
// All ordinary descriptions use the same locale, so reuse its formatter across skills.
const effectListFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** Numeric source errors stay visible instead of silently replacing a missing bonus with zero or an API fact. */
export function tooltipNumber(source: object | undefined, field: string): number {
  const value = (source as Readonly<Record<string, unknown>> | undefined)?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid tooltip number: ${field}`);
  return value;
}

// Keep small nonzero coefficients visible without displaying floating-point arithmetic noise.
export const tooltipDecimal = (value: number): string => String(Number(value.toPrecision(8)));
export const tooltipPercent = (value: number): string => `${value > 0 ? '+' : ''}${tooltipDecimal(value * 100)}%`;

// Keep duration units and signed multiplier changes consistent across professions.
export const tooltipSeconds = (value: number): string => `${tooltipDecimal(value)}s`;
export const tooltipFactorChange = (factor: number): string => tooltipPercent(factor - 1);

/** Required IDs are checked at the presentation boundary without executing any combat callbacks. */
export function tooltipProfile(context: ProfessionBalanceContext, id: SkillId): BalanceProfile {
  const profile = context.catalog.balanceProfilesById.get(id);
  if (!profile) throw new Error(`Missing tooltip profile: ${id}`);
  return profile;
}

export function tooltipRule(context: ProfessionBalanceContext, id: string) {
  const rule = context.modifierRulesById.get(id);
  if (!rule) throw new Error(`Missing tooltip modifier: ${id}`);
  return rule;
}

/** Reuse trait payload formatting while keeping each trait's explanation and scalar labels locally authored. */
export function traitTooltip(
  description: string,
  facts: TooltipFacts<SkillId> = [],
  effectQualifier = ''
): DescribeSimulationTooltip {
  return (context, entity) => {
    const effects = simulationEffectFacts(context.catalog.balanceProfilesById.get(entity.id)?.effects, effectQualifier);
    const custom = typeof facts === 'function' ? facts(context, entity.id) : resolveFacts(context, entity.id, facts);
    return { ...effects, description, facts: [...custom, ...effects.facts] };
  };
}

/** Explain unsupported traits and direct users to request support through an issue. */
export const outsideScopeTooltip = traitTooltip(
  "This trait is either outside the simulator's scope or has not been implemented yet. To request support for it, submit an issue."
);

/** A trait or skill can explicitly reference a mechanic profile when its payload has a separate catalog identity. */
export function profileTooltip(
  profileId: SkillId,
  description: string,
  facts: TooltipFacts<SkillId> = [],
  qualifier = ''
): DescribeSimulationTooltip {
  return (context) => {
    const effects = simulationEffectFacts(tooltipProfile(context, profileId).effects, qualifier);
    const custom = typeof facts === 'function' ? facts(context, profileId) : resolveFacts(context, profileId, facts);
    return { ...effects, description, facts: [...custom, ...effects.facts] };
  };
}

/** Skill-specific wording can augment the selected skill's ordinary declarative payload. */
export function skillTooltip(description: string, facts: TooltipFacts<Skill> = []): DescribeSimulationTooltip {
  return (context, entity) => {
    const skill = context.catalog.skillsById.get(entity.id);
    if (!skill) throw new Error(`Missing tooltip skill: ${entity.id}`);
    const effects = simulationEffectFacts(skill.effects);
    const custom = typeof facts === 'function' ? facts(context, skill) : resolveFacts(context, skill.id, facts);
    return { ...effects, description, facts: [...effects.facts, ...custom] };
  };
}

/** Formats an explicitly named profile input; the caller supplies its domain meaning and units. */
export function profileFact(
  context: ProfessionBalanceContext,
  id: SkillId,
  field: string,
  name: string,
  format: (value: number) => string = tooltipDecimal
): TooltipFact {
  const idProfile = requireBalanceProfileFromContext(context, id);
  return { name, detail: format(balanceProfileNumber(idProfile, field)) };
}

/** Scalar rules and their named parameters remain the sole owners of patchable modifier inputs. */
export function modifierFact(
  context: ProfessionBalanceContext,
  id: string,
  field: string,
  name: string,
  format: (value: number) => string = tooltipPercent
): TooltipFact {
  const rule = tooltipRule(context, id);
  const value =
    field === 'amount' || field === 'factor' ? tooltipNumber(rule, field) : tooltipNumber(rule.parameters, field);
  return { name, detail: format(value) };
}

/** Display names are cosmetic; matching and source selection always use the authored entity IDs. */
export function tooltipEffectName(value: string): string {
  return (
    effectNames.get(value.toLowerCase()) || value.replaceAll('-', ' ').replace(/^\w/, (letter) => letter.toUpperCase())
  );
}

/** Preserve recipient and actor differences when grouping repeated payloads into readable facts. */
function effectContext(effect: SkillEffect, factName: string): string {
  const audience = effect.audience;
  const parts: string[] = [];
  if (effect.type === 'condition' && effect.target === 'self') parts.push('on yourself');
  if (audience?.recipients === 'party') {
    parts.push(audience.maximumRecipients == null ? 'party' : `up to ${audience.maximumRecipients} party members`);
    if (audience.affectsSelf === false) parts.push('excluding yourself');
  } else if (audience?.recipients === 'summons')
    parts.push(
      audience.affectsSelf === false || effect.actorType === 'summon' ? 'your companions' : 'you and your companions'
    );
  else if (audience?.recipients === 'self')
    parts.push(effect.actorType === 'summon' ? 'on the companion' : 'on yourself');
  if (effect.actorType === 'summon') parts.push('companion effect');
  // Packet names distinguish variants, but repeating the displayed effect name adds no information.
  if (effect.name && tooltipEffectName(effect.name).toLowerCase() !== factName.toLowerCase()) parts.push(effect.name);
  if (typeof effect.packetLabel === 'string') parts.push(effect.packetLabel);
  return parts.join(' · ');
}

/** Format declarative payloads only; repeated applications retain their individual stack counts and durations. */
export function simulationEffectFacts(effects: readonly SkillEffect[] = [], context = ''): SimulationTooltip {
  const facts = new Map<string, TooltipFact>();
  let incomplete = false;
  const add = (effect: SkillEffect, name: string, detail: string, stacks?: number) => {
    name = tooltipEffectName(name);
    const qualifier = [context, effectContext(effect, name)].filter(Boolean).join(' · ');
    const fullDetail = [detail, qualifier].filter(Boolean).join(' — ');
    const key = JSON.stringify([name, fullDetail, stacks, effect.sourceId, effect.actorType, effect.audience]);
    const applications = effect.applications ?? 1;
    const previous = facts.get(key);
    facts.set(key, {
      name,
      detail: fullDetail,
      icon: MODIFIER_EFFECT_ICONS[name] || effect.icon,
      stacks,
      applications: (previous?.applications ?? 0) + applications
    });
  };

  // Flat-damage timelines retain each tick's formula and inherited defaults; identical packets share an application count.
  for (const effect of effects.flatMap<SkillEffect>((effect) =>
    effect.type === 'strike' &&
    effect.ticks &&
    [effect, ...effect.ticks].some(
      (packet) => packet.flatDamage != null || packet.flatStrikeBase != null || packet.flatStrikePowerCoeff != null
    )
      ? effect.ticks.map((tick) => ({ ...effect, ...tick, ticks: undefined, hits: 1 }))
      : [effect]
  )) {
    if (effect.type === 'strike') {
      const coefficient =
        effect.ticks?.reduce((sum, tick) => sum + tooltipNumber(tick, 'coefficient'), 0) ?? effect.coefficient;
      const hits = effect.ticks?.length ?? effect.hits ?? 1;
      const detail = [
        coefficient != null &&
        (coefficient !== 0 ||
          (effect.flatDamage == null && effect.flatStrikeBase == null && effect.flatStrikePowerCoeff == null))
          ? `${tooltipDecimal(coefficient)} coefficient${hits > 1 ? ' total' : ''}`
          : '',
        effect.flatDamage != null ? `${tooltipDecimal(effect.flatDamage)} flat damage` : '',
        effect.flatStrikeBase != null ? `${tooltipDecimal(effect.flatStrikeBase)} base damage` : '',
        effect.flatStrikePowerCoeff != null ? `${tooltipDecimal(effect.flatStrikePowerCoeff)} × power` : '',
        effect.flatStrikeMultiplier != null ? `${tooltipDecimal(effect.flatStrikeMultiplier)}× flat damage` : '',
        hits > 1 ? `${hits} hits` : '',
        effect.canCrit === false ? 'cannot critically strike' : effect.forceCrit ? 'always critically strikes' : ''
      ]
        .filter(Boolean)
        .join(' · ');
      if (detail) add(effect, 'Strike damage', detail);
      else incomplete = true;
      for (const modifier of effect.coefficientModifiers || []) {
        if (modifier.kind !== 'target-health-below') {
          incomplete = true;
          continue;
        }

        add(
          effect,
          'Strike damage',
          `${tooltipDecimal(modifier.multiplier)}× below ${tooltipDecimal(modifier.threshold * 100)}% target health; lowest matching threshold applies`
        );
      }
    } else if (effect.type === 'condition') {
      for (const condition of effect.ticks || [effect]) {
        if (!condition.condition) {
          incomplete = true;
          continue;
        }

        const stacks = condition.stacks ?? 1;
        const duration = condition.duration;
        add(effect, condition.condition, duration == null ? '' : `${tooltipDecimal(duration)}s`, stacks);
        if (duration == null) incomplete = true;
      }
    } else if (effect.type === 'boon' || effect.type === 'buff') {
      const name = effect.boon || effect.kind || effect.name;
      if (!name) {
        incomplete = true;
        continue;
      }

      const stacks = effect.stacks ?? 1;
      // Only intensity-stacking boons need stack counts; other boons show their duration and recipients.
      const showStacks = !isStandardBoon(name) || ['might', 'stability'].includes(name.toLowerCase());
      // Attribute buffs store their point bonus in stacks; presenting those points as stack counts is misleading.
      const attribute =
        effect.type === 'buff' &&
        [
          'power',
          'precision',
          'toughness',
          'vitality',
          'ferocity',
          'conditionDamage',
          'healingPower',
          'concentration',
          'expertise'
        ].includes(name);
      add(
        effect,
        name,
        [
          attribute ? `${stacks > 0 ? '+' : ''}${stacks} points` : '',
          showStacks && effect.allyStacks != null && effect.allyStacks !== stacks
            ? `${stacks} on yourself · ${effect.allyStacks} on each ally`
            : '',
          `${tooltipDecimal(tooltipNumber(effect, 'duration'))}s`
        ]
          .filter(Boolean)
          .join(' · '),
        showStacks && !attribute ? stacks : undefined
      );
    } else if (effect.type === 'control') {
      // Name the disable directly while retaining its application count and context.
      add(effect, effect.controlKind || 'Control', '');
    } else if (effect.type === 'custom' && effect.eventType === 'resource') {
      add(
        effect,
        tooltipEffectName(String(effect.event.resource)),
        `${tooltipDecimal(tooltipNumber(effect.event, 'amount'))} gained`
      );
    } else if (effect.type === 'custom' && effect.eventType === 'proc' && effect.event.procType === 'boon-extension') {
      add(effect, 'Boon extension', `${tooltipDecimal(tooltipNumber(effect.event, 'duration'))}s`);
    } else incomplete = true;
  }

  return { description: '', facts: [...facts.values()], incomplete };
}

/** Ordinary descriptions summarize declared effects; skill overrides retain their locally authored explanations. */
function ordinarySkillDescription(skill: Skill): string {
  if (skill.initialStateOnly)
    return 'Restore this combat state for the duration recorded at the start of the imported encounter.';
  const effects = skill.effects || [];
  const sentences: string[] = [];
  const strikes = effects.filter((effect) => effect.type === 'strike');
  if (strikes.length) {
    const hits = strikes.reduce(
      (sum, effect) => sum + (effect.ticks?.length ?? effect.hits ?? 1) * (effect.applications ?? 1),
      0
    );
    const subject = strikes.every((effect) => effect.actorType === 'summon') ? 'Your companion strikes' : 'Strike';
    sentences.push(`${subject} your target${hits > 1 ? ' repeatedly' : ''}.`);
  }

  for (const self of [false, true]) {
    const names = [
      ...new Set(
        effects
          .filter((effect) => effect.type === 'condition' && (effect.target === 'self') === self)
          .flatMap((effect) =>
            effect.type === 'condition'
              ? (effect.ticks || [effect]).flatMap((condition) =>
                  condition.condition ? [tooltipEffectName(condition.condition)] : []
                )
              : []
          )
      )
    ];
    if (names.length) sentences.push(`${self ? 'Apply to yourself' : 'Inflict'} ${effectListFormat.format(names)}.`);
  }

  if (effects.some((effect) => effect.type === 'boon'))
    sentences.push('Grant the listed boons to their indicated recipients.');
  if (effects.some((effect) => effect.type === 'buff')) sentences.push('Apply the listed combat effects.');
  if (effects.some((effect) => effect.type === 'control'))
    sentences.push('Apply control to your target, triggering eligible control effects.');
  if (effects.some((effect) => effect.type === 'custom' && effect.eventType === 'resource'))
    sentences.push('Gain the listed resources.');
  return sentences.join(' ') || 'This action has no direct damage or status effects described by the simulator.';
}

/** Generic skills describe only modeled payloads; profession functions supply conditional and skill-specific prose. */
export function describeSimulationSkill(
  context: ProfessionBalanceContext,
  skill: Skill,
  presentation: ProfessionTooltips,
  build?: Pick<Gw2CanonicalBuild, 'specializations'>
): SimulationTooltip {
  const describe = presentation.skills?.[skill.id];
  // Custom descriptions own their packets; only format generic effects when no override handles the skill.
  let model: SimulationTooltip;
  if (describe) model = describe(context, skill, undefined, build);
  else {
    const effects = simulationEffectFacts(skill.effects);
    model = {
      ...effects,
      description: ordinarySkillDescription(skill),
      incomplete: effects.incomplete
    };
  }

  const facts: TooltipFact[] = [];
  const recharge = gw2BaseRecharge(skill);
  if (recharge > 0)
    facts.push({
      name: Number(skill.ammo) > 0 ? 'Base ammunition recharge' : 'Base recharge',
      detail: `${tooltipDecimal(recharge)}s`
    });
  if (Number(skill.ammo) > 0) facts.push({ name: 'Ammunition', detail: tooltipDecimal(tooltipNumber(skill, 'ammo')) });
  const comboFields = [
    ...(skill.comboFields || []),
    ...(skill.effects || []).flatMap((effect) => effect.comboFields || [])
  ];
  for (const field of new Map(comboFields.map((field) => [JSON.stringify(field), field])).values()) {
    facts.push({
      name: 'Combo field',
      detail: `${String(field.fieldType)}${typeof field.duration === 'number' ? ` · ${tooltipDecimal(field.duration)}s` : ''}`
    });
  }

  const comboFinishers = [
    ...(skill.comboFinishers || []),
    ...(skill.effects || []).flatMap((effect) => [
      ...(effect.comboFinishers || []),
      // Explicit strike packets can own finishers independently of their enclosing effect.
      ...(effect.type === 'strike' || effect.type === 'condition'
        ? (effect.ticks || []).flatMap((tick) => tick.comboFinishers || [])
        : [])
    ])
  ];
  // Group identical displayed finishers so per-tick attempt IDs do not produce repeated tooltip rows.
  const finisherFacts = new Map<string, TooltipFact>();
  for (const finisher of comboFinishers) {
    // Only projectile finishers expose a chance; other finisher types are guaranteed by their type.
    const detail = `${String(finisher.finisherType)}${finisher.finisherType === 'Projectile' && typeof finisher.chance === 'number' ? ` · ${tooltipDecimal(finisher.chance * 100)}% chance` : ''}`;
    finisherFacts.set(detail, {
      name: 'Combo finisher',
      detail,
      applications: (finisherFacts.get(detail)?.applications ?? 0) + Number(finisher.attempts ?? 1)
    });
  }

  facts.push(...finisherFacts.values());

  return {
    ...model,
    facts: [...facts, ...model.facts, ...(presentation.skillFacts?.(context, skill) || [])].map((fact) => ({
      ...fact,
      icon: fact.icon || tooltipFactIcon(fact.name)
    }))
  };
}

/** Every trait must have a reviewed local declaration, including traits deliberately outside simulation scope. */
export function describeSimulationTrait(
  context: ProfessionBalanceContext,
  trait: CatalogEntity,
  presentation: ProfessionTooltips,
  specialization = 'Core'
): SimulationTooltip {
  const describe = presentation.traits[trait.id];
  if (!describe) throw new Error(`Missing trait tooltip: ${trait.id} (${trait.name})`);
  const model = describe(context, trait, specialization);
  return { ...model, facts: model.facts.map((fact) => ({ ...fact, icon: fact.icon || tooltipFactIcon(fact.name) })) };
}
