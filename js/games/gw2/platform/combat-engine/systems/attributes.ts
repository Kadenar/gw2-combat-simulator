/**
 * Relative attribute calculation.
 *
 * Ports `system/attributes.cpp`. Each root actor gets a map of its attributes
 * as seen against every other root actor, so target-dependent modifiers (for
 * example "while the target has Burning") resolve per pair. The order is
 * fixed: static values, then modifiers (`value * multiplier + addend`, capped
 * per effect by considered stacks), then conversions summed from pre-conversion
 * values and banker's-rounded, then precision/ferocity/expertise derivations.
 * The result persists across ticks until an attribute input changes.
 */
import { roundHalfEven, roundHalfEvenDigits } from '#gw2/platform/combat-engine/numeric.js';
import { maxConsideredStacks } from '#gw2/platform/combat-engine/effect-rules.js';
import { independentConditionsSatisfied } from '#gw2/platform/combat-engine/queries.js';
import { ALL_ATTRIBUTE_PAIRS, ownerOf, view } from '#gw2/platform/combat-engine/registry.js';
import type { Attribute, Condition } from '#gw2/platform/combat-engine/configuration.js';
import type { Entity, Pool, Registry } from '#gw2/platform/combat-engine/registry.js';

const CONDITION_DURATION_ATTRIBUTES: readonly Attribute[] = [
  'condition_duration_multiplier',
  'bleeding_duration_multiplier',
  'burning_duration_multiplier',
  'confusion_duration_multiplier',
  'poison_duration_multiplier',
  'torment_duration_multiplier'
];

/** Reads one relative attribute, failing like `std::map::at` when the pair was never computed. */
export function relativeAttribute(registry: Registry, actor: Entity, other: Entity, attribute: Attribute): number {
  const value = registry.relativeAttributes.get(actor).get(other)?.get(attribute);
  if (value === undefined) throw new Error(`Missing relative attribute ${attribute} for ${actor} against ${other}.`);
  return value;
}

/**
 * Counts how many holders of the same effect or unique effect have already
 * contributed for an owner, so stacks beyond the considered cap
 * add nothing.
 */
function stackCapAllows(
  registry: Registry,
  occurrences: Map<string, number>,
  holderOwner: Entity,
  ownerActor: Entity
): boolean {
  const uniqueEffect = registry.isUniqueEffect.tryGet(holderOwner);
  if (uniqueEffect) {
    const key = `u\0${uniqueEffect.uniqueEffectKey}\0${ownerActor}`;
    const count = occurrences.get(key) ?? 0;
    if (count >= uniqueEffect.maxConsideredStacks) return false;
    occurrences.set(key, count + 1);
  }

  const effect = registry.isEffect.tryGet(holderOwner);
  if (effect) {
    const key = `e\0${effect.effect}\0${ownerActor}`;
    const count = occurrences.get(key) ?? 0;
    if (count >= maxConsideredStacks(effect.effect)) return false;
    occurrences.set(key, count + 1);
  }

  return true;
}

const holderIndexes = new WeakMap<
  Pool<unknown>,
  {
    revision: number;
    ownershipRevision: number;
    effectRevision: number;
    uniqueEffectRevision: number;
    holders: { holder: Entity; ownerActor: Entity }[];
  }
>();

/** Cache target-independent stack admission and owners; live predicate inputs do not change this metadata. */
function attributeHolders<T>(registry: Registry, pool: Pool<readonly T[]>) {
  const cached = holderIndexes.get(pool);
  // ponytail: any ownership/effect edit invalidates this list; narrow invalidation if rebuilds remain a bottleneck.
  if (
    cached?.revision === pool.revision &&
    cached.ownershipRevision === registry.owner.revision &&
    cached.effectRevision === registry.isEffect.revision &&
    cached.uniqueEffectRevision === registry.isUniqueEffect.revision
  )
    return cached.holders;

  const occurrences = new Map<string, number>();
  const holders: { holder: Entity; ownerActor: Entity }[] = [];
  view([registry.owner, pool]).forEach((holder) => {
    const holderOwner = registry.owner.get(holder);
    const ownerActor = ownerOf(registry, holderOwner);
    // Empty holders still consume a considered-stack slot in the original pool order.
    if (stackCapAllows(registry, occurrences, holderOwner, ownerActor) && pool.get(holder).length > 0) {
      holders.push({ holder, ownerActor });
    }
  });
  holderIndexes.set(pool, {
    revision: pool.revision,
    ownershipRevision: registry.owner.revision,
    effectRevision: registry.isEffect.revision,
    uniqueEffectRevision: registry.isUniqueEffect.revision,
    holders
  });
  return holders;
}

/** Track mutable predicate inputs, including nested predicates and cooldown-dependent skill-group selection. */
function collectDependencies(registry: Registry, condition: Condition): void {
  const dependencies = registry.attributeDependencies;
  if (condition.dependsOnSkillOffCooldown !== undefined) dependencies.add('cooldown');
  const threshold = condition.threshold;
  if (threshold?.healthPctSubjectToThreshold || threshold?.targetHealthPctSubjectToThreshold)
    dependencies.add('health');
  if (threshold?.counterValueSubjectToThreshold !== undefined) dependencies.add('counter');
  if (threshold?.generateRandomNumberSubjectToThreshold) dependencies.add('random');
  for (const nested of condition.not) collectDependencies(registry, nested);
  for (const nested of condition.or) collectDependencies(registry, nested);
  for (const nested of condition.and) collectDependencies(registry, nested);
}

const dependencyIndexes = new WeakMap<
  Registry,
  {
    modifierRevision: number;
    conversionRevision: number;
    groupRevision: number;
  }
>();

/** Predicate definitions are immutable; rescan dependencies only when their component pools change. */
function refreshDependencies(registry: Registry): void {
  const cached = dependencyIndexes.get(registry);
  if (
    cached?.modifierRevision === registry.isAttributeModifier.revision &&
    cached.conversionRevision === registry.isAttributeConversion.revision &&
    cached.groupRevision === registry.isConditionalSkillGroup.revision
  )
    return;

  registry.attributeDependencies.clear();
  for (const pool of [registry.isAttributeModifier, registry.isAttributeConversion]) {
    pool.forEach((_, entries) => {
      for (const entry of entries) collectDependencies(registry, entry.condition);
    });
  }

  if (registry.attributeDependencies.has('cooldown')) {
    registry.isConditionalSkillGroup.forEach((_, group) => {
      for (const member of group.conditionalSkillKeys) collectDependencies(registry, member.condition);
    });
  }

  dependencyIndexes.set(registry, {
    modifierRevision: registry.isAttributeModifier.revision,
    conversionRevision: registry.isAttributeConversion.revision,
    groupRevision: registry.isConditionalSkillGroup.revision
  });
}

export function calculateRelativeAttributes(registry: Registry): void {
  if (registry.relativeAttributes.size > 0 && registry.recalculateAttributes.size === 0) return;

  // Random predicates keep their original draw order by rebuilding every pair whenever attributes are dirty.
  const allPairs =
    registry.relativeAttributes.size === 0 ||
    registry.recalculateAttributes.has(ALL_ATTRIBUTE_PAIRS) ||
    registry.attributeDependencies.has('random');
  const dirtyPair = (actor: Entity, other: Entity) =>
    allPairs || registry.recalculateAttributes.has(actor) || registry.recalculateAttributes.has(other);
  refreshDependencies(registry);

  // Reuse pair maps, but repack roots in reference order and discard pairs whose actors disappeared.
  const roots = [...view([registry.isActor, registry.staticAttributes], [registry.owner]).entities()];
  const previous = new Map(registry.relativeAttributes.entries());
  registry.relativeAttributes.clear();
  for (const entity of roots) {
    const staticAttributes = registry.staticAttributes.get(entity);
    const relative = registry.relativeAttributes.emplace(entity, previous.get(entity) ?? new Map());
    for (const other of relative.keys()) {
      if (!roots.includes(other)) relative.delete(other);
    }

    for (const other of roots) {
      if (!dirtyPair(entity, other)) continue;
      const values = relative.get(other) ?? new Map<Attribute, number>();
      values.clear();
      for (const [attribute, value] of staticAttributes) values.set(attribute, value);
      relative.set(other, values);
    }
  }

  for (const { holder, ownerActor } of attributeHolders(registry, registry.isAttributeModifier)) {
    const modifiers = registry.isAttributeModifier.get(holder);
    const relative = registry.relativeAttributes.get(ownerActor);
    registry.relativeAttributes.forEach((other) => {
      if (!dirtyPair(ownerActor, other)) return;
      const values = relative.get(other);
      if (!values) throw new Error(`Missing relative attributes for ${ownerActor} against ${other}.`);
      for (const modifier of modifiers) {
        if (!independentConditionsSatisfied(registry, modifier.condition, ownerActor, other).satisfied) continue;
        const current = values.get(modifier.attribute);
        if (current === undefined) throw new Error(`Missing attribute ${modifier.attribute}.`);
        values.set(modifier.attribute, current * modifier.multiplier + modifier.addend);
      }
    });
  }

  const conversionHolders = attributeHolders(registry, registry.isAttributeConversion);
  registry.relativeAttributes.forEach((other) => {
    // Bonuses read post-modifier, pre-conversion values and apply together, so conversions never chain.
    const bonuses = new Map<Entity, Map<Attribute, number>>();
    for (const { holder, ownerActor } of conversionHolders) {
      const conversions = registry.isAttributeConversion.get(holder);
      const relative = registry.relativeAttributes.get(ownerActor);
      if (!dirtyPair(ownerActor, other)) continue;
      for (const conversion of conversions) {
        if (!independentConditionsSatisfied(registry, conversion.condition, ownerActor, other).satisfied) continue;
        const from = relative.get(other)?.get(conversion.from);
        if (from === undefined) throw new Error(`Missing attribute ${conversion.from}.`);
        const ownerBonuses = bonuses.get(ownerActor) ?? new Map<Attribute, number>();
        ownerBonuses.set(
          conversion.to,
          (ownerBonuses.get(conversion.to) ?? 0) + (from * conversion.multiplier + conversion.addend)
        );
        bonuses.set(ownerActor, ownerBonuses);
      }
    }

    for (const ownerActor of [...bonuses.keys()].sort((left, right) => left - right)) {
      const values = registry.relativeAttributes.get(ownerActor).get(other);
      if (!values) throw new Error(`Missing relative attributes for ${ownerActor} against ${other}.`);
      for (const [attribute, bonus] of bonuses.get(ownerActor) ?? []) {
        values.set(attribute, roundHalfEven((values.get(attribute) ?? 0) + bonus));
      }
    }
  });

  registry.relativeAttributes.forEach((actor, relative) => {
    registry.relativeAttributes.forEach((other) => {
      if (!dirtyPair(actor, other)) return;
      const values = relative.get(other);
      if (!values) throw new Error(`Missing relative attributes against ${other}.`);
      const read = (attribute: Attribute) => values.get(attribute) ?? 0;
      values.set('critical_chance_multiplier', read('critical_chance_multiplier') + (read('precision') - 895) / 2100);
      values.set('critical_damage_multiplier', read('critical_damage_multiplier') + read('ferocity') / 1500);
      const expertiseBonus = roundHalfEvenDigits(read('expertise') / 1500, 2);
      for (const attribute of CONDITION_DURATION_ATTRIBUTES) values.set(attribute, read(attribute) + expertiseBonus);
    });
  });
  registry.recalculateAttributes.clear();
}
