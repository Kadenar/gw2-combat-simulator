import type { GameContentAddress } from '#browser/game/contracts.js';
import { attributePreviewContext, normalizeAttributePreview } from '#gw2/app/build/attribute-effects.js';
import { createSkillDamagePreview } from '#gw2/app/build/skill-damage/preview.js';
import { availableSlotSkills } from '#gw2/app/build/panels/skills.js';
import {
  createPaletteContext,
  paletteActionSkills,
  paletteView,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { THORNS_MAX_STACKS } from '#gw2/platform/equipment/relics/rules/thorns.js';
import { isGw2WeaponSkillEquipped } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import {
  previewControlScopes,
  type AttributePreviewValues,
  type PreviewControl
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SkillDamageState } from '#gw2/platform/profession-presentation/skill-damage.js';
import { damageOccurrences } from '#gw2/platform/skill-damage/catalog.js';
import type { SkillDamageOccurrence, SkillDamageRequest } from '#gw2/platform/skill-damage/types.js';

export type SkillDamageRowStatus = 'equipped' | 'unslotted';
export type SkillDamageGroupKind = 'weapon' | 'mechanic' | 'slot' | 'action';

/** One table row before measurement; the occurrence with the same id produces its numbers. */
export interface SkillDamageRowDefinition {
  readonly id: string;
  readonly skillId: SkillId;
  readonly name: string;
  readonly icon: string;
  readonly badge: string;
  readonly context: string;
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

const SLOT_TYPES = Object.freeze(['Heal', 'Utility', 'Elite'] as const);

/** Shared controls the damage panel always offers; professions add their own conditionals beside them. */
function sharedDamageControls(): PreviewControl[] {
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
    // Movement also affects procedural and equipment Torment, which need not appear in the skill catalog.
    {
      key: 'targetMoving',
      label: 'Target moving',
      group: 'Target conditions',
      kind: 'special',
      scope: ['damage'],
      description: 'Torment uses the moving-target formula'
    }
  ];
}

/** Shared controls first, then the profession's damage-scoped controls; a profession key never duplicates a shared one. */
export function skillDamageControls(app: ProfessionAppState): PreviewControl[] {
  const shared = sharedDamageControls();
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
  // Retain profession boons such as Resolution; only shared keys are already represented.
  // Damage rows cover every equipped set, independently of the Attribute Preview selector.
  const sets = app.build.alternateWeapons?.[0] ? [1, 2] : [1];
  const owned = sets
    .flatMap((set) => app.profession.ui.previewControls(attributePreviewContext(app, set)))
    .filter((control) => {
      if (!previewControlScopes(control).includes('damage') || keys.has(control.key)) return false;
      keys.add(control.key);
      return true;
    });
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
    // Follow-up rows must use the same selected relationships as the palette and runtime.
    const context = { build: app.build, specialization, professionState: undefined, catalog: app.activeCatalog };
    const ids = app.adapter.slotLoadout
      .view(context)
      .bars.flatMap((bar) =>
        bar.skillIds.flatMap((id) => [id, ...(app.adapter.slotLoadout!.skillChildren?.(context, id) ?? [])])
      );
    return [...new Set(ids)].flatMap((id) => {
      const skill = app.skillById.get(id);
      return skill ? [{ skill, status: 'equipped' as const }] : [];
    });
  }

  const selected = selectedSkillIdSet(app.build.selectedSkillIds);
  const choices = SLOT_TYPES.flatMap((type) =>
    availableSlotSkills(app, type).map((skill) => ({
      skill,
      status: selected.has(skill.id) ? ('equipped' as const) : ('unslotted' as const)
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
  const declared = app.profession.ui.skillDamageGroups(attributePreviewContext(app, app.build.startingWeaponSet));
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
        const skill = app.skillById.get(id);
        if (!skill || seen.has(skill.id) || (skill.type === 'Action' && !group.includeActionSkills)) return [];
        seen.add(skill.id);
        return [skill];
      })
    }))
    .filter((group) => group.skills.length);
}

/** A skill's authored position in its chain, when the catalog records one. */
function chainStep(skill: Skill): number | null {
  const step = Number(skill.weaponBarChainStep ?? (skill as { readonly chainStep?: unknown }).chainStep);
  return Number.isFinite(step) && step > 0 ? step : null;
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
/** Read chain positions for labels only; no predecessors are executed. */
function chainPredecessors(app: ProfessionAppState, skill: Skill): Skill[] {
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

function chainContext(app: ProfessionAppState, skill: Skill): string {
  const before = chainPredecessors(app, skill);
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

/** Enumerates rows and occurrences, then attaches the preview configuration every occurrence shares. */
export function createSkillDamagePlan(
  app: ProfessionAppState,
  controls: readonly PreviewControl[],
  values: AttributePreviewValues
): SkillDamagePlan {
  const { config, context, inputs } = createSkillDamagePreview(app, controls, values);
  const groups: SkillDamageGroupDefinition[] = [];
  const rows = new Map<string, SkillDamageRowDefinition>();
  const occurrences: SkillDamageOccurrence[] = [];
  const addRow = (
    group: { id: string; title: string; kind: SkillDamageGroupKind },
    skill: Skill,
    status: SkillDamageRowStatus,
    base: { context: string; weaponSet?: number }
  ): string => {
    const id = `${group.id}:${skill.id}`;
    const owned: SkillDamageState | null = app.profession.ui.skillDamageState(
      {
        ...context,
        weapons:
          base.weaponSet === 2 ? app.build.alternateWeapons : base.weaponSet === 1 ? app.build.weapons : context.weapons
      },
      skill
    );
    occurrences.push({
      id,
      effect: { kind: 'skill', id: skill.id },
      name: skill.name,
      source: 'Skill',
      icon: String(skill.icon ?? ''),
      unit: 'activation',
      inputs: owned?.inputs,
      assumptions: [...(owned?.assumptions ?? []), ...(base.weaponSet ? [`Weapon set ${base.weaponSet}`] : [])],
      cast: owned?.cast,
      config: {
        ...(base.weaponSet ? { startingWeaponSet: base.weaponSet } : {}),
        ...(owned?.initialResource != null ? { initialResource: owned.initialResource } : {}),
        ...(owned?.config ? { profession: owned.config } : {})
      },
      variants: owned?.variants,
      primaryVariantId: owned?.primaryVariantId
    });
    rows.set(id, {
      id,
      skillId: skill.id,
      name: skill.name,
      icon: String(skill.icon || ''),
      badge: slotBadge(skill),
      context: owned?.context ?? base.context,
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
        context: `${skill.type} · ${status === 'equipped' ? 'slotted' : 'not slotted'}`
      })
    );
    groups.push({ ...group, rowIds });
  }

  // Reuse the profession's action palette, including damage owned by dodge and swap actions.
  const actions = paletteActionSkills(buildStart(app)).filter((skill) => app.skillById.has(Number(skill.id)));
  const actionGroup = { id: 'action', title: 'Actions', kind: 'action' as const };
  const actionIds = actions
    .filter((skill) => ![...rows.values()].some((row) => row.skillId === skill.id))
    .map((skill) => addRow(actionGroup, skill, 'equipped', { context: skill.name }));
  if (actionIds.length) groups.push({ ...actionGroup, rowIds: actionIds });

  occurrences.push(...damageOccurrences(app.profession.runtimeFor(config), config));
  const request = { gameId: app.gameId, contentId: app.contentId, config, inputs, occurrences };
  return { groups, rows, request, signature: JSON.stringify(request) };
}
