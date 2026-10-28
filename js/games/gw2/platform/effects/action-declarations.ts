import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import { isCustomSideEffectAction, type SideEffectAction } from '#gw2/platform/effects/actions.js';
import type { EffectReaction } from '#gw2/platform/effects/reactions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';

const authoredReactions = new WeakSet<readonly EffectReaction[]>();
const declarationSnapshots = new WeakSet();
const immutableSnapshots = new WeakSet();

/** Detach declarations using the caller's effect normalizer, keeping snapshot ownership independent of validation. */
export function snapshotActionDeclaration<T>(
  value: T,
  normalizeEffects: (effects: readonly SkillEffect[], label: string) => readonly SkillEffect[]
): T {
  if (!value || typeof value !== 'object') return value;

  // Rebuilt catalogs can retain already detached immutable declarations without copying them again.
  if (immutableSnapshots.has(value)) return value;

  const prototype = Object.getPrototypeOf(value);

  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;

  const snapshot = Array.isArray(value)
    ? value.map((entry) => snapshotActionDeclaration(entry, normalizeEffects))
    : Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          // Inline action payloads are canonical effects, not a second execution path.
          key === 'effects' && isCustomSideEffectAction(value)
            ? normalizeEffects(entry, `action=${value.id ?? value.type}`)
            : snapshotActionDeclaration(entry, normalizeEffects)
        ])
      );

  declarationSnapshots.add(snapshot);

  if (Object.values(snapshot).every((entry) => !entry || typeof entry !== 'object' || immutableSnapshots.has(entry)))
    immutableSnapshots.add(snapshot);

  return Object.freeze(snapshot) as T;
}

/** Only normalized, detached reaction lists qualify for the registry's authored-declaration fast path. */
export function snapshotEffectReactions(
  reactions: readonly EffectReaction[],
  normalizeEffects: (effects: readonly SkillEffect[], label: string) => readonly SkillEffect[]
): readonly EffectReaction[] {
  const snapshot = snapshotActionDeclaration(reactions, normalizeEffects);

  if (immutableSnapshots.has(snapshot)) authoredReactions.add(snapshot);

  return snapshot;
}

/** Literal grants depend on neither mutable catalog indexes nor user-supplied amount validators. */
export function hasImmutableLiteralReactions(reactions: readonly EffectReaction[]): boolean {
  return (
    authoredReactions.has(reactions) &&
    reactions.every(
      (rule) =>
        rule.on !== 'combo.resolved' &&
        (Array.isArray(rule.do) ? rule.do : [rule.do]).every(
          (action: SideEffectAction) => action.type === 'resourceGrant' && typeof action.amount === 'number'
        )
    )
  );
}

interface ActionRequirements {
  readonly grants: readonly { readonly resource: ResourceKey | 'endurance'; readonly owner: string }[];
  readonly handlers: readonly { readonly type: string; readonly ownerId: Skill['id'] }[];
}

const catalogRequirements = new WeakMap<CanonicalCatalog, ActionRequirements>();

/** Capture static capability requirements separately from executable actions and live resource policies. */
function readRequirements(catalog: CanonicalCatalog): ActionRequirements {
  const grants: Array<{ resource: ResourceKey | 'endurance'; owner: string }> = [];
  const handlers: Array<{ type: string; ownerId: Skill['id'] }> = [];
  for (const owner of [...catalog.skills, ...catalog.balanceProfiles]) {
    const actions = [
      ...((owner as Skill).sideEffects ?? []).map((rule) => rule.do),
      ...(owner.effects ?? []).flatMap((effect) => (effect.reactions ?? []).flatMap((rule) => rule.do))
    ];
    for (const action of actions) {
      if (action.type === 'resourceGrant')
        grants.push({ resource: action.resource, owner: `${owner.name} (${owner.id})` });

      if (isCustomSideEffectAction(action)) handlers.push({ type: action.type, ownerId: owner.id });
    }
  }

  return { grants, handlers };
}

/** Canonical catalog construction calls this only after its owned action declarations have been detached and frozen. */
export function prepareCatalogActionRequirements(catalog: CanonicalCatalog): void {
  // Admission reads only frozen action types and resource keys; opaque payloads do not change these requirements.
  const stableActions = (rules: readonly { readonly do: SideEffectAction | readonly SideEffectAction[] }[]) =>
    declarationSnapshots.has(rules) &&
    rules.every(
      (rule) =>
        declarationSnapshots.has(rule) &&
        (Array.isArray(rule.do) ? rule.do : [rule.do]).every((action) => declarationSnapshots.has(action))
    );
  const immutable = [...catalog.skills, ...catalog.balanceProfiles].every(
    (owner) =>
      (!(owner as Skill).sideEffects || stableActions((owner as Skill).sideEffects!)) &&
      (owner.effects ?? []).every((effect) => !effect.reactions || stableActions(effect.reactions))
  );

  if (immutable) catalogRequirements.set(catalog, readRequirements(catalog));
}

/** Raw catalogs are re-read on every admission; only the canonical construction boundary supplies cached requirements. */
export function validateCatalogResourceGrants(
  catalog: CanonicalCatalog,
  supported: ReadonlySet<ResourceKey | 'endurance'>
): void {
  for (const { resource, owner } of (catalogRequirements.get(catalog) ?? readRequirements(catalog)).grants) {
    if (!supported.has(resource))
      throw new TypeError(`${owner} grants ${resource}, but the selected runtime has no policy for it.`);
  }
}

/** Handler binding and resource admission consume the same prepared authored-action inventory. */
export function validateCatalogActionHandlers(catalog: CanonicalCatalog, hasHandler: (type: string) => boolean): void {
  for (const { type, ownerId } of (catalogRequirements.get(catalog) ?? readRequirements(catalog)).handlers) {
    if (!hasHandler(type)) throw new TypeError(`Skill ${ownerId} has no side-effect handler registered for ${type}.`);
  }
}
