import { isGw2WeaponSkillEquipped } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { SKILL_DAMAGE_TAIL_MS } from '#gw2/platform/skill-damage/evaluate.js';
import { EQUIPMENT_ICONS } from '#gw2/app/shared/equipment/icons.js';
import { attributePreviewContext, normalizeAttributePreview } from '#gw2/app/build/attribute-effects.js';
import { createIsolatedPreview } from '#gw2/app/build/isolated-preview.js';
import { availableSlotSkills } from '#gw2/app/build/panels/skills.js';
import {
  createPaletteContext,
  paletteActionSkills,
  paletteView,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { GameContentAddress } from '#browser/game/contracts.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { availableProcRateProfiles } from '#gw2/platform/builds/proc-rates.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RotationCommand } from '#gw2/platform/execution/types.js';
import {
  previewControlScopes,
  type AttributePreviewValues,
  type PreviewControl
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SkillDamageProbeSetup } from '#gw2/platform/profession-presentation/skill-damage.js';
import type { Gw2Config, Gw2InitialBuff } from '#gw2/platform/simulation/config.js';
import type { SkillDamageProbe, SkillDamageProcOwner, SkillDamageRequest } from '#gw2/platform/skill-damage/types.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import { RUNE_DATA } from '#gw2/platform/equipment/gear/runes.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/data.js';
import { relicIdForName } from '#gw2/platform/equipment/relics/catalog.js';
import { RELIC_RULES } from '#gw2/platform/equipment/relics/rules/index.js';
import { THORNS_MAX_STACKS } from '#gw2/platform/equipment/relics/rules/thorns.js';
import { SIGIL_DATA, SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';

export type SkillDamageRowStatus = 'equipped' | 'unslotted';
export type SkillDamageGroupKind = 'weapon' | 'mechanic' | 'slot' | 'action';

/** One table row before measurement; the probe with the same id produces its numbers. */
export interface SkillDamageRowDefinition {
  readonly id: string;
  readonly skillId: SkillId;
  readonly name: string;
  readonly icon: string;
  readonly badge: string;
  readonly context: string;
  readonly groupId: string;
  readonly status: SkillDamageRowStatus;
}

export interface SkillDamageGroupDefinition {
  readonly id: string;
  readonly title: string;
  readonly kind: SkillDamageGroupKind;
  readonly rowIds: readonly string[];
}

export interface SkillDamagePlan {
  readonly groups: readonly SkillDamageGroupDefinition[];
  readonly rows: ReadonlyMap<string, SkillDamageRowDefinition>;
  readonly request: SkillDamageRequest & GameContentAddress;
  /** Identifies equivalent requests, so an unchanged build and values never re-run the engine. */
  readonly signature: string;
}

const PREVIEW_BUFF_SECONDS = 3600;
const SLOT_TYPES = Object.freeze(['Heal', 'Utility', 'Elite'] as const);

/** Shared controls the damage panel always offers; professions add their own conditionals beside them. */
function sharedDamageControls(appliesTorment: boolean): PreviewControl[] {
  return [
    {
      key: 'might',
      label: 'Might',
      group: 'Boons',
      kind: 'boon',
      max: 25,
      description: 'stacks; +30 Power and Condition Damage each'
    },
    { key: 'fury', label: 'Fury', group: 'Boons', kind: 'boon', description: '+25% Critical Chance' },
    // Count-based bonuses need a total, not arbitrary extra boons with their own combat effects.
    {
      key: 'boonCount',
      label: 'Number of boons',
      group: 'Boons',
      kind: 'special',
      scope: ['damage'],
      max: GW2_STANDARD_BOONS.length,
      description: 'Total unique boons for per-boon bonuses; does not grant individual boons'
    },
    {
      key: 'targetHealth',
      label: 'Target health (%)',
      group: 'Target conditions',
      kind: 'special',
      scope: ['damage'],
      max: 100,
      initial: 100,
      description: 'Fixed target health for conditional damage'
    },
    {
      key: 'condition:Vulnerability',
      label: 'Vulnerability',
      group: 'Target conditions',
      kind: 'condition',
      field: 'Vulnerability',
      max: 25,
      description: 'stacks; +1% strike and condition damage each'
    },
    ...(appliesTorment
      ? [
          {
            key: 'targetMoving',
            label: 'Target moving',
            group: 'Target conditions',
            kind: 'special' as const,
            scope: ['damage' as const],
            description: 'Torment uses the moving-target formula'
          }
        ]
      : [])
  ];
}

/** Shared controls first, then the profession's damage-scoped controls; a profession key never duplicates a shared one. */
export function skillDamageControls(app: ProfessionAppState): PreviewControl[] {
  const shared = sharedDamageControls(planSkills(app).some(appliesTorment));
  // Reuse the selected relic's opening stack state and cap without changing saved simulation assumptions.
  if (app.build.relic === 'Thorns')
    shared.push({
      key: 'thornsStacks',
      label: 'Thorns stacks',
      group: 'Other buffs',
      kind: 'special',
      scope: ['damage'],
      max: THORNS_MAX_STACKS,
      description: 'Starting stacks; subsequent gains follow the relic’s normal rules'
    });
  const keys = new Set(shared.map((control) => control.key));
  const owned = app.profession.ui
    .previewControls(attributePreviewContext(app))
    .filter(
      (control) => previewControlScopes(control).includes('damage') && control.kind !== 'boon' && !keys.has(control.key)
    );
  return [...shared, ...owned];
}

/** The saved simulation assumptions, expressed as this panel's values; nothing is written back. */
export function simulationConfigValues(
  app: ProfessionAppState,
  controls: readonly PreviewControl[]
): AttributePreviewValues {
  const assumptions = app.build.assumptions as Record<string, unknown> & {
    readonly targetConditions?: Readonly<Record<string, unknown>>;
  };
  const values: Record<string, unknown> = {};
  for (const control of controls) {
    if (control.kind === 'boon') values[control.key] = assumptions[control.key];
    else if (control.key === 'boonCount')
      values[control.key] = GW2_STANDARD_BOONS.filter((kind) => Boolean(assumptions[kind])).length;
    else if (control.kind === 'condition') values[control.key] = assumptions.targetConditions?.[control.field ?? ''];
    else if (control.key === 'targetMoving') values[control.key] = assumptions.targetMoving;
    else if (control.key === 'thornsStacks')
      values[control.key] = app.adapter.simulationConfig(app).initialThornsStacks ?? 0;
    else if (control.key === 'targetHealth')
      values[control.key] = (app.adapter.simulationConfig(app).target?.startingHealthFraction ?? 1) * 100;
  }

  return normalizeAttributePreview(
    controls,
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value])
    )
  );
}

/** Every control at its lowest value: no boons, target conditions, or conditional trait effects. */
export function clearedValues(controls: readonly PreviewControl[]): AttributePreviewValues {
  return normalizeAttributePreview(
    controls,
    Object.fromEntries(
      controls.map((control) => [
        control.key,
        control.key === 'targetHealth' ? 100 : (control.options?.[0] ?? control.min ?? 0)
      ])
    )
  );
}

function appliesTorment(skill: Skill): boolean {
  return (skill.effects ?? []).some(
    (effect) =>
      (effect.type === 'condition' && effect.condition === 'Torment') ||
      (Array.isArray(effect.ticks) &&
        effect.ticks.some((tick: { condition?: unknown }) => tick.condition === 'Torment'))
  );
}

/** Inspect normalized nested effects/finishers instead of maintaining another list of eligible skill IDs. */
function declares(value: unknown, field: string, expected: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record[field] === expected || Object.values(record).some((child) => declares(child, field, expected));
}

/**
 * The build as it starts, without the rotation's latest state: palette projections then show the same skills no
 * matter where the rotation editor's cursor or last result left resources, charges, or forms.
 */
function buildStart(app: ProfessionAppState): ProfessionAppState {
  return { ...app, results: null, rotationInsertionIndex: null } as ProfessionAppState;
}

/** Weapon skills of each equipped set; a non-swapping profession contributes only its active set. */
function weaponRows(app: ProfessionAppState): { set: number; weapon: string; skills: Skill[] }[] {
  const sets = app.build.alternateWeapons?.[0] ? [1, 2] : [1];
  const groups: { set: number; weapon: string; skills: Skill[] }[] = [];
  for (const set of sets) {
    for (const skill of weaponSkills(buildStart(app), set)) {
      const weapon = String(skill.weapon || skill.skillWeapon || 'Weapon');
      let group = groups.find((entry) => entry.set === set && entry.weapon === weapon);
      if (!group) {
        group = { set, weapon, skills: [] };
        groups.push(group);
      }

      group.skills.push(skill);
    }
  }

  return groups;
}

/** Every slot skill the specialization can use; professions with fixed loadouts list their selected skills. */
function slotSkills(app: ProfessionAppState): { skill: Skill; status: SkillDamageRowStatus }[] {
  const specialization = app.adapter.eliteSpecialization(app.build);
  if (app.adapter.slotLoadout) {
    const context = { build: app.build, specialization, professionState: undefined };
    const ids = app.adapter.slotLoadout
      .view(context)
      .bars.flatMap((bar) =>
        bar.skillIds.flatMap((id) => [id, ...(app.adapter.slotLoadout!.skillChildren?.(context, id) ?? [])])
      );
    return [...new Set(ids)].flatMap((id) => {
      const skill = app.skillById.get(Number(id));
      return skill ? [{ skill, status: 'equipped' as const }] : [];
    });
  }

  const selected = selectedSkillNameSet(app.build.selectedSkills);
  const choices = SLOT_TYPES.flatMap((type) =>
    availableSlotSkills(app, type).map((skill) => ({
      skill,
      status: selected.has(skill.name) ? ('equipped' as const) : ('unslotted' as const)
    }))
  );
  // Slot pickers hide armed follow-ups; their authored chains still belong in the damage preview.
  const rows = new Map(choices.map((row) => [row.skill.id, row]));
  for (const row of rows.values()) {
    if (row.skill.flipSkillId == null) continue;
    const child = app.skillById.get(Number(row.skill.flipSkillId));
    if (child && !rows.has(child.id)) rows.set(child.id, { skill: child, status: row.status });
  }

  return [...rows.values()];
}

/** Profession mechanic groups; without declared groups, the profession's palette groups supply them. */
function mechanicGroups(
  app: ProfessionAppState,
  claimed: ReadonlySet<SkillId>
): { id: string; title: string; skills: Skill[] }[] {
  const declared = app.profession.ui.skillDamageGroups(attributePreviewContext(app));
  const sorted = [...declared].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const seen = new Set(claimed);
  const groups = [
    ...sorted.map((group) => ({
      id: group.id,
      title: group.title,
      skillIds: group.skillIds,
      includeActionSkills: true
    })),
    ...paletteView(app.profession, createPaletteContext(buildStart(app))).map((group, index) => ({
      id: `palette-${group.id}`,
      title: index ? group.label : 'Profession skills',
      includeActionSkills: group.includeActionSkills,
      // Palette entries carry real attunement and legend actions as well as plain skill IDs.
      skillIds: [...group.skillIds, ...(group.skillEntries ?? []).map((entry) => entry.skillId)]
    }))
  ];
  return groups
    .map((group) => ({
      id: group.id,
      title: group.title,
      skills: group.skillIds.flatMap((id) => {
        const skill = app.skillById.get(Number(id));
        if (!skill || seen.has(skill.id) || (skill.type === 'Action' && !group.includeActionSkills)) return [];
        seen.add(skill.id);
        return [skill];
      })
    }))
    .filter((group) => group.skills.length);
}

/** All skills the panel lists, for control decisions that depend on what can be cast. */
function planSkills(app: ProfessionAppState): Skill[] {
  const weapons = weaponRows(app).flatMap((group) => group.skills);
  const slots = slotSkills(app).map(({ skill }) => skill);
  const claimed = new Set([...weapons, ...slots].map((skill) => skill.id));
  return [...weapons, ...mechanicGroups(app, claimed).flatMap((group) => group.skills), ...slots];
}

/** A skill's authored position in its chain, when the catalog records one. */
function chainStep(skill: Skill): number | null {
  const step = Number(skill.weaponBarChainStep ?? (skill as { readonly chainStep?: unknown }).chainStep);
  return Number.isFinite(step) && step > 0 ? step : null;
}

/**
 * Chain and flip predecessors, root first, so a later chain step is cast from its real position. Auto-attack chains
 * loop back to their first step, so the walk stops at a recorded first step or whenever it would revisit the skill.
 */
function predecessors(app: ProfessionAppState, skill: Skill): Skill[] {
  const positions = (app.activeCatalog ?? app.profession.catalog).autoattackChainPositions;
  const position = positions.get(Number(skill.id));
  if (position)
    return [...positions.entries()]
      .filter(([, candidate]) => candidate.root === position.root && candidate.index < position.index)
      .sort(([, left], [, right]) => left.index - right.index)
      .map(([id]) => app.skillById.get(id)!)
      .filter(Boolean);
  const chain: Skill[] = [];
  let current: Skill | undefined = skill;
  for (let depth = 0; current && depth < 8 && chainStep(current) !== 1; depth += 1) {
    const currentId: SkillId = current.id;
    const parent: Skill | undefined =
      current.flipParentId != null
        ? app.skillById.get(Number(current.flipParentId))
        : app.skills.find((candidate) => candidate.flipSkillId === currentId || candidate.nextChainId === currentId);
    if (!parent || chain.includes(parent)) break;
    // A loop without recorded steps has no knowable start; measure the skill as if it began the chain.
    if (parent.id === skill.id) return [];
    const parentStep = chainStep(parent);
    const currentStep = chainStep(current);
    if (parentStep != null && currentStep != null && parentStep >= currentStep) break;
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}

/** Replaces one selected skill of the same slot type, so an unslotted skill can be cast in its own probe. */
function selectionWith(app: ProfessionAppState, config: Gw2Config, skill: Skill): string[] {
  const names = [...selectedSkillNameSet(config.selectedSkills ?? app.build.selectedSkills)];
  const sameType = names
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => app.skillByName.get(name)?.type === skill.type);
  const replaced = sameType.at(-1);
  if (replaced) names[replaced.index] = skill.name;
  else names.push(skill.name);
  return names;
}

function slotBadge(skill: Skill): string {
  const slot = String(skill.slot ?? '');
  const weaponSlot = /^Weapon_(\d)$/.exec(slot);
  if (weaponSlot) return weaponSlot[1];
  const professionSlot = /^Profession_(\d)$/.exec(slot);
  if (professionSlot) return `F${professionSlot[1]}`;
  if (skill.type === 'Heal') return 'H';
  if (skill.type === 'Elite') return 'E';
  if (skill.type === 'Utility') return 'U';
  return String(skill.name).charAt(0);
}

/** "chain n of m" for chained skills; followers stop where a looping chain returns to its start. */
function chainContext(app: ProfessionAppState, skill: Skill): string {
  const before = predecessors(app, skill);
  if (!before.length && skill.flipSkillId == null && skill.nextChainId == null) return '';
  const seen = new Set<SkillId>([...before.map((entry) => entry.id), skill.id]);
  let length = before.length + 1;
  let next = skill.nextChainId ?? skill.flipSkillId;
  for (let depth = 0; next != null && depth < 8; depth += 1) {
    const following = app.skillById.get(Number(next));
    if (!following || seen.has(following.id) || chainStep(following) === 1) break;
    seen.add(following.id);
    length += 1;
    next = following.nextChainId ?? following.flipSkillId;
  }

  return length > 1 ? `chain ${before.length + 1} of ${length}` : '';
}

/**
 * Builds the detached preview configuration: the saved build with this panel's boons, target conditions, held
 * buffs, and profession fields applied; deterministic runs average critical damage, and the target cannot die.
 */
function previewConfig(
  app: ProfessionAppState,
  controls: readonly PreviewControl[],
  values: AttributePreviewValues
): Gw2Config {
  const boons = Object.fromEntries(
    GW2_STANDARD_BOONS.map((kind) => [kind, kind === 'might' ? Number(values[kind] || 0) : Boolean(values[kind])])
  );
  const { config, context } = createIsolatedPreview(
    app,
    controls,
    values,
    boons,
    Number(app.build.startingWeaponSet) === 2 ? 2 : 1
  );
  // Only this panel's explicit values become assumptions; hidden saved conditions cannot leak into Clear buffs.
  const conditions: Record<string, unknown> = {};
  for (const control of controls) {
    if (control.kind !== 'condition') continue;
    const stacks = Number(values[control.key]) || 0;
    if (stacks > 0) conditions[control.field ?? control.key] = control.max ? stacks : true;
    else delete conditions[control.field ?? control.key];
  }

  const disabledTraitIds = new Set(
    controls
      .filter((control) => control.kind === 'queryTrait' && !values[control.key])
      .map((control) => context.activeTraits.find((trait) => trait.name === control.field)?.id)
  );
  const initialBuffs: Gw2InitialBuff[] = controls
    .filter((control) => control.kind === 'buff' && Number(values[control.key]) > 0)
    .map((control) => ({
      kind: control.field || control.key,
      stacks: Number(values[control.key]),
      duration: PREVIEW_BUFF_SECONDS,
      name: control.label
    }));
  const targetHealth = values.targetHealth == null ? null : Number(values.targetHealth) / 100;
  const patch = app.profession.ui.prepareSkillDamagePreview({ ...attributePreviewContext(app), values });
  return {
    ...config,
    ...patch,
    randomness: { ...config.randomness, mode: 'deterministic' } as Gw2Config['randomness'],
    criticalDamageMode: 'averaged',
    fixedBoonCount: Number(values.boonCount) || 0,
    ...(values.thornsStacks == null ? {} : { initialThornsStacks: Number(values.thornsStacks) }),
    selectedTraitIds: config.selectedTraitIds?.filter((id) => !disabledTraitIds.has(id)),
    ...(initialBuffs.length ? { initialBuffs } : {}),
    target: {
      ...config.target,
      // An unbounded target keeps every probe on the supported target-health path without dying mid-measurement.
      health: 0,
      fixedHealthFraction: targetHealth ?? config.target?.startingHealthFraction ?? 1,
      ...(targetHealth == null ? {} : { startingHealthFraction: targetHealth }),
      ...(values.targetMoving == null ? {} : { moving: Boolean(values.targetMoving) }),
      conditions: conditions as NonNullable<Gw2Config['target']>['conditions']
    }
  };
}

/**
 * Build elements whose packets form proc rows, with the icon each row shows. Selected traits match by name or id;
 * relics, sigils, and food match the source ids their rules stamp on packets.
 */
function procOwners(app: ProfessionAppState): SkillDamageProcOwner[] {
  const build = app.build;
  const traitIcons = new Map(
    (app.activeCatalog || app.profession.catalog).traits.map((trait) => [trait.id, trait.icon])
  );
  const catalog = app.activeCatalog || app.profession.catalog;
  const owners: SkillDamageProcOwner[] = (app.attributeData?.activeTraits ?? []).map((trait) => {
    const profiles = [...catalog.balanceProfilesById.values()].filter(
      (profile) => profile.id === trait.id || profile.parentId === trait.id
    );
    const damage = profiles.find(
      (profile) =>
        !profile.damagePreviewAttribution &&
        (profile.effects ?? []).some(
          (effect) =>
            effect.type === 'strike' ||
            (effect.type === 'condition' && Object.hasOwn(CONDITION_FORMULAS, String(effect.condition ?? effect.name)))
        )
    );
    return {
      key: String(trait.id),
      source: 'Trait',
      name: trait.name,
      icon: String(traitIcons.get(trait.id) ?? ''),
      matches: [trait.name, String(trait.id), ...profiles.map((profile) => profile.name)],
      // Reuse the owner's damage declaration; an absent observation must not masquerade as measured zero damage.
      triggerRequirement: damage
        ? (damage.damagePreviewRequirement ??
          'Requires a qualifying action with the selected traits, weapons and preview state.')
        : undefined
    };
  });
  const relicData = RELIC_DATA as Readonly<Record<string, { readonly id: number; readonly icon: string }>>;
  for (const relic of new Set([build.relic, ...(build.precastRelics ?? [])].filter(Boolean))) {
    const data = relicData[relic];
    if (data)
      owners.push({
        key: relic,
        source: 'Relic',
        icon: data.icon,
        matches: [`relic.${data.id}`, String(data.id), `Relic of ${relic}`, `Relic of the ${relic}`],
        triggerRequirement: RELIC_RULES[data.id]?.damagePreview?.requirement
      });
  }

  for (const sigil of new Set((build.weaponSigils || []).flat().filter(Boolean))) {
    const data = SIGIL_DATA[sigil];
    if (data)
      owners.push({
        key: sigil,
        source: 'Sigil',
        name: `Sigil of ${sigil}`,
        icon: data.icon,
        matches: [`sigil.${data.id}`, `Sigil of ${sigil}`],
        triggerRequirement: (() => {
          const proc = (SIGIL_PROCS as Readonly<Record<number, Gw2SigilProc>>)[data.id];
          return proc && ['strike', 'condition', 'strike-condition', 'next-hit-condition'].includes(proc.effect)
            ? `Requires an eligible ${proc.trigger} trigger while this sigil's weapon set is active.`
            : undefined;
        })()
      });
  }

  const rune = RUNE_DATA[build.rune as keyof typeof RUNE_DATA];
  if (rune)
    owners.push({
      key: build.rune,
      source: 'Rune',
      name: `Rune of ${build.rune}`,
      icon: EQUIPMENT_ICONS[build.rune] ?? '',
      matches: [`Rune of ${build.rune}`, `Superior Rune of ${build.rune}`]
    });
  const food = (
    FOOD_DATA as Readonly<Record<string, { readonly icon?: string; readonly proc?: { readonly name: string } }>>
  )[build.food];
  if (food?.proc)
    owners.push({
      key: build.food,
      source: 'Food',
      name: food.proc.name,
      icon: food.proc.name === 'Nourishment' ? NOURISHMENT_ICON : (EQUIPMENT_ICONS[build.food] ?? ''),
      matches: [food.proc.name, `food.${food.proc.name.toLowerCase()}`],
      triggerRequirement: 'Requires a qualifying strike with this nourishment active.'
    });
  return owners;
}

/** Enumerates rows and probes, then attaches the preview configuration every probe shares. */
export function createSkillDamagePlan(
  app: ProfessionAppState,
  controls: readonly PreviewControl[],
  values: AttributePreviewValues
): SkillDamagePlan {
  const config = previewConfig(app, controls, values);
  const context = attributePreviewContext(app);
  const groups: SkillDamageGroupDefinition[] = [];
  const rows = new Map<string, SkillDamageRowDefinition>();
  const probes: SkillDamageProbe[] = [];
  const procFollowUps = new Map<string, readonly RotationCommand[]>();
  const procSetups = new Map<string, readonly RotationCommand[]>();
  const addRow = (
    group: { id: string; title: string; kind: SkillDamageGroupKind },
    skill: Skill,
    status: SkillDamageRowStatus,
    base: { context: string; weaponSet?: number; selectedSkills?: readonly string[] }
  ): string => {
    const id = `${group.id}:${skill.id}`;
    const owned: SkillDamageProbeSetup | null = app.profession.ui.skillDamageProbe({ ...context, values }, skill);
    if (owned?.procFollowUpSetup) procFollowUps.set(id, owned.procFollowUpSetup);
    if (owned?.procSetup) procSetups.set(id, owned.procSetup);
    const parents = predecessors(app, skill);
    // Explicit mechanic setup is authoritative; generic chains fill in only missing predecessors.
    const setup: RotationCommand[] = [...(owned?.setup ?? [])];
    const chainParents = owned?.skipPredecessors ? [] : parents;
    for (const parent of chainParents) {
      if (!setup.some((command) => command.type === 'cast' && command.skillId === parent.id)) {
        setup.push({ type: 'cast', skillId: parent.id });
      }
    }

    const root = parents[0] ?? skill;
    let selectedSkills =
      SLOT_TYPES.includes(root.type as (typeof SLOT_TYPES)[number]) &&
      (parents.length > 0 || !selectedSkillNameSet(config.selectedSkills).has(root.name))
        ? selectionWith(app, config, root)
        : base.selectedSkills;
    if (selectedSkills && SLOT_TYPES.includes(skill.type as (typeof SLOT_TYPES)[number]))
      selectedSkills = [...new Set([...selectedSkills, skill.name])];
    // Setup utilities use the ordinary selection gate too, without changing the saved loadout.
    for (const command of setup) {
      if (command.type !== 'cast') continue;
      const setupSkill = app.skillById.get(Number(command.skillId));
      if (setupSkill && SLOT_TYPES.includes(setupSkill.type as (typeof SLOT_TYPES)[number])) {
        selectedSkills = [
          ...new Set([...selectedSkillNameSet(selectedSkills ?? config.selectedSkills), setupSkill.name])
        ];
      }
    }

    probes.push({
      id,
      skillId: skill.id,
      name: skill.name,
      setup,
      ...(owned?.cast ? { cast: owned.cast } : {}),
      config: {
        ...(base.weaponSet ? { startingWeaponSet: base.weaponSet } : {}),
        ...(owned?.initialResource != null ? { initialResource: owned.initialResource } : {}),
        ...(owned?.config ? { profession: owned.config } : {}),
        ...(selectedSkills ? { selectedSkills } : {})
      },
      ...(owned?.variants?.length ? { variants: owned.variants } : {}),
      ...(owned?.primaryVariantId ? { primaryVariantId: owned.primaryVariantId } : {}),
      // Begin with a short tail; queued effects and condition expiries determine any extension.
      tailMs: SKILL_DAMAGE_TAIL_MS
    });
    rows.set(id, {
      id,
      skillId: skill.id,
      name: skill.name,
      icon: String(skill.icon || ''),
      badge: slotBadge(skill),
      context: owned?.context ?? base.context,
      groupId: group.id,
      status
    });
    return id;
  };

  const weaponGroups = weaponRows(app);
  const repeated = new Set(
    weaponGroups
      .filter((group, index) => weaponGroups.findIndex((other) => other.weapon === group.weapon) !== index)
      .map((group) => group.weapon)
  );
  for (const weaponGroup of weaponGroups) {
    const group = {
      id: `weapon-${weaponGroup.set}-${weaponGroup.weapon}`,
      title: repeated.has(weaponGroup.weapon) ? `${weaponGroup.weapon} (set ${weaponGroup.set})` : weaponGroup.weapon,
      kind: 'weapon' as const
    };
    const rowIds = weaponGroup.skills.map((skill) => {
      const slot = slotBadge(skill);
      const chain = chainContext(app, skill);
      return addRow(group, skill, 'equipped', {
        context: [`${weaponGroup.weapon} ${slot}`, chain].filter(Boolean).join(' · '),
        weaponSet: weaponGroup.set
      });
    });
    groups.push({ ...group, rowIds });
  }

  const slots = slotSkills(app);
  const claimed = new Set(
    [...weaponGroups.flatMap((group) => group.skills), ...slots.map(({ skill }) => skill)].map((skill) => skill.id)
  );
  for (const mechanic of mechanicGroups(app, claimed)) {
    const group = { id: `mechanic-${mechanic.id}`, title: mechanic.title, kind: 'mechanic' as const };
    const rowIds = mechanic.skills.flatMap((skill) => {
      const weaponSet = (app.build.alternateWeapons?.[0] ? [1, 2] : [1]).find((set) =>
        isGw2WeaponSkillEquipped(
          { config, weaponSet: set, catalog: context.catalog },
          skill,
          app.adapter.weaponSkillMatchesSet
        )
      );
      if (!weaponSet) return [];
      const chain = chainContext(app, skill);
      const badge = slotBadge(skill);
      // Numbered mechanic slots read like weapon slots ("Gunsaber 2"); profession slots keep the group title.
      const slot = /^\d$/.test(badge) ? `${mechanic.title} ${badge}` : mechanic.title;
      return addRow(group, skill, 'equipped', { context: [slot, chain].filter(Boolean).join(' · '), weaponSet });
    });
    groups.push({ ...group, rowIds });
  }

  if (slots.length) {
    const group = { id: 'slot', title: 'Heal, utility and elite', kind: 'slot' as const };
    const rowIds = slots.map(({ skill, status }) =>
      addRow(group, skill, status, {
        context: `${skill.type} · ${status === 'equipped' ? 'slotted' : 'not slotted'}`,
        ...(status === 'unslotted' ? { selectedSkills: selectionWith(app, config, skill) } : {})
      })
    );
    groups.push({ ...group, rowIds });
  }

  // Reuse the profession's action palette, including its actual dodge and swap identities for proc triggers.
  const actions = paletteActionSkills(buildStart(app)).filter((skill) => app.skillById.has(Number(skill.id)));
  const actionGroup = { id: 'action', title: 'Actions', kind: 'action' as const };
  const actionIds = actions
    .filter((skill) => ![...rows.values()].some((row) => row.skillId === skill.id))
    .map((skill) => addRow(actionGroup, skill, 'equipped', { context: skill.name }));
  if (actionIds.length) groups.push({ ...actionGroup, rowIds: actionIds });

  // Trigger runs use ordinary combat commands and the existing proc-rate settings, never duplicated proc packets.
  const procRateOverrides = Object.fromEntries(
    availableProcRateProfiles(context.catalog, config.selectedTraitIds ?? []).map((profile) => [
      profile.procRate!.id,
      1
    ])
  );
  // Relic-owned prerequisites affect only discovery runs; the real relic rule emits and prices the proc.
  const relicId = relicIdForName(config.relic);
  const relicPreview = relicId == null ? undefined : RELIC_RULES[relicId]?.damagePreview;
  const targetConditions = relicPreview?.targetConditions;
  const discoveryConfig = { procRateOverrides };
  const triggers = probes.map((probe): SkillDamageProbe => ({
    ...probe,
    id: `trigger:${probe.id}`,
    procOnly: true,
    variants: undefined,
    cast: probe.variants?.find((variant) => variant.id === probe.primaryVariantId)?.cast ?? probe.cast,
    setup: [{ type: 'combat-start' }, ...(procSetups.get(probe.id) ?? []), ...probe.setup],
    config: { ...probe.config, ...discoveryConfig }
  }));
  // Armed skills need a real subsequent hit. Reuse the equipped weapon probe and owner-supplied mode transitions.
  for (const [id, transitions] of procFollowUps) {
    const armed = probes.find((probe) => probe.id === id)!;
    const set = armed.config?.startingWeaponSet ?? config.startingWeaponSet ?? 1;
    const weapon = weaponGroups.find((group) => group.set === set);
    const startElement = armed.config?.profession?.startAttunement;
    const hit = probes.find(
      (probe) =>
        weapon?.skills.some((skill) => skill.id === probe.skillId && skill.slot === 'Weapon_1') &&
        probe.config?.startingWeaponSet === set &&
        (startElement == null || probe.config?.profession?.startAttunement === startElement)
    );
    if (!hit) continue;
    triggers.push({
      ...hit,
      id: `trigger:armed:${id}`,
      name: armed.name,
      procOnly: true,
      setup: [
        { type: 'combat-start' },
        ...(procSetups.get(armed.id) ?? []),
        ...armed.setup,
        { ...armed.cast, type: 'cast', skillId: armed.skillId, offTarget: false },
        ...transitions,
        ...hit.setup
      ],
      config: {
        ...hit.config,
        ...armed.config,
        startingWeaponSet: set,
        ...discoveryConfig,
        // Both setups may introduce a utility (for example stealth); preserve both legal selections.
        selectedSkills: [
          ...new Set([
            ...selectedSkillNameSet(hit.config?.selectedSkills ?? config.selectedSkills),
            ...selectedSkillNameSet(armed.config?.selectedSkills ?? config.selectedSkills)
          ])
        ]
      }
    });
  }

  // Swapping can arm a proc for the next hit (Doom); a swap-only measurement cannot observe that damage.
  const swap = actions.find((skill) => skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS);
  if (swap && app.profession.ui.weaponSwapChangesSet !== false && app.build.alternateWeapons?.[0]) {
    for (const weapon of weaponGroups) {
      const skill = weapon.skills[0];
      const base = probes.find(
        (probe) => probe.skillId === skill?.id && probe.config?.startingWeaponSet === weapon.set
      );
      if (!base) continue;
      triggers.push({
        ...base,
        id: `trigger:swap:${base.id}`,
        procOnly: true,
        setup: [
          { type: 'combat-start' },
          ...(procSetups.get(base.id) ?? []),
          { type: 'cast', skillId: swap.id },
          ...base.setup
        ],
        config: { ...base.config, startingWeaponSet: weapon.set === 1 ? 2 : 1, ...discoveryConfig }
      });
    }
  }

  // Priming one relic must not change the measured amount of unrelated trait or equipment procs.
  if (relicPreview && (targetConditions || relicPreview.repetitions || relicPreview.comboField)) {
    const conditions = Object.fromEntries(
      Object.entries(targetConditions ?? {}).map(([name, stacks]) => [
        name,
        Math.max(Number(config.target?.conditions?.[name]) || 0, Number(stacks))
      ])
    );
    const candidates = triggers.filter((probe) => {
      if (!relicPreview.repetitions) return true;
      if (
        !probe.id.startsWith('trigger:') ||
        probe.id.startsWith('trigger:armed:') ||
        probe.id.startsWith('trigger:swap:')
      )
        return false;
      const skill = app.skillById.get(Number(probe.skillId));
      const setupCasts = probe.setup.filter((command) => command.type === 'cast');
      // Persistent kits can repeat in place; consumed flips and chains must replay their real prerequisites.
      const repeatable =
        skill &&
        skill.skillFamily !== 'Familiar' &&
        (skill.kitId != null ||
          setupCasts.length === 0 ||
          setupCasts.every(
            (command) =>
              command.skillId === skill.flipParentId ||
              app.skillById.get(Number(command.skillId))?.flipSkillId === skill.id ||
              skill.stealthAttack
          ));
      return (
        repeatable &&
        skill != null &&
        (relicPreview.repeatCondition
          ? declares(skill.effects, 'condition', relicPreview.repeatCondition)
          : declares([skill.effects, skill.comboFinishers], 'finisherType', relicPreview.repeatFinisher!))
      );
    });
    triggers.push(
      ...candidates.map((probe): SkillDamageProbe => ({
        ...probe,
        id: `relic:${probe.id}`,
        procOwnerIds: [`Relic|${config.relic}`],
        // Additional casts exercise real counter, recharge and resource rules; they never manufacture proc packets.
        setup: [
          ...probe.setup,
          ...Array.from({ length: Math.max(0, (relicPreview.repetitions ?? 1) - 1) }, () => [
            { ...probe.cast, type: 'cast' as const, skillId: probe.skillId, offTarget: false },
            ...(relicPreview.repeatIntervalMs
              ? [{ type: 'wait' as const, durationMs: relicPreview.repeatIntervalMs }]
              : []),
            ...(app.skillById.get(Number(probe.skillId))?.kitId != null
              ? []
              : probe.setup.filter((command) => command.type === 'cast'))
          ]).flat()
        ],
        config: {
          ...probe.config,
          targetConditions: conditions,
          ...(relicPreview.comboField
            ? {
                profession: {
                  ...probe.config?.profession,
                  professionAssumptions: {
                    ...config.professionAssumptions,
                    permanentComboField: relicPreview.comboField
                  }
                }
              }
            : {})
        }
      }))
    );
    // Distinct finishers can reach short-lived counters when repeating one skill would wait out the stack window.
    // A setup-free finisher can join an established kit, without switching forms or introducing another weapon bar.
    if (relicPreview.repeatFinisher) {
      for (const probe of candidates) {
        // Consumable flip prerequisites belong to the repeated single-skill route, not a shared persistent bar.
        if (
          probe.setup.some((command) => command.type === 'cast') &&
          app.skillById.get(Number(probe.skillId))?.kitId == null
        )
          continue;
        const compatible = candidates.filter(
          (other) =>
            (other.config?.startingWeaponSet ?? config.startingWeaponSet ?? 1) ===
              (probe.config?.startingWeaponSet ?? config.startingWeaponSet ?? 1) &&
            (JSON.stringify(other.setup) === JSON.stringify(probe.setup) ||
              (!other.setup.some((command) => command.type === 'cast') &&
                app.skillById.get(Number(other.skillId))?.type !== 'Weapon')) &&
            JSON.stringify(other.config?.profession) === JSON.stringify(probe.config?.profession)
        );
        if (compatible.length < 2) continue;
        const prepared = triggers.find((entry) => entry.id === `relic:${probe.id}`)!;
        const sequence = Array.from({ length: relicPreview.repetitions! }, (_, i) => compatible[i % compatible.length]);
        const last = sequence.at(-1)!;
        triggers.push({
          ...prepared,
          id: `relic:sequence:${probe.id}`,
          skillId: last.skillId,
          name: last.name,
          setup: [
            ...probe.setup,
            ...sequence
              .slice(0, -1)
              .map((entry) => ({ ...entry.cast, type: 'cast' as const, skillId: entry.skillId, offTarget: false }))
          ],
          config: {
            ...prepared.config,
            selectedSkills: [
              ...new Set(
                compatible.flatMap((entry) => [
                  ...selectedSkillNameSet(entry.config?.selectedSkills ?? config.selectedSkills)
                ])
              )
            ]
          }
        });
      }
    }
  }

  const request = {
    gameId: app.gameId,
    contentId: app.contentId,
    config,
    probes: [...probes, ...triggers],
    procOwners: procOwners(app)
  };
  return { groups, rows, request, signature: JSON.stringify(request) };
}
