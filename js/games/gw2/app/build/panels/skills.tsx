import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { gw2ApiText } from '#gw2/app/presentation/shared/html.js';
import { isSlotSkillSelectable } from '#gw2/app/build/state/skill-selection.js';
import { renderReact } from '#ui/react-root.js';
import { requiredElement } from '#ui/shared/dom.js';

import type {
  ProfessionSkillBarGroup,
  ProfessionSkillBarSelection,
  SchedulerRecord,
  Skill,
  SkillId
} from '#gw2/platform/engine/types.js';
import type {
  ProfessionAppState,
  ProfessionSlotLoadoutBar,
  ProfessionSlotLoadoutContext,
  ProfessionSlotLoadoutSelector
} from '#gw2/app/types.js';

const RANGER_BUILD_SELECTION_GROUP_IDS = new Set([
  'ranger-pet-1-selection',
  'ranger-pet-2-selection',
  'ranger-hammer-selection'
]);

const SELECTABLE_SLOTS: readonly (readonly [string, string])[] = [
  ['Heal', 'Heal'],
  ['Utility1', 'Utility'],
  ['Utility2', 'Utility'],
  ['Utility3', 'Utility'],
  ['Elite', 'Elite']
];

/** Retains only profession groups that change build state after removing mechanic previews. */
export function selectableSkillBarGroups(
  professionId: string,
  groups: readonly ProfessionSkillBarGroup[]
): ProfessionSkillBarGroup[] {
  return professionId === 'ranger'
    ? groups.filter((group) => RANGER_BUILD_SELECTION_GROUP_IDS.has(String(group.id)))
    : [];
}

/** Lists the legal, deduplicated choices for a heal, utility, or elite slot. */
export function availableSlotSkills(app: ProfessionAppState, type: string): Skill[] {
  const spec = app.adapter.eliteSpecialization(app.build);
  const byDisplayName = new Map<string, Skill>();
  for (const skill of app.skills) {
    if (
      skill.implemented === false ||
      skill.type !== type ||
      !isSlotSkillSelectable(app, skill, spec) ||
      (skill.specialization && skill.specialization !== spec) ||
      !app.adapter.isSkillAvailable(skill, {
        build: app.build,
        specialization: spec
      })
    ) {
      continue;
    }

    const displayName = String(skill.displayName || skill.name);
    if (!byDisplayName.has(displayName)) byDisplayName.set(displayName, skill);
  }

  return [...byDisplayName.values()];
}

/** Resolves the armed member of a selected skill's flip chain for display. */
export function skillBarDisplaySkill(
  app: ProfessionAppState,
  selected: Skill | null | undefined
): Skill | null | undefined {
  if (!selected) return selected;
  const professionState = app.results?.endState?.profession as SchedulerRecord | undefined;
  const availableFlips = professionState?.availableFlips;
  if (!availableFlips || typeof availableFlips !== 'object') return selected;
  const flips = availableFlips as Record<string, unknown>;
  const visited = new Set<number>();
  let current = selected;
  let display = selected;
  while (current.flipSkillId != null && !visited.has(Number(current.id))) {
    visited.add(Number(current.id));
    const flip = app.skillById.get(Number(current.flipSkillId));
    if (!flip || flip.flipParentId !== current.id) break;
    if (flips[flip.id] ?? flips[flip.name]) display = flip;
    current = flip;
  }

  return display;
}

export interface SkillBarInspectionStack {
  readonly root: Skill;
  readonly children: readonly Skill[];
}

/** Groups inspection skills into a root skill followed by its chain children. */
export function skillBarInspectionStacks(
  skills: readonly Skill[],
  inspectionChainRoots: Readonly<Record<string, SkillId>> = {}
): SkillBarInspectionStack[] {
  const visibleSkillIds = new Set(skills.map((skill) => Number(skill.id)));
  const childrenByRoot = new Map<number, Skill[]>();
  const childSkillIds = new Set<number>();

  for (const skill of skills) {
    const rootId = Number(inspectionChainRoots[String(skill.id)] ?? skill.chainRoot);
    if (!Number.isFinite(rootId) || rootId === Number(skill.id) || !visibleSkillIds.has(rootId)) {
      continue;
    }

    if (!childrenByRoot.has(rootId)) childrenByRoot.set(rootId, []);
    childrenByRoot.get(rootId)?.push(skill);
    childSkillIds.add(Number(skill.id));
  }

  return skills
    .filter((skill) => !childSkillIds.has(Number(skill.id)))
    .map((root) => ({
      root,
      children: (childrenByRoot.get(Number(root.id)) || []).sort(
        (left, right) =>
          Number(left.chainStep ?? Number.MAX_SAFE_INTEGER) - Number(right.chainStep ?? Number.MAX_SAFE_INTEGER)
      )
    }));
}

function onActivationKey(event: KeyboardEvent<HTMLElement>, activate: () => void): void {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  activate();
}

/** Renders one read-only skill icon inside a profession inspection group. */
function InspectionSkillSlot({ skill, child = false }: { readonly skill: Skill; readonly child?: boolean }) {
  return (
    <div className={`skill-bar-inspection-slot${child ? ' child-skill' : ''}`}>
      <div className="sbar-icon" title={`${skill.name}\n${gw2ApiText(skill.description)}`}>
        <img src={skill.icon || ''} alt="" />
      </div>
    </div>
  );
}

/** Renders root skills with any chained follow-up skills nested beneath them. */
function InspectionSkillStacks({
  skills,
  inspectionChainRoots
}: {
  readonly skills: readonly Skill[];
  readonly inspectionChainRoots?: Readonly<Record<string, SkillId>>;
}) {
  return skillBarInspectionStacks(skills, inspectionChainRoots).map(({ root, children }) => (
    <div className="skill-bar-inspection-skill-stack" key={root.id ?? root.name}>
      <InspectionSkillSlot skill={root} />
      {children.map((child) => (
        <div className="skill-bar-inspection-chain-step" key={child.id ?? child.name}>
          <span className="weapon-chain-arrow" aria-hidden="true">
            ↳
          </span>
          <InspectionSkillSlot skill={child} child />
        </div>
      ))}
    </div>
  ));
}

interface InspectionSelectionProps {
  readonly app: ProfessionAppState;
  readonly menuId: string;
  readonly openMenu: string | null;
  readonly selection: ProfessionSkillBarSelection;
  readonly setOpenMenu: (id: string | null) => void;
  readonly specialization: string;
}

/** Keeps profession selection filtering local while committing the chosen value through its existing UI contract. */
function InspectionSelection({
  app,
  menuId,
  openMenu,
  selection,
  setOpenMenu,
  specialization
}: InspectionSelectionProps) {
  const [query, setQuery] = useState('');
  const filterInput = useRef<HTMLInputElement>(null);
  const optionSkills = (selection.optionSkillIds || [])
    .map((id) => app.skillById.get(Number(id)))
    .filter((skill): skill is Skill => skill != null);
  const options = selection.optionEntries?.length
    ? selection.optionEntries
    : optionSkills.map((skill) => ({
        value: String(skill.id),
        label: skill.name,
        icon: skill.icon,
        description: skill.description,
        skillId: skill.id
      }));
  const selectedEntry = selection.optionEntries?.find(
    (entry) => String(entry.value) === String(selection.selectionValue)
  );
  const selectedSkill = app.skillById.get(Number(selection.skillId));
  const leadingSkills = (selection.leadingSkillIds || [])
    .map((id) => app.skillById.get(Number(id)))
    .filter((skill): skill is Skill => skill != null);
  const associatedSkills = (selection.skillIds || [])
    .map((id) => app.skillById.get(Number(id)))
    .filter((skill): skill is Skill => skill != null);
  const display = selectedEntry
    ? { name: selectedEntry.label, icon: selectedEntry.icon, description: selectedEntry.description }
    : selectedSkill;
  const labeled = Boolean(selection.keyLabel || selection.typeLabel);
  const open = openMenu === menuId;

  useEffect(() => {
    if (!open || !selection.filterPlaceholder) return;
    setQuery('');
    requestAnimationFrame(() => filterInput.current?.focus());
  }, [open, selection.filterPlaceholder]);

  if (!display || !options.length) return null;
  const selectOption = (option: (typeof options)[number]): void => {
    const skillId = Number(option.skillId);
    if (option.skillId != null && !Number.isFinite(skillId)) return;

    if (app.profession.ui.updateSkillBarSelection) {
      app.profession.ui.updateSkillBarSelection(
        {
          build: app.build,
          specialization,
          professionState: app.results?.endState?.profession,
          catalog: app.activeCatalog
        },
        {
          key: selection.selectionKey,
          index: selection.selectionIndex,
          ...(option.skillId == null ? {} : { skillId }),
          value: option.value
        }
      );
    } else if (option.skillId != null) {
      const currentValues = app.build[selection.selectionKey];
      const values = Array.isArray(currentValues) ? [...currentValues] : [];
      values[selection.selectionIndex] = skillId;
      app.build[selection.selectionKey] = values;
    }

    setOpenMenu(null);
    app.changed();
  };

  const slot = (
    <div
      className={`skill-bar-inspection-slot selectable${labeled ? ' labeled-skill-bar-slot' : ''}`}
      data-selection-key={selection.selectionKey}
      data-selection-index={selection.selectionIndex}
    >
      <div
        className="sbar-icon"
        title={`${display.name}\n${gw2ApiText(display.description)}`}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpenMenu(open ? null : menuId);
        }}
        onKeyDown={(event) => onActivationKey(event, () => setOpenMenu(open ? null : menuId))}
      >
        <img src={display.icon || ''} alt="" />
        {labeled ? (
          <span className="sbar-icon-arrow" aria-hidden="true">
            ▼
          </span>
        ) : null}
      </div>
      {selection.keyLabel ? <span className="skill-bar-key">{selection.keyLabel}</span> : null}
      {selection.typeLabel ? <span className="skill-bar-type">{selection.typeLabel}</span> : null}
      <div className="sbar-arrow">▼</div>
      <div className={`sbar-dropdown${open ? ' open' : ''}`}>
        {selection.filterPlaceholder ? (
          <input
            ref={filterInput}
            className="sbar-dropdown-filter"
            type="search"
            placeholder={selection.filterPlaceholder}
            aria-label={selection.filterPlaceholder}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.stopPropagation();
              setOpenMenu(null);
              event.currentTarget.blur();
            }}
          />
        ) : null}
        {options.map((option) => {
          const visible = option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
          return (
            <div
              className="dd-item"
              data-selection-value={option.value}
              data-skill-id={option.skillId}
              key={option.value}
              hidden={!visible}
              role="option"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                selectOption(option);
              }}
              onKeyDown={(event) => onActivationKey(event, () => selectOption(option))}
            >
              <img src={option.icon || ''} alt="" />
              <span>{option.label}</span>
            </div>
          );
        })}
        {selection.filterPlaceholder &&
        !options.some((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ? (
          <div className="dd-empty sbar-dropdown-filter-empty">No matching options</div>
        ) : null}
      </div>
    </div>
  );

  return leadingSkills.length || associatedSkills.length ? (
    <div className="skill-bar-inspection-selection">
      <InspectionSkillStacks skills={leadingSkills} />
      {slot}
      <InspectionSkillStacks skills={associatedSkills} />
    </div>
  ) : (
    slot
  );
}

/** Renders one profession group containing its build-selectable and read-only skills. */
function InspectionGroup({
  app,
  group,
  openMenu,
  setOpenMenu,
  specialization
}: {
  readonly app: ProfessionAppState;
  readonly group: ProfessionSkillBarGroup;
  readonly openMenu: string | null;
  readonly setOpenMenu: (id: string | null) => void;
  readonly specialization: string;
}) {
  const skills = group.skillIds
    .map((id) => app.skillById.get(Number(id)))
    .filter((skill): skill is Skill => skill != null);
  const style = { '--inspection-color': group.color || 'var(--accent)' } as CSSProperties;

  return (
    <div className={`skill-bar-inspection-group${group.className ? ` ${group.className}` : ''}`} style={style}>
      <span className="skill-bar-inspection-label">{group.label}</span>
      <div className="skill-bar-inspection-skills">
        {(group.selections || []).map((selection) => (
          <InspectionSelection
            app={app}
            menuId={`inspection:${selection.selectionKey}:${selection.selectionIndex}`}
            openMenu={openMenu}
            selection={selection}
            setOpenMenu={setOpenMenu}
            specialization={specialization}
            key={`${selection.selectionKey}:${selection.selectionIndex}`}
          />
        ))}
        <InspectionSkillStacks skills={skills} inspectionChainRoots={group.inspectionChainRoots} />
      </div>
    </div>
  );
}

/** Renders one standard heal, utility, or elite choice without rebuilding sibling slots. */
function SelectableSkillSlot({
  app,
  openMenu,
  setOpenMenu,
  slotKey,
  type
}: {
  readonly app: ProfessionAppState;
  readonly openMenu: string | null;
  readonly setOpenMenu: (id: string | null) => void;
  readonly slotKey: string;
  readonly type: string;
}) {
  const menuId = `skill:${slotKey}`;
  const open = openMenu === menuId;
  const current = app.skillByName.get(app.build.selectedSkills[slotKey]);
  const display = skillBarDisplaySkill(app, current);

  return (
    <div
      className={`skill-bar-slot ${type === 'Heal' ? 'heal-border' : type === 'Elite' ? 'elite-border' : ''}`}
      data-key={slotKey}
    >
      <div
        className="sbar-icon"
        title={String(display?.displayName || display?.name || 'Choose skill')}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpenMenu(open ? null : menuId);
        }}
        onKeyDown={(event) => onActivationKey(event, () => setOpenMenu(open ? null : menuId))}
      >
        <img src={display?.icon || ''} alt="" />
        <span className="sbar-icon-arrow" aria-hidden="true">
          ▼
        </span>
      </div>
      <div className="sbar-arrow">▼</div>
      <div className={`sbar-dropdown${open ? ' open' : ''}`} role="listbox">
        {availableSlotSkills(app, type).map((skill) => (
          <div
            className="dd-item"
            data-name={skill.name}
            key={skill.id ?? skill.name}
            role="option"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              app.build.selectedSkills[slotKey] = skill.name;
              setOpenMenu(null);
              app.changed();
            }}
            onKeyDown={(event) =>
              onActivationKey(event, () => {
                app.build.selectedSkills[slotKey] = skill.name;
                setOpenMenu(null);
                app.changed();
              })
            }
          >
            <img src={skill.icon} alt="" />
            <span>{String(skill.displayName || skill.name)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FixedSkillSlot({ skill, index, child = false }: { skill: Skill; index: number; child?: boolean }) {
  return (
    <div
      className={`skill-bar-slot fixed-loadout-skill${child ? ' child-skill' : ''}${
        !child && index === 0 ? ' heal-border' : ''
      }${!child && index === 4 ? ' elite-border' : ''}`}
    >
      <div className="sbar-icon" title={`${skill.name}\n${gw2ApiText(skill.description)}`}>
        <img src={skill.icon || ''} alt="" />
      </div>
    </div>
  );
}

function FixedSkillStack({
  app,
  context,
  index,
  skill
}: {
  app: ProfessionAppState;
  context: ProfessionSlotLoadoutContext;
  index: number;
  skill: Skill;
}) {
  const loadout = app.adapter.slotLoadout;
  const children = (loadout?.skillChildren?.(context, skill.id) || [])
    .map((id) => app.skillById.get(Number(id)))
    .filter((child): child is Skill => child != null);

  return (
    <div className="fixed-loadout-skill-stack">
      <FixedSkillSlot skill={skill} index={index} />
      {children.map((child) => (
        <div className="fixed-loadout-chain-step" key={child.id ?? child.name}>
          <span className="weapon-chain-arrow" aria-hidden="true">
            ↳
          </span>
          <FixedSkillSlot skill={child} index={index} child />
        </div>
      ))}
    </div>
  );
}

function FixedLoadoutBar({
  app,
  bar,
  context,
  formatActiveBar
}: {
  app: ProfessionAppState;
  bar: ProfessionSlotLoadoutBar;
  context: ProfessionSlotLoadoutContext;
  formatActiveBar: boolean;
}) {
  const skills = bar.skillIds
    .map((id) => app.skillById.get(Number(id)))
    .filter((skill): skill is Skill => skill != null);

  return (
    <div
      className={`fixed-loadout-bar skill-bar-selected${
        formatActiveBar ? (bar.active ? ' active' : ' inactive') : ' static'
      }`}
    >
      {skills.map((skill, index) => (
        <FixedSkillStack app={app} context={context} index={index} skill={skill} key={skill.id ?? skill.name} />
      ))}
    </div>
  );
}

interface FixedLoadoutSelectorProps {
  readonly app: ProfessionAppState;
  readonly context: ProfessionSlotLoadoutContext;
  readonly iconMode: boolean;
  readonly index: number;
  readonly openMenu: string | null;
  readonly selector: ProfessionSlotLoadoutSelector;
  readonly setOpenMenu: (id: string | null) => void;
}

function FixedLoadoutSelector({
  app,
  context,
  iconMode,
  index,
  openMenu,
  selector,
  setOpenMenu
}: FixedLoadoutSelectorProps) {
  const loadout = app.adapter.slotLoadout;
  const update = (value: string): void => {
    if (!loadout) return;
    loadout.updateBuild(app.build, selector.key, value, context);
    setOpenMenu(null);
    app.changed();
  };

  if (!iconMode) {
    return (
      <label>
        <span>{selector.label}</span>
        <select className="gear-select" value={selector.value} onChange={(event) => update(event.currentTarget.value)}>
          {selector.options.map((entry) => (
            <option value={entry.value} disabled={entry.disabled} key={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const menuId = `loadout:${index}`;
  const open = openMenu === menuId;
  const selected = selector.options.find((entry) => entry.value === selector.value);
  return (
    <div className="skill-bar-slot fixed-loadout-icon-selector">
      <button
        type="button"
        className="fixed-loadout-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`fixed-loadout-menu-${index}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpenMenu(open ? null : menuId);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpenMenu(null);
        }}
      >
        <img src={selected?.icon || ''} alt="" />
        <span className="fixed-loadout-trigger-copy">
          <strong>{selected?.label || 'Choose loadout'}</strong>
          <small>Change {selector.label.toLowerCase()}</small>
        </span>
        <span className="fixed-loadout-trigger-arrow" aria-hidden="true">
          ▼
        </span>
      </button>
      <div
        id={`fixed-loadout-menu-${index}`}
        className={`sbar-dropdown fixed-loadout-dropdown${open ? ' open' : ''}`}
        role="listbox"
      >
        {selector.options.map((entry) => (
          <button
            type="button"
            className={`dd-item fixed-loadout-option${entry.value === selector.value ? ' selected' : ''}`}
            data-loadout-key={selector.key}
            data-loadout-value={entry.value}
            role="option"
            aria-selected={entry.value === selector.value}
            disabled={entry.disabled}
            key={entry.value}
            onClick={(event) => {
              event.stopPropagation();
              update(entry.value);
            }}
          >
            <img src={entry.icon || ''} alt="" />
            <span>{entry.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Renders profession-defined fixed slot bars and their loadout selectors. */
function FixedSlotLoadout({
  app,
  openMenu,
  setOpenMenu,
  specialization
}: {
  app: ProfessionAppState;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  specialization: string;
}) {
  const loadout = app.adapter.slotLoadout;
  if (!loadout) return null;
  const context: ProfessionSlotLoadoutContext = {
    build: app.build,
    specialization,
    professionState: app.results?.endState?.profession,
    catalog: app.activeCatalog
  };
  const view = loadout.view(context);
  const iconMode = view.selectionControl === 'icons';
  const paired = iconMode && view.selectors.length === view.bars.length;

  if (paired) {
    return (
      <div className="fixed-loadout-pairs">
        {view.selectors.map((selector, index) => (
          <div className="fixed-loadout-pair" key={selector.key}>
            <FixedLoadoutSelector
              app={app}
              context={context}
              iconMode
              index={index}
              openMenu={openMenu}
              selector={selector}
              setOpenMenu={setOpenMenu}
            />
            <FixedLoadoutBar
              app={app}
              bar={view.bars[index]}
              context={context}
              formatActiveBar={view.formatActiveBar}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="fixed-loadout-selectors">
        {view.selectors.map((selector, index) => (
          <FixedLoadoutSelector
            app={app}
            context={context}
            iconMode={iconMode}
            index={index}
            openMenu={openMenu}
            selector={selector}
            setOpenMenu={setOpenMenu}
            key={selector.key}
          />
        ))}
      </div>
      {view.bars.map((bar) => (
        <FixedLoadoutBar
          app={app}
          bar={bar}
          context={context}
          formatActiveBar={view.formatActiveBar}
          key={bar.id}
        />
      ))}
    </>
  );
}

/** Owns dropdown state so outside clicks close menus without imperative mutations inside the React root. */
function SkillsPanel({
  app,
  inspectionGroups,
  specialization
}: {
  readonly app: ProfessionAppState;
  readonly inspectionGroups: readonly ProfessionSkillBarGroup[];
  readonly specialization: string;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const closeOutside = (event: MouseEvent): void => {
      if (event.target instanceof Element && !event.target.closest('#skill-bar')) setOpenMenu(null);
    };

    document.addEventListener('click', closeOutside);
    return () => document.removeEventListener('click', closeOutside);
  }, []);

  if (app.adapter.slotLoadout) {
    return (
      <FixedSlotLoadout
        app={app}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        specialization={specialization}
      />
    );
  }

  const inspectionLayout = inspectionGroups.find((group) => group.layout)?.layout || '';
  return (
    <>
      <div className="skill-bar-selected">
        {SELECTABLE_SLOTS.map(([slotKey, type]) => (
          <SelectableSkillSlot
            app={app}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            slotKey={slotKey}
            type={type}
            key={slotKey}
          />
        ))}
      </div>
      {inspectionGroups.length ? (
        <section className="ranger-build-selections">
          <div
            className={`skill-bar-inspection${inspectionLayout ? ` ${inspectionLayout}` : ''}`}
            data-layout={inspectionLayout || undefined}
          >
            {inspectionGroups.map((group) => (
              <InspectionGroup
                app={app}
                group={group}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                specialization={specialization}
                key={String(group.id ?? group.label)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Retains the build-editor entry point while making React the sole owner of skill-bar descendants. */
export function renderSkills(app: ProfessionAppState): void {
  const specialization = app.adapter.eliteSpecialization(app.build);
  const context = {
    build: app.build,
    specialization,
    catalog: app.activeCatalog,
    professionState: app.results?.endState?.profession,
    traits: new Set((app.attributeData?.activeTraits || []).flatMap((trait) => [trait.id, trait.name]))
  };
  const inspectionGroups = app.adapter.slotLoadout
    ? []
    : selectableSkillBarGroups(app.profession.id, app.profession.ui.skillBarGroups?.(context) || []);
  const skillBar = requiredElement('skill-bar');
  skillBar.classList.toggle('has-inspection', inspectionGroups.length > 0);
  renderReact(
    skillBar,
    <SkillsPanel app={app} inspectionGroups={inspectionGroups} specialization={specialization} />
  );
}
