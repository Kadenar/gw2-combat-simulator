import type {
  BalanceProfile,
  CatalogEntity,
  Skill,
  SkillEffect,
  SkillId,
  TooltipFact
} from '#gw2/platform/engine/skills/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import { MODIFIER_EFFECT_ICONS, tooltipFactIcon } from '#gw2/app/shared/icons.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';

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
  specialization?: string
) => SimulationTooltip;

/** Separate entity namespaces retain identity even when a skill and trait share the same numeric API ID. */
export interface ProfessionTooltips {
  readonly traits: Readonly<Record<string, DescribeSimulationTooltip>>;
  readonly skills?: Readonly<Record<string, DescribeSimulationTooltip>>;
  readonly handlers?: Readonly<Record<string, DescribeSimulationTooltip>>;
  /** Profession resources supplement both ordinary skills and explicitly described handlers. */
  readonly skillFacts?: (context: ProfessionBalanceContext, skill: Skill) => readonly TooltipFact[];
}

const effectNames = new Map(Object.keys(MODIFIER_EFFECT_ICONS).map((name) => [name.toLowerCase(), name]));
// Resolve authored buff IDs to display names so their facts receive the matching effect icons.
effectNames.set('kallas-fervor', "Kalla's Fervor");
effectNames.set('razorclaws-rage', "Razorclaw's Rage");
effectNames.set('battle-scars', 'Battle Scars');
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
  facts: (context: ProfessionBalanceContext, id: SkillId) => readonly TooltipFact[] = () => [],
  effectQualifier = ''
): DescribeSimulationTooltip {
  return (context, entity) => {
    const effects = simulationEffectFacts(context.catalog.balanceProfilesById.get(entity.id)?.effects, effectQualifier);
    return { ...effects, description, facts: [...facts(context, entity.id), ...effects.facts] };
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
  facts: (context: ProfessionBalanceContext, id: SkillId) => readonly TooltipFact[] = () => [],
  qualifier = ''
): DescribeSimulationTooltip {
  return (context) => {
    const effects = simulationEffectFacts(tooltipProfile(context, profileId).effects, qualifier);
    return { ...effects, description, facts: [...facts(context, profileId), ...effects.facts] };
  };
}

/** Skill-specific wording can augment the selected skill's ordinary declarative payload. */
export function skillTooltip(
  description: string,
  facts: (context: ProfessionBalanceContext, skill: Skill) => readonly TooltipFact[] = () => []
): DescribeSimulationTooltip {
  return (context, entity) => {
    const skill = context.catalog.skillsById.get(entity.id);
    if (!skill) throw new Error(`Missing tooltip skill: ${entity.id}`);
    const effects = simulationEffectFacts(skill.effects);
    return { ...effects, description, facts: [...effects.facts, ...facts(context, skill)] };
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
  return { name, detail: format(balanceProfileNumberFromContext(context, id, field)) };
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
function effectContext(effect: SkillEffect): string {
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
  if (effect.name) parts.push(effect.name);
  if (typeof effect.packetLabel === 'string') parts.push(effect.packetLabel);
  return parts.join(' · ');
}

/** Format declarative payloads only; repeated applications retain their individual stack counts and durations. */
export function simulationEffectFacts(effects: readonly SkillEffect[] = [], context = ''): SimulationTooltip {
  const facts = new Map<string, TooltipFact>();
  let incomplete = false;
  const add = (effect: SkillEffect, name: string, detail: string, stacks?: number) => {
    name = tooltipEffectName(name);
    const qualifier = [context, effectContext(effect)].filter(Boolean).join(' · ');
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
        effect.noCrit || effect.canCrit === false
          ? 'cannot critically strike'
          : effect.forceCrit
            ? 'always critically strikes'
            : ''
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
    } else if (effect.type === 'blind') {
      add(
        effect,
        'Blinded',
        effect.duration == null ? 'Applies blindness; duration is not modeled' : `${tooltipDecimal(effect.duration)}s`
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

/** Ordinary descriptions summarize declared effects; custom handlers retain their locally authored explanations. */
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
  if (effects.some((effect) => effect.type === 'blind')) sentences.push('Blind your target.');
  if (effects.some((effect) => effect.type === 'control'))
    sentences.push('Apply control to your target, triggering eligible control effects.');
  if (effects.some((effect) => effect.type === 'custom' && effect.eventType === 'resource'))
    sentences.push('Gain the listed resources.');
  return sentences.join(' ') || 'This action has no direct damage or status effects described by the simulator.';
}

/** Generic skills describe only modeled payloads; profession functions supply conditional and handler-specific prose. */
export function describeSimulationSkill(
  context: ProfessionBalanceContext,
  skill: Skill,
  presentation: ProfessionTooltips
): SimulationTooltip {
  const describe =
    presentation.skills?.[skill.id] || (skill.handlerId ? presentation.handlers?.[skill.handlerId] : undefined);
  // Custom descriptions own their packets; only format generic effects when no override handles the skill.
  let model: SimulationTooltip;
  if (describe) model = describe(context, skill);
  else {
    const effects = simulationEffectFacts(skill.effects);
    model = {
      ...effects,
      description: ordinarySkillDescription(skill),
      incomplete: effects.incomplete || Boolean(skill.handlerId || skill.mechanicTriggers?.length)
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
  for (const finisher of new Map(comboFinishers.map((finisher) => [JSON.stringify(finisher), finisher])).values()) {
    facts.push({
      name: 'Combo finisher',
      detail: `${String(finisher.finisherType)}${typeof finisher.chance === 'number' ? ` · ${tooltipDecimal(finisher.chance * 100)}% chance` : ''}`
    });
  }

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
