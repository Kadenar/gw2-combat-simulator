/**
 * Renders and binds the rotation builder's skill palette.
 *
 * Palette models supply the standard skill rows, while profession UI contracts
 * can project groups, controls, actions, and custom weapon layouts. This module
 * combines those declarations with the latest simulation state to resolve
 * cooldowns, ammo, flips, ambushes, autoattack chains, and availability, then
 * delegates DOM ownership and pointer handling to React components.
 *
 * The palette is rebuilt after application changes; event handlers therefore
 * read current build and result state instead of retaining DOM-local state.
 */
import { ammoDisplayView } from '#ui/rotation/ammo-display.js';
import { useState } from 'react';
import type { CSSProperties, DragEvent, MouseEvent, ReactNode } from 'react';
import { renderReact } from '#ui/react-root.js';
import {
  activationDamageCommitMs,
  openActivationEditor
} from '#gw2/app/presentation/rotation/editors/activation-editor.js';
import { openDurationEditor } from '#ui/rotation/editors/duration-editor.js';
import { rotationEntryName } from '#gw2/app/presentation/rotation/timeline.js';
import { gw2ApiText } from '#gw2/app/presentation/shared/html.js';
import { createRotationItem, insertRotationItems } from '#gw2/app/rotation/editing/actions.js';
import { openDragonSlashReleaseEditor } from '#gw2/app/rotation/editing/charge-release.js';
import { hasConfigurableDoubleEdgeOutcome, openDoubleEdgeEditor } from '#gw2/app/rotation/editing/double-edge.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';
import {
  rotationHotkeyActionForSkillName,
  rotationHotkeyActionForSkillSlot,
  formatRotationHotkey,
  formatRotationHotkeyBadge,
  loadRotationHotkeyBindings,
  loadRotationHotkeysEnabled,
  mountRotationHotkeys,
  rotationLoadoutHotkeyActions,
  rotationUtilityHotkeyAction
} from '#gw2/app/rotation/input/hotkeys.js';
import type { RotationHotkeyAction, RotationHotkeyBindings } from '#gw2/app/rotation/input/hotkeys.js';
import {
  activeSpecialization,
  paletteEndState,
  paletteProfessionState,
  seconds
} from '#gw2/app/rotation/shared/context.js';
import {
  ACTION_ICONS,
  COMBAT_START_ICON,
  COOLDOWN_RESET_ICON,
  PLACEHOLDER_ICON,
  WAIT_ICON
} from '#gw2/app/rotation/shared/icons.js';
import {
  currentAutoattackSkill,
  displayedSkillTiles,
  displayedWeaponSkills,
  paletteActionSkills,
  paletteSkillIsInstant,
  rotationLoadoutPaletteGroups,
  rotationPaletteGroups,
  rotationSelectedSlotSkills,
  uniqueByName,
  weaponPaletteRows,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';
import {
  ActiveResourceGroup,
  activeResourceDefinitions,
  paletteSkillResourceView
} from '#gw2/app/rotation/palette/resource-view.js';
import type {
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionPaletteSkillRenderOptions,
  ProfessionWeaponPaletteRow,
  ProfessionWeaponPaletteView,
  RotationCommand,
  SchedulerRecord,
  Skill
} from '#gw2/platform/engine/types.js';
import type {
  AmmoView,
  PaletteControlView,
  PaletteGroupView,
  PaletteSkillView
} from '#gw2/app/presentation/rotation/palette.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

const CONCURRENT_OFFSET_MS = 120;

type RenderedPaletteGroup = ProfessionPaletteGroup & { skills: Skill[] };

interface PaletteHandlers {
  readonly onActivate: (view: PaletteSkillView, event: MouseEvent<HTMLElement>) => void;
  readonly onControlActivate: (id: string) => void;
  readonly onDragStart: (view: PaletteSkillView, event: DragEvent<HTMLElement>) => void;
  readonly onDragEnd: () => void;
  readonly hotkeyBindings: RotationHotkeyBindings;
  readonly hotkeysEnabled: boolean;
  readonly registerHotkey: (view: PaletteSkillView, element: HTMLElement | null) => void;
}

function normalizedAmmo(ammo: AmmoView | null | undefined) {
  if (!ammo) return null;
  const maximum = Math.max(0, Number(ammo.maximum || 0));
  const current = Math.max(0, Math.min(maximum, Number(ammo.current || 0)));
  return {
    current,
    maximum,
    pips: Array.isArray(ammo.pips) ? ammo.pips : Array.from({ length: maximum }, (_, index) => index < current)
  };
}

function PaletteSkill({ view, handlers }: { readonly view: PaletteSkillView; readonly handlers: PaletteHandlers }) {
  const ammo = normalizedAmmo(view.ammo);
  const resource = view.resource;
  const disabled = Boolean(view.disabled);
  const contextDisabled = Boolean(view.contextDisabled);
  const draggable = Boolean(view.draggable ?? view.virtual) && !disabled && !contextDisabled;
  const classes = [
    'pal-skill',
    disabled ? 'pal-disabled' : '',
    contextDisabled ? 'pal-context-disabled' : '',
    view.concealed ? 'pal-concealed' : '',
    view.highlighted ? 'pal-ambush-active' : '',
    ammo ? 'pal-has-ammo' : '',
    ammo && ammo.current > 0 ? 'pal-ammo-available' : '',
    resource ? 'pal-has-resource' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const resourceMaximum = Math.max(0, Number(resource?.maximum || 0));
  const resourceValue = Math.max(0, Math.min(resourceMaximum, Number(resource?.value || 0)));
  const hotkeyAction = String(view.hotkeyAction || '') as RotationHotkeyAction;
  const hotkeyCode = handlers.hotkeysEnabled && hotkeyAction ? handlers.hotkeyBindings[hotkeyAction] : '';
  return (
    <div
      ref={(element) => handlers.registerHotkey(view, element)}
      className={classes}
      data-skill={view.name || ''}
      data-skill-id={view.skillId == null ? undefined : String(view.skillId)}
      data-hotkey-action={view.hotkeyAction || undefined}
      title={String(view.title || view.name || '')}
      draggable={draggable}
      aria-label={ammo ? `${String(view.name || '')}: ${ammo.current}/${ammo.maximum} charges` : undefined}
      aria-keyshortcuts={hotkeyCode ? formatRotationHotkey(hotkeyCode) : undefined}
      style={{ '--att-border': String(view.color || (view.virtual ? '#8d7a57' : '#a88be8')) } as CSSProperties}
      onClick={(event) => {
        if (!contextDisabled) handlers.onActivate(view, event);
      }}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }

        event.currentTarget.classList.add('dragging');
        event.dataTransfer.setData('text/plain', String(view.name || ''));
        event.dataTransfer.effectAllowed = 'copy';
        handlers.onDragStart(view, event);
      }}
      onDragEnd={(event) => {
        event.currentTarget.classList.remove('dragging');
        handlers.onDragEnd();
      }}
    >
      <img src={String(view.icon || PLACEHOLDER_ICON)} alt='' />
      {hotkeyCode ? (
        <span className='pal-hotkey' aria-hidden='true'>
          {formatRotationHotkeyBadge(hotkeyCode)}
        </span>
      ) : null}
      {view.variantBadge ? <span className='skill-variant-badge pal-variant-badge'>{view.variantBadge}</span> : null}
      {view.cooldownLabel ? <span className='pal-cd'>{view.cooldownLabel}</span> : null}
      {ammo ? (
        <>
          <span className='pal-charges'>
            {ammo.current}/{ammo.maximum}
          </span>
          <span className='pal-ammo-pips' aria-hidden='true'>
            {ammo.pips.map((filled, index) => (
              <span key={index} className={`pal-ammo-pip${filled ? ' filled' : ''}`} />
            ))}
          </span>
        </>
      ) : null}
      {resource ? (
        <>
          <span
            className='pal-skill-resource'
            data-resource-id={resource.id}
            role='progressbar'
            aria-label={resource.label}
            aria-valuemin={0}
            aria-valuemax={resourceMaximum}
            aria-valuenow={resourceValue}
          >
            <span style={{ width: `${resourceMaximum ? (resourceValue / resourceMaximum) * 100 : 0}%` }} />
          </span>
          <span className='pal-skill-resource-value' data-resource-id={resource.id} aria-hidden='true'>
            {Math.round(resourceValue)}/{resourceMaximum}
          </span>
        </>
      ) : null}
    </div>
  );
}

function PaletteControl({ view, handlers }: { readonly view: PaletteControlView; readonly handlers: PaletteHandlers }) {
  const classes = [
    'pal-control',
    view.className || '',
    view.active ? 'pal-control-active' : '',
    view.pressed ? 'pal-control-pressed' : '',
    view.muted ? 'pal-control-muted' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const title = view.title || view.label || view.id;
  return (
    <button
      type='button'
      className={classes}
      data-palette-control-id={view.id}
      aria-pressed={Boolean(view.pressed)}
      aria-label={title}
      title={title}
      style={{ '--att-border': view.color || '#a88be8' } as CSSProperties}
      onClick={() => handlers.onControlActivate(view.id)}
    >
      <img src={view.icon || PLACEHOLDER_ICON} alt='' />
      {view.badge ? (
        <span className='pal-control-badge' aria-hidden='true'>
          {view.badge}
        </span>
      ) : null}
    </button>
  );
}

function PaletteGroup({ view, handlers }: { readonly view: PaletteGroupView; readonly handlers: PaletteHandlers }) {
  if (!view.skills?.length && !view.controls?.length && !view.statusIcon) return null;
  return (
    <div className={`pal-group${view.className ? ` ${view.className}` : ''}`} data-palette-group={view.id || undefined}>
      <div className='pal-label' style={{ color: view.color || '#a88be8' }}>
        {view.label}
      </div>
      <div className='pal-row'>
        {view.statusIcon ? (
          <div
            className='pal-status-icon'
            title={view.statusIcon.title || view.statusIcon.label}
            aria-label={view.statusIcon.label}
          >
            <img src={view.statusIcon.icon || PLACEHOLDER_ICON} alt={view.statusIcon.label} />
          </div>
        ) : null}
        {view.controls?.map((control) => (
          <PaletteControl key={control.id} view={control} handlers={handlers} />
        ))}
        {view.skills?.map((skill, index) => (
          <PaletteSkill key={`${String(skill.skillId ?? skill.name)}:${index}`} view={skill} handlers={handlers} />
        ))}
      </div>
    </div>
  );
}

type PaletteSkillProjector = (skill: Skill, options?: ProfessionPaletteSkillRenderOptions) => PaletteSkillView;

function compactVariantBadge(label: unknown): string {
  return String(label || '')
    .split('+')
    .filter(Boolean)
    .map((element) => element[0])
    .join('/');
}

function CustomWeaponSkillCell({
  skill,
  project,
  handlers,
  badge = false,
  equipped = false,
  staticCooldown = false
}: {
  readonly skill: Skill;
  readonly project: PaletteSkillProjector;
  readonly handlers: PaletteHandlers;
  readonly badge?: boolean;
  readonly equipped?: boolean;
  readonly staticCooldown?: boolean;
}) {
  const projected = { ...skill, variantBadge: badge ? compactVariantBadge(skill.variantBadge) : undefined };
  const view = project(
    projected,
    staticCooldown
      ? { contextAvailable: true, contextMessage: '', view: { draggable: false, hotkeyAction: '' } }
      : undefined
  );
  return (
    <div
      className={`custom-weapon-skill-cell${!staticCooldown && (equipped || !view.disabled) ? ' is-equipped' : ''}${
        staticCooldown ? ' is-static' : ''
      }`}
      data-variant={String(skill.variantBadge || 'Special')}
      data-palette-static={staticCooldown ? 'true' : undefined}
    >
      <PaletteSkill view={view} handlers={handlers} />
    </div>
  );
}

function CustomWeaponRows({
  rows,
  selectedLabel,
  project,
  handlers
}: {
  readonly rows: readonly ProfessionWeaponPaletteRow[];
  readonly selectedLabel: string;
  readonly project: PaletteSkillProjector;
  readonly handlers: PaletteHandlers;
}) {
  return rows.map((row) =>
    row.skills.length ? (
      <div
        key={row.label}
        className={`custom-weapon-row${row.label === selectedLabel ? ' is-selected' : ''}`}
        data-variant={row.label}
      >
        <span className='custom-weapon-row-label'>{row.label}</span>
        <div className='custom-weapon-row-skills'>
          {row.skills.map((skill) => (
            <CustomWeaponSkillCell key={skill.id} skill={skill} project={project} handlers={handlers} staticCooldown />
          ))}
        </div>
      </div>
    ) : null
  );
}

/** Renders the current split weapon bar from profession-owned layout data. */
function CustomWeaponCurrentBar({
  view,
  project,
  handlers
}: {
  readonly view: ProfessionWeaponPaletteView;
  readonly project: PaletteSkillProjector;
  readonly handlers: PaletteHandlers;
}) {
  const cluster = (skills: readonly Skill[], slots: string, badge = false) => (
    <div className='custom-weapon-current-cluster' data-slots={slots}>
      {skills.map((skill) => (
        <CustomWeaponSkillCell
          key={skill.id}
          skill={skill}
          project={project}
          handlers={handlers}
          badge={badge}
          equipped
        />
      ))}
    </div>
  );
  return (
    <div
      className='custom-weapon-current-bar'
      data-role='custom-weapon-current-bar'
      aria-label={`Current weapon bar: ${view.primaryLabel} and ${view.secondaryLabel}`}
    >
      <div className='custom-weapon-current-caption'>
        <span>Current</span>
        <strong>
          {view.primaryLabel[0]}/{view.secondaryLabel[0]}
        </strong>
      </div>
      <div className='custom-weapon-current-composition'>
        {cluster(view.primarySkills, '1-2')}
        <span className='custom-weapon-current-divider' aria-hidden='true' />
        {cluster(view.slotThreeSkills, '3', true)}
        <span className='custom-weapon-current-divider' aria-hidden='true' />
        {cluster(view.secondarySkills, '4-5')}
      </div>
    </div>
  );
}

/** Renders a persisted cooldown inventory from profession-owned layout data. */
function CustomWeaponPalette({
  view,
  project,
  handlers
}: {
  readonly view: ProfessionWeaponPaletteView;
  readonly project: PaletteSkillProjector;
  readonly handlers: PaletteHandlers;
}) {
  const storageKey = view.storageKey;
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored == null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const slotThreeBank = (skills: readonly Skill[], variant: 'same' | 'mixed') => (
    <div className='custom-weapon-middle-row' data-variant-group={variant}>
      <span className='custom-weapon-middle-label'>{variant === 'same' ? 'Same' : 'Mixed'}</span>
      <div className='custom-weapon-middle-skills'>
        {skills.map((skill) => (
          <CustomWeaponSkillCell
            key={skill.id}
            skill={skill}
            project={project}
            handlers={handlers}
            badge
            staticCooldown
          />
        ))}
      </div>
    </div>
  );
  return (
    <details
      className='custom-weapon-palette'
      data-role='custom-weapon-palette'
      data-palette-storage-key={storageKey}
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          // Browser storage may be unavailable in private or embedded contexts.
        }
      }}
    >
      <summary className='custom-weapon-cooldown-toggle'>All weapon skill cooldowns</summary>
      <div className='custom-weapon-cooldown-bank' data-role='custom-weapon-cooldown-bank'>
        <section className='custom-weapon-cooldown-lane' data-role='custom-weapon-primary-bank'>
          <div className='custom-weapon-bank-title'>
            Slots 1-2 <span>Primary</span>
          </div>
          <CustomWeaponRows
            rows={view.primaryRows}
            selectedLabel={view.primaryLabel}
            project={project}
            handlers={handlers}
          />
        </section>
        <section
          className='custom-weapon-cooldown-lane custom-weapon-middle-bank'
          data-role='custom-weapon-middle-bank'
        >
          <div className='custom-weapon-bank-title'>
            Slot 3 <span>Same / mixed</span>
          </div>
          {slotThreeBank(view.sameMiddleSkills, 'same')}
          {slotThreeBank(view.mixedMiddleSkills, 'mixed')}
        </section>
        <section className='custom-weapon-cooldown-lane' data-role='custom-weapon-secondary-bank'>
          <div className='custom-weapon-bank-title'>
            Slots 4-5 <span>Secondary</span>
          </div>
          <CustomWeaponRows
            rows={view.secondaryRows}
            selectedLabel={view.secondaryLabel}
            project={project}
            handlers={handlers}
          />
        </section>
      </div>
      {view.extraSkills.length ? (
        <div className='custom-weapon-extra-bank' data-role='custom-weapon-extra-bank'>
          <span className='custom-weapon-bank-title'>Other weapon skills</span>
          <div className='custom-weapon-row-skills'>
            {view.extraSkills.map((skill) => (
              <CustomWeaponSkillCell key={skill.id} skill={skill} project={project} handlers={handlers} />
            ))}
          </div>
        </div>
      ) : null}
    </details>
  );
}

/** Defaults palette interruption to the skill's commit point, or its normal cast time when none is declared. */
export function defaultPaletteInterruptMs(skill: Skill | null | undefined): number {
  return Math.round(Number(skill?.interruptCommitMs ?? skill?.castTimeMs ?? 0));
}

/**
 * Builds fresh action context for clicks and drops, which may occur after the
 * palette markup was produced from an earlier simulation result.
 */
function paletteActionContext(app: ProfessionAppState): SchedulerRecord {
  const endState = paletteEndState(app);
  return {
    specialization: activeSpecialization(app),
    catalog: app.activeCatalog,
    professionState: paletteProfessionState(app),
    cooldowns: endState?.cooldowns || {},
    activeWeaponSet: endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
    time: Number(endState?.time || 0) / 1000,
    build: app.build,
    activeAutoattack: currentAutoattackSkill(app)
  };
}

function resolveProfessionPaletteAction(
  app: ProfessionAppState,
  name: string,
  skillId: number | null
): RotationCommand | RotationCommand[] | null | undefined {
  const resolveAction = app.profession.ui?.resolvePaletteAction;
  return typeof resolveAction === 'function' ? resolveAction(paletteActionContext(app), { name, skillId }) : undefined;
}

/**
 * Converts a dragged palette identity into one or more rotation entries.
 * Returns `null` for waits that require editor input, empty names, and duplicate
 * combat-start markers. Profession-owned actions resolve through their UI
 * contract before ordinary skills are converted; composite actions may return
 * multiple items.
 */
export function resolvePaletteDropItem(
  app: ProfessionAppState,
  name: string,
  skillId: number | null = null
): RotationCommand | RotationCommand[] | null {
  if (!name) return null;
  const professionAction = resolveProfessionPaletteAction(app, name, skillId);
  if (professionAction !== undefined) return professionAction;
  if (name === '__combat_start' && app.build.rotation.some((entry) => rotationEntryName(entry) === '__combat_start')) {
    return null;
  }

  if (name === '__wait') return null;
  return createRotationItem(app, name, skillId == null ? {} : { skillId });
}

function currentCooldown(
  app: ProfessionAppState,
  name: string
): { readonly remaining: number; readonly readyAt: number } {
  return paletteEndState(app)?.cooldowns?.[name] || { remaining: 0, readyAt: 0 };
}

function currentAmmo(app: ProfessionAppState, skill: Skill): SchedulerRecord | null {
  const endState = paletteEndState(app);
  const ammoBySkillId = endState?.ammoBySkillId;
  // Prefer exact IDs so duplicate API names cannot leak another variant's ammo into this skill.
  const rawAmmo =
    ammoBySkillId && typeof ammoBySkillId === 'object' ? ammoBySkillId[String(skill.id)] : endState?.ammo?.[skill.name];
  if (!rawAmmo || typeof rawAmmo !== 'object') return null;
  const ammo = rawAmmo as SchedulerRecord;
  if (ammo.remaining != null) return ammo;
  // Scheduler ammo uses `nextRechargeAt` in seconds, while UI projections may
  // already expose `nextChargeAt` in milliseconds. Normalize both to UI time.
  const nextChargeAt =
    ammo.nextChargeAt != null
      ? Number(ammo.nextChargeAt)
      : ammo.nextRechargeAt == null
        ? 0
        : Number(ammo.nextRechargeAt) * 1000;
  return {
    ...ammo,
    nextChargeAt,
    remaining: nextChargeAt ? Math.max(0, nextChargeAt - Number(endState?.time || 0)) : 0
  };
}

/** Adapts resolved skills and optional controls to the shared React group view. */
function addGroup(
  app: ProfessionAppState,
  label: string,
  skills: readonly Skill[],
  color = '#a88be8',
  isAvailable: (skill: Skill) => boolean = () => true,
  unavailableMessage: (skill: Skill) => string = () => '',
  className = '',
  statusIcon?: ProfessionPaletteGroup['statusIcon'],
  controls: ProfessionPaletteGroup['controls'] = [],
  id = '',
  retryAt: (skill: Skill) => number | null = () => null
): PaletteGroupView | null {
  if (!skills.length && !controls.length && !statusIcon) return null;
  return {
    id,
    label,
    color,
    className,
    statusIcon,
    controls,
    skills: skills.map((skill) =>
      paletteSkillView(app, skill, isAvailable(skill), unavailableMessage(skill), retryAt(skill))
    )
  };
}

/**
 * Projects a skill and the latest simulation state into generic palette UI.
 * `contextAvailable` is the caller's combined state/placement decision;
 * cooldown and ammo state are derived here so styling, dragging, and tooltips
 * share one decision.
 */
export function paletteSkillView(
  app: ProfessionAppState,
  skill: Skill,
  contextAvailable = true,
  contextMessage = '',
  contextRetryAt: number | null = null
): PaletteSkillView {
  const displayName = skill.displayName || skill.name;
  const cd = currentCooldown(app, skill.name);
  const endTime = Number(paletteEndState(app)?.time || 0);
  const contextReadyAt = Number(contextRetryAt) * 1000;
  const contextRemaining = Number.isFinite(contextReadyAt) ? Math.max(0, Math.round(contextReadyAt - endTime)) : 0;
  // A future retryAt is scheduler-queueable: keep the countdown styling, but
  // allow clicks so the inserted action can wait for the temporary lockout.
  const retryableContext =
    !contextAvailable && contextRetryAt != null && Number.isFinite(contextReadyAt) && contextReadyAt > endTime;
  // Context lockouts such as Tempest singularity share the cooldown badge;
  // show whichever restriction keeps the skill unavailable for longer.
  const remaining = Math.max(Number(cd.remaining || 0), contextRemaining);
  const readyAt = contextRemaining > Number(cd.remaining || 0) ? contextReadyAt : cd.readyAt;
  const ammo = currentAmmo(app, skill);
  const maximumAmmo = ammo?.maximum ?? Number(skill.ammo || 0);
  const recharge =
    maximumAmmo && Number(skill.ammoRecharge || 0) > 0 ? Number(skill.ammoRecharge) : Number(skill.cooldown || 0);
  const ammoDisplay = ammoDisplayView(ammo?.charges ?? maximumAmmo, maximumAmmo);
  // Keep the next recharge visible and use one hundredths-precision value for the badge and remaining tooltip.
  const cooldownLabel =
    ammo?.remaining || remaining ? `${(Number(ammo?.remaining || remaining) / 1000).toFixed(2)}s` : '';
  const unavailable = remaining > 0 || !contextAvailable;
  const highlighted = (Boolean(skill.ambush) || Boolean(skill.stealthAttack)) && !unavailable;
  const castTimeSeconds = Number(skill.castTimeMs || 0) / 1000;
  const hasEnergyCost = skill.energyCost != null;
  const energyCost = Number(skill.energyCost || 0);
  const title = [
    displayName,
    castTimeSeconds ? `Cast: ${castTimeSeconds.toFixed(2)}s` : 'Instant cast',
    hasEnergyCost ? `Energy cost: ${energyCost}` : '',
    recharge ? `${maximumAmmo ? 'Count recharge' : 'Cooldown'}: ${recharge}s` : '',
    !contextAvailable
      ? [contextMessage || 'Unavailable in the current state', remaining ? `Remaining: ${cooldownLabel}` : '']
          .filter(Boolean)
          .join(' · ')
      : ammoDisplay
        ? `${ammoDisplay.label}${ammo?.remaining ? ` · next charge in ${seconds(Number(ammo.remaining))}` : ''}`
        : remaining
          ? `Remaining: ${cooldownLabel} · available at ${seconds(readyAt)}`
          : 'Available now',
    gw2ApiText(skill.description)
  ]
    .filter(Boolean)
    .join('\n');
  return {
    name: skill.name,
    skillId: skill.id,
    hotkeyAction:
      String(skill.hotkeyAction || '') ||
      rotationHotkeyActionForSkillSlot(skill.slot) ||
      rotationHotkeyActionForSkillName(skill.name),
    icon: skill.icon || ACTION_ICONS[skill.name] || PLACEHOLDER_ICON,
    variantBadge: String(skill.variantBadge || ''),
    title,
    color: unavailable ? '#625a73' : highlighted ? '#f0c766' : '#a88be8',
    disabled: unavailable,
    contextDisabled: !contextAvailable && !retryableContext,
    concealed: Boolean(skill.concealed),
    highlighted,
    draggable: contextAvailable,
    cooldownLabel,
    ammo: ammoDisplay,
    resource: paletteSkillResourceView(app, skill.id)
  };
}

/**
 * Replaces the rotation palette markup and binds activation and drag behavior.
 *
 * The standard surface composes profession groups/resources, selected slot
 * skills, loadout groups, weapon rows/actions, and timeline controls. Profession
 * contracts may position individual groups or replace the weapon layout while
 * reusing the generic skill renderer. Activation also supports profession-owned
 * composite actions, Shift-click concurrent instants, and Ctrl-click interrupts.
 */
export function renderPalette(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-palette');
  if (!element) return;
  const spec = activeSpecialization(app);
  const endState = paletteEndState(app);
  const professionState = paletteProfessionState(app);
  const paletteContext = {
    specialization: spec,
    catalog: app.activeCatalog,
    professionState,
    cooldowns: endState?.cooldowns || {},
    activeWeaponSet: endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
    time: Number(endState?.time || 0) / 1000,
    build: app.build,
    // Expose resolved traits to profession palette contracts so replacement
    // skills appear only when the build actually selects their trait.
    traits: new Set((app.attributeData?.activeTraits || []).flatMap((trait) => [trait.id, trait.name]))
  };
  const professionGroups = rotationPaletteGroups(app, paletteContext);
  const loadoutGroups = rotationLoadoutPaletteGroups(app, paletteContext);
  const renderGroups = (groups: readonly ProfessionPaletteGroup[]): RenderedPaletteGroup[] =>
    groups.map((group) => {
      const skillIds = group.skillIds || [];
      const reservedSkillIds = group.reservedSkillIds || [];
      // Reserved IDs keep a group's declared positions stable while inactive
      // alternatives remain concealed rather than disappearing from the model.
      const skills = [
        ...(reservedSkillIds.length ? reservedSkillIds : skillIds).flatMap((id) => {
          const skill = app.skillById.get(id);
          return skill && (group.includeActionSkills || skill.type !== 'Action')
            ? [
                {
                  ...skill,
                  concealed: reservedSkillIds.length > 0 && !skillIds.includes(skill.id)
                }
              ]
            : [];
        }),
        ...(group.skillEntries || []).flatMap((entry) => {
          const skill = app.skillById.get(Number(entry.skillId));
          return skill && (group.includeActionSkills || skill.type !== 'Action')
            ? [{ ...skill, ...entry, name: skill.name } as Skill]
            : [];
        })
      ];
      return {
        ...group,
        // Reserved groups intentionally retain stable placeholders; ordinary
        // profession groups project sequence families to the live bar tile.
        skills: reservedSkillIds.length ? skills : displayedSkillTiles(app, skills)
      };
    });
  const renderedProfessionGroups = renderGroups(professionGroups);
  const loadoutHotkeys = rotationLoadoutHotkeyActions(
    app.adapter.slotLoadout?.view(paletteContext).bars || [],
    (skillId) => app.adapter.slotLoadout?.skillChildren?.(paletteContext, skillId) || []
  );
  const renderedLoadoutGroups = renderGroups(loadoutGroups).map((group) => ({
    ...group,
    skills: group.skills.map((skill) => ({
      ...skill,
      hotkeyAction: loadoutHotkeys.get(Number(skill.id)) || ''
    }))
  }));
  const selected = rotationSelectedSlotSkills(app);
  // The shared projector discovers and selects descendants from the catalog;
  // selected utilities only need to contribute their root tile and hotkey.
  const selectedWithFlipChains = uniqueByName(selected).map((skill, index) => ({
    ...skill,
    hotkeyAction: rotationUtilityHotkeyAction(index)
  }));
  const groupedActionSkillIds = new Set(
    [...renderedProfessionGroups, ...renderedLoadoutGroups].flatMap((group) =>
      group.skills.filter((skill) => skill.type === 'Action' && !skill.concealed).map((skill) => String(skill.id))
    )
  );
  // Actions explicitly placed by a profession or loadout group must not also
  // appear in the shared action row.
  const actions = paletteActionSkills(app, spec).filter((skill) => !groupedActionSkillIds.has(String(skill.id)));
  const weaponSwapActions = actions.filter((skill) => skill.name === 'Swap Weapons');
  const generalActions = actions.filter((skill) => skill.name !== 'Swap Weapons');
  const activeWeaponSet = endState?.activeWeaponSet || 1;

  const availableAmbush =
    professionState.availableAmbush && typeof professionState.availableAmbush === 'object'
      ? (professionState.availableAmbush as SchedulerRecord)
      : null;

  const autoattackChains =
    professionState.autoattackChains && typeof professionState.autoattackChains === 'object'
      ? (professionState.autoattackChains as SchedulerRecord)
      : {};
  const loadoutUnavailableMessage = (skill: Skill): string =>
    app.adapter.slotLoadout?.unavailableReason(skill, paletteContext) || '';

  // Loadout and profession availability are independent vetoes. Cache the
  // structured profession result because both its flag and message are read.
  const paletteAvailabilityBySkill = new Map<Skill, PaletteSkillAvailability>();
  const professionPaletteAvailability = (skill: Skill): PaletteSkillAvailability => {
    if (!paletteAvailabilityBySkill.has(skill)) {
      paletteAvailabilityBySkill.set(skill, app.profession.ui.paletteSkillAvailability(paletteContext, skill));
    }

    return paletteAvailabilityBySkill.get(skill) as PaletteSkillAvailability;
  };

  const professionAllowsPaletteSkill = (skill: Skill): boolean =>
    !loadoutUnavailableMessage(skill) && professionPaletteAvailability(skill).available;

  const professionPaletteUnavailableMessage = (skill: Skill): string =>
    loadoutUnavailableMessage(skill) || professionPaletteAvailability(skill).message;

  const professionPaletteRetryAt = (skill: Skill): number | null =>
    professionPaletteAvailability(skill).retryAt ?? null;

  const weaponSkillAvailable = (skill: Skill, weaponSet: number): boolean => {
    if (weaponSet !== activeWeaponSet) return false;
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (skill.ambush) return String(availableAmbush?.name || '') === skill.name;
    if (availableAmbush && skill.slot === 'Weapon_1') return false;
    return true;
  };

  const weaponSkillUnavailableMessage = (skill: Skill, weaponSet: number): string => {
    if (weaponSet !== activeWeaponSet) {
      return `Swap to weapon set ${weaponSet} to use this skill`;
    }

    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }

    if (skill.ambush) {
      return availableAmbush
        ? `Current ambush is ${String(availableAmbush.name || '')}`
        : 'Gain Mirage Cloak to use this ambush';
    }

    if (availableAmbush && skill.slot === 'Weapon_1') {
      return `${String(availableAmbush.name || '')} currently replaces weapon skill 1`;
    }

    return '';
  };

  const selectedWithFlips = displayedSkillTiles(app, selectedWithFlipChains);

  const utilitySkillAvailable = (skill: Skill): boolean => {
    return professionAllowsPaletteSkill(skill);
  };

  const utilitySkillUnavailableMessage = (skill: Skill): string => {
    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }

    return '';
  };

  const professionSkillAvailable = (skill: Skill): boolean => professionAllowsPaletteSkill(skill);

  const professionSkillUnavailableMessage = (skill: Skill): string => {
    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }

    return '';
  };

  const hotkeyBindings = loadRotationHotkeyBindings();
  const hotkeysEnabled = loadRotationHotkeysEnabled();
  const hotkeyTargets = new Map<RotationHotkeyAction, HTMLElement>();
  const handlers: PaletteHandlers = {
    hotkeyBindings,
    hotkeysEnabled,
    registerHotkey(view, target) {
      const action = String(view.hotkeyAction || '') as RotationHotkeyAction;
      if (!target || !action || view.contextDisabled || view.concealed || hotkeyTargets.has(action)) return;
      hotkeyTargets.set(action, target);
    },
    onControlActivate(controlId) {
      if (app.profession.ui.updatePaletteControl(paletteContext, controlId)) app.changed();
    },
    onActivate(view, event) {
      const icon = event.currentTarget;
      const name = String(view.name || '');
      const parsedSkillId = Number(view.skillId);
      const skillId = view.skillId != null && Number.isFinite(parsedSkillId) ? parsedSkillId : null;
      const identity = skillId == null ? {} : { skillId };
      const professionAction = resolveProfessionPaletteAction(app, name, skillId);
      // `undefined` means the profession does not own the action. `null` means it handled activation without insertion.
      if (professionAction !== undefined) {
        if (professionAction !== null) {
          insertRotationItems(app, Array.isArray(professionAction) ? professionAction : [professionAction]);
        }

        return;
      }

      if (name === '__combat_start' && view.disabled) return;
      if (name === '__wait') {
        openDurationEditor({
          anchor: icon,
          heading: 'Add wait',
          name: 'Wait',
          icon: WAIT_ICON,
          label: 'Duration',
          value: 1000,
          onApply(waitMs) {
            app.addRotation(name, { durationMs: waitMs });
          }
        });
        return;
      }

      const skill = skillId == null ? app.skillByName.get(name) : app.skillById.get(skillId);
      if (skill?.dragonSlash) {
        const insertionIndex =
          normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length) ??
          app.build.rotation.length;
        openDragonSlashReleaseEditor({
          app,
          anchor: icon,
          skill,
          insertionIndex,
          onApply(releaseAtCharges) {
            app.addRotation(name, { ...identity, ...(releaseAtCharges == null ? {} : { releaseAtCharges }) });
          }
        });
        return;
      }

      if (hasConfigurableDoubleEdgeOutcome(skill)) {
        openDoubleEdgeEditor({
          anchor: icon,
          skillName: String(skill.displayName || skill.name),
          icon: skill.icon || undefined,
          outcome: 'success',
          onApply(outcome) {
            app.addRotation(name, { ...identity, doubleEdgeOutcome: outcome });
          }
        });
        return;
      }

      const instant = paletteSkillIsInstant(app, paletteContext, skill, name);
      if (event.shiftKey && instant && skill?.canCastConcurrently !== false && app.build.rotation.length) {
        app.addRotation(name, { ...identity, concurrentOffsetMs: CONCURRENT_OFFSET_MS });
      } else if (event.ctrlKey && !instant) {
        const suggestedInterruptMs = defaultPaletteInterruptMs(skill);
        openActivationEditor({
          anchor: icon,
          skillName: String(skill?.displayName || skill?.name || name),
          icon: skill?.icon || String(view.icon || '') || undefined,
          interruptMs: suggestedInterruptMs,
          fullCastMs: Number(skill?.castTimeMs) || null,
          suggestedInterruptMs,
          damageCommitMs: activationDamageCommitMs(skill),
          onApply(interruptMs) {
            app.addRotation(name, { ...identity, ...(interruptMs == null ? {} : { interruptAfterMs: interruptMs }) });
          }
        });
      } else {
        app.addRotation(name, identity);
      }
    },
    onDragStart(view, event) {
      const parsedSkillId = Number(view.skillId);
      app.dragState = {
        source: 'palette',
        name: String(view.name || ''),
        anchor: event.currentTarget,
        ...(view.skillId != null && Number.isFinite(parsedSkillId) ? { skillId: parsedSkillId } : {})
      };
    },
    onDragEnd() {
      app.dragState = null;
      document.getElementById('rotation-timeline')?.dispatchEvent(new Event('timeline-drag-clear'));
    }
  };

  const loadoutHasResourceAnchor = renderedLoadoutGroups.some((group) => group.resourceAnchor);
  const loadoutStack = renderedLoadoutGroups.length ? (
    <div
      className='weapon-palette-stack loadout-palette-stack'
      data-role='loadout-palette-stack'
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
    >
      {renderedLoadoutGroups.map((group, index) => {
        const view = addGroup(
          app,
          group.label,
          group.skills,
          group.color || '#c49cff',
          professionSkillAvailable,
          professionSkillUnavailableMessage,
          group.className,
          group.statusIcon
        );
        return view ? <PaletteGroup key={group.id || index} view={view} handlers={handlers} /> : null;
      })}
    </div>
  ) : null;
  const attachedResourceIds = renderedProfessionGroups.flatMap((group) => group.resourceIds || []);
  const detachedResourceIds = activeResourceDefinitions(app)
    .filter((definition) => definition.paletteSkillId == null && !attachedResourceIds.includes(definition.id))
    .map((definition) => definition.id);
  let resourceAnchorRendered = false;
  // The first eligible anchor consumes the unpositioned resource block; later anchors must not duplicate it.
  const stackWithResources = (node: ReactNode, anchored: boolean | undefined, key: string): ReactNode => {
    if (!node || !anchored || !detachedResourceIds.length) return node;
    resourceAnchorRendered = true;
    return (
      <div key={key} className='profession-resource-stack' data-role='profession-resource-stack'>
        {node}
        <ActiveResourceGroup app={app} excludeIds={attachedResourceIds} />
      </div>
    );
  };

  const anchoredLoadoutStack = stackWithResources(loadoutStack, loadoutHasResourceAnchor, 'loadout-resources');
  const loadoutAfterActions = app.adapter.slotLoadout?.palettePlacement === 'after-actions';
  const loadoutBeforeWeapons = loadoutAfterActions ? null : anchoredLoadoutStack;
  const loadoutUtilityGroup =
    loadoutAfterActions && anchoredLoadoutStack ? (
      <div className='utility-palette-group loadout-utility-palette-group' data-role='loadout-utility-palette-group'>
        {anchoredLoadoutStack}
      </div>
    ) : null;
  // A group either stays in the profession section, follows weapon set one,
  // or sits beside the currently active weapon row.
  const weaponSetOneProfessionGroups = renderedProfessionGroups.filter((group) => group.placement === 'weapon-set-1');
  const activeWeaponProfessionGroups = renderedProfessionGroups.filter((group) => group.placement === 'active-weapon');
  const standardProfessionGroups = renderedProfessionGroups.filter(
    (group) => group.placement === 'profession' || !group.placement
  );

  const renderProfessionGroup = (group: RenderedPaletteGroup): ReactNode => {
    const view = addGroup(
      app,
      group.label,
      group.skills,
      group.color || '#c49cff',
      professionSkillAvailable,
      professionSkillUnavailableMessage,
      group.className,
      group.statusIcon,
      group.controls,
      group.id,
      professionPaletteRetryAt
    );
    if (!view) return null;
    const groupNode = <PaletteGroup key={group.id} view={view} handlers={handlers} />;
    const hasAttachedResources = activeResourceDefinitions(app).some(
      (definition) => definition.paletteSkillId == null && group.resourceIds?.includes(definition.id)
    );
    if (!hasAttachedResources) return groupNode;
    const resourcesFirst = group.resourcePlacement === 'above';
    const resources = <ActiveResourceGroup app={app} includeIds={group.resourceIds} />;
    return (
      <div
        key={group.id}
        className={`profession-palette-resource-group resource-${group.resourcePlacement || 'below'}`}
      >
        {resourcesFirst ? resources : groupNode}
        {resourcesFirst ? groupNode : resources}
      </div>
    );
  };

  const renderedStackIds = new Set<string>();
  const professionGroupNodes = standardProfessionGroups.map((group) => {
    if (!group.stackId) {
      return stackWithResources(
        renderProfessionGroup(group),
        group.resourceAnchor && !loadoutHasResourceAnchor,
        `profession-resource-${group.id}`
      );
    }

    if (renderedStackIds.has(group.stackId)) return null;
    renderedStackIds.add(group.stackId);
    const stackedGroups = standardProfessionGroups.filter((candidate) => candidate.stackId === group.stackId);
    const stack = (
      <div key={group.stackId} className='profession-palette-stack' data-palette-stack={group.stackId}>
        {stackedGroups.map(renderProfessionGroup)}
      </div>
    );
    return stackWithResources(
      stack,
      !loadoutHasResourceAnchor && stackedGroups.some((candidate) => candidate.resourceAnchor),
      `profession-resource-stack-${group.stackId}`
    );
  });
  const unanchoredResources =
    !resourceAnchorRendered && detachedResourceIds.length ? (
      <ActiveResourceGroup app={app} excludeIds={attachedResourceIds} />
    ) : null;
  const hasProfessionPalette = professionGroupNodes.some(Boolean) || unanchoredResources || loadoutBeforeWeapons;
  const professionPaletteSection = hasProfessionPalette ? (
    <div className='profession-palette-section' data-role='profession-palette-section'>
      {professionGroupNodes}
      {unanchoredResources}
      {loadoutBeforeWeapons}
    </div>
  ) : null;

  const utilityGroup = addGroup(
    app,
    'Skill',
    selectedWithFlips,
    '#cbb8ea',
    utilitySkillAvailable,
    utilitySkillUnavailableMessage,
    'utility-palette-group',
    undefined,
    [],
    '',
    professionPaletteRetryAt
  );

  const paletteWeaponSkills = (skills: readonly Skill[], context: SchedulerRecord = {}): Skill[] =>
    app.profession.ui.paletteWeaponSkills({ ...paletteContext, ...context }, skills);
  // Custom layouts project their data through the same availability and cooldown policy as ordinary rows.
  const renderWeaponSkill: PaletteSkillProjector = (skill, options = {}) => {
    const contextAvailable = options.contextAvailable ?? weaponSkillAvailable(skill, 1);
    const contextMessage = options.contextMessage ?? weaponSkillUnavailableMessage(skill, 1);
    return {
      ...paletteSkillView(app, skill, contextAvailable, contextMessage),
      ...((options.view || {}) as PaletteSkillView)
    };
  };

  const customWeaponPalette = app.profession.ui.renderWeaponPalette({
    ...paletteContext,
    skills: paletteWeaponSkills(displayedWeaponSkills(app, weaponSkills(app, 1), 1), { weaponSet: 1 }),
    autoattackChains,
    isSkillAvailable: (skill) => weaponSkillAvailable(skill, 1),
    unavailableMessage: (skill) => weaponSkillUnavailableMessage(skill, 1)
  });

  const positionedActiveWeaponGroups = new Set<string>();
  // Standard layouts place weapon swap in the first active weapon row and then
  // omit it from the shared action row.
  let weaponSwapEmbedded = false;
  const weaponGroups: ReactNode[] = (() => {
    if (customWeaponPalette) {
      return [
        <CustomWeaponPalette
          key='custom-weapon-cooldowns'
          view={customWeaponPalette}
          project={renderWeaponSkill}
          handlers={handlers}
        />,
        ...weaponSetOneProfessionGroups.map(renderProfessionGroup)
      ].filter(Boolean);
    }

    const weaponRows = weaponPaletteRows(app, activeWeaponSet)
      .map((row) => ({
        ...row,
        skills: paletteWeaponSkills(row.skills, {
          weaponSet: row.weaponSet,
          weaponRow: row
        })
      }))
      .filter((row) => row.skills.length);
    return weaponRows.flatMap((row, index) => {
      const rowWeaponSwapActions = row.active && !weaponSwapEmbedded ? weaponSwapActions : [];
      if (rowWeaponSwapActions.length) weaponSwapEmbedded = true;
      const renderedRow = addGroup(
        app,
        row.label,
        [...row.skills, ...rowWeaponSwapActions],
        row.active ? '#a98fd8' : '#625a73',
        (skill) =>
          skill.name === 'Swap Weapons' ? professionSkillAvailable(skill) : weaponSkillAvailable(skill, row.weaponSet),
        (skill) =>
          skill.name === 'Swap Weapons'
            ? professionSkillUnavailableMessage(skill)
            : weaponSkillUnavailableMessage(skill, row.weaponSet)
      );
      const positionedGroups = activeWeaponProfessionGroups.filter(
        (group) =>
          row.active &&
          !positionedActiveWeaponGroups.has(group.id) &&
          (!group.weaponRowLabel || group.weaponRowLabel === row.label)
      );
      positionedGroups.forEach((group) => positionedActiveWeaponGroups.add(group.id));
      return [
        renderedRow ? <PaletteGroup key={row.id} view={renderedRow} handlers={handlers} /> : null,
        ...positionedGroups.map(renderProfessionGroup),
        ...(row.weaponSet === 1 && weaponRows[index + 1]?.weaponSet !== 1
          ? weaponSetOneProfessionGroups.map(renderProfessionGroup)
          : [])
      ];
    });
  })();

  if (!customWeaponPalette) {
    weaponGroups.push(
      ...activeWeaponProfessionGroups
        .filter((group) => !positionedActiveWeaponGroups.has(group.id))
        .map(renderProfessionGroup)
    );
  }

  const activeWeaponPrimary = customWeaponPalette ? activeWeaponProfessionGroups.map(renderProfessionGroup) : [];
  const actionGroup = addGroup(
    app,
    'Act',
    weaponSwapEmbedded ? generalActions : actions,
    '#70b6d0',
    professionSkillAvailable,
    professionSkillUnavailableMessage,
    'action-palette-group'
  );

  const utilityNode = utilityGroup ? <PaletteGroup view={utilityGroup} handlers={handlers} /> : null;
  const actionNode = actionGroup ? <PaletteGroup view={actionGroup} handlers={handlers} /> : null;
  const weaponSection =
    weaponGroups.length || (!customWeaponPalette && actionNode) ? (
      <div
        className='weapon-palette-section'
        data-role='weapon-palette-section'
        style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}
      >
        {weaponGroups.length ? (
          <div
            className='weapon-palette-stack'
            data-role='weapon-set-stack'
            style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 6 }}
          >
            {weaponGroups}
          </div>
        ) : null}
        {customWeaponPalette ? null : actionNode}
      </div>
    ) : null;
  const virtualGroups: PaletteGroupView[] = [
    {
      label: 'Cmb',
      color: '#d66d2f',
      skills: [
        {
          name: '__combat_start',
          title: 'Combat Start',
          icon: COMBAT_START_ICON,
          disabled: app.build.rotation.some((item) => rotationEntryName(item) === '__combat_start'),
          draggable: true,
          virtual: true
        }
      ]
    },
    {
      label: 'Rst',
      color: '#7e9ac7',
      skills: [
        { name: '__cooldown_reset', title: 'Cooldown Reset', icon: COOLDOWN_RESET_ICON, draggable: true, virtual: true }
      ]
    },
    {
      label: 'W8',
      color: '#8d7a57',
      skills: [{ name: '__wait', title: 'Wait', icon: WAIT_ICON, draggable: true, virtual: true }]
    }
  ];

  renderReact(
    element,
    <>
      {customWeaponPalette ? (
        <div className='custom-weapon-top-palette' data-role='custom-weapon-top-palette'>
          {professionPaletteSection}
          <CustomWeaponCurrentBar view={customWeaponPalette} project={renderWeaponSkill} handlers={handlers} />
          {activeWeaponPrimary}
          {utilityNode}
          {actionNode}
        </div>
      ) : (
        <>
          {professionPaletteSection}
          {utilityNode}
        </>
      )}
      {weaponSection}
      {loadoutUtilityGroup}
      <div className='timeline-tools-palette-stack' data-role='timeline-tools-palette-stack'>
        <div className='pal-break' />
        {virtualGroups.map((view) => (
          <PaletteGroup key={view.label} view={view} handlers={handlers} />
        ))}
      </div>
    </>
  );
  mountRotationHotkeys(
    element,
    app.adapter.capabilities.keybindImport,
    (action, event) => {
      const target = hotkeyTargets.get(action);
      const MouseEventConstructor = element.ownerDocument.defaultView?.MouseEvent;
      if (!target || !MouseEventConstructor) return false;
      target.dispatchEvent(
        new MouseEventConstructor('click', {
          bubbles: true,
          cancelable: true,
          shiftKey: event.shiftKey && !hotkeyBindings[action].includes('Shift+')
        })
      );
      return true;
    },
    () => renderPalette(app)
  );
}
