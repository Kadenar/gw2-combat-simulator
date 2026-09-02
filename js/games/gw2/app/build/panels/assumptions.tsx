import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MODIFIER_EFFECT_ICONS } from '#gw2/app/rotation/shared/icons.js';
import { RotationDisplayControls } from '#gw2/app/rotation/timeline/display-controls.js';
import { assumptionControlsForSpecialization } from '#gw2/platform/builds/assumptions.js';
import { isSimulationRandomnessControl } from '#gw2/platform/simulation/randomness.js';
import {
  normalizeTargetArmor,
  STACKING_TARGET_CONDITIONS,
  TARGET_ARMOR_OPTIONS,
  TARGET_CONDITION_GROUPS
} from '#gw2/app/build/panels/options.js';
import { requiredElement } from '#ui/shared/dom.js';
import { renderReact } from '#ui/react-root.js';
import { DraftNumberInput } from '#ui/draft-number-input.js';

import type { ProfessionAppState } from '#gw2/app/types.js';
import type {
  ProfessionAssumptionControl,
  ProfessionAssumptionOption,
  ProfessionBuildAssumptions
} from '#gw2/platform/builds/types.js';

const PERMANENT_BOONS: readonly (readonly [string, string])[] = [
  ['fury', 'Fury'],
  ['quickness', 'Quickness'],
  ['alacrity', 'Alacrity'],
  ['protection', 'Protection'],
  ['resolution', 'Resolution'],
  ['regeneration', 'Regeneration'],
  ['swiftness', 'Swiftness'],
  ['vigor', 'Vigor'],
  ['aegis', 'Aegis']
];

interface SectionProps {
  readonly sectionKey: string;
  readonly label: string;
  readonly children: ReactNode;
}

/** Keeps each disclosure state stable while ProfessionApp rerenders the panel. */
function Section({ sectionKey, label, children }: SectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <details
      className="perma-group"
      data-assumption-section={sectionKey}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="perma-group-label">{label}</summary>
      <div className="perma-group-content">{children}</div>
    </details>
  );
}

interface EffectItemProps {
  readonly name: string;
  readonly checked: boolean;
  readonly type: 'boon' | 'condition';
  readonly effectKey?: string;
  readonly stacks?: number | null;
  readonly onChecked: (checked: boolean) => void;
  readonly onStacks?: (draft: string) => number;
}

function EffectItem({
  name,
  checked,
  type,
  effectKey = name,
  stacks = null,
  onChecked,
  onStacks
}: EffectItemProps) {
  return (
    <label className="perma-item" title={name}>
      <input
        type="checkbox"
        aria-label={name}
        data-effect-type={type}
        data-effect-key={effectKey}
        checked={checked}
        onChange={(event) => onChecked(event.currentTarget.checked)}
      />
      <img className="perma-icon" src={MODIFIER_EFFECT_ICONS[name]} alt="" />
      {stacks == null ? null : (
        <DraftNumberInput
          className="perma-stacks"
          aria-label={`${name} stacks`}
          data-effect-type={type}
          data-effect-key={effectKey}
          min={0}
          max={25}
          value={stacks}
          disabled={!checked}
          onCommit={onStacks ?? (() => stacks)}
        />
      )}
    </label>
  );
}

interface ProfessionControlProps {
  readonly app: ProfessionAppState;
  readonly assumptions: ProfessionBuildAssumptions;
  readonly control: ProfessionAssumptionControl;
}

function ProfessionControl({ app, assumptions, control }: ProfessionControlProps) {
  const value = assumptions[control.key] ?? control.defaultValue;
  const commit = (nextValue: unknown): void => {
    assumptions[control.key] = nextValue;
    app.changed();
  };

  if (control.type === 'boolean') {
    return (
      <label className="boon-control">
        <input
          data-assumption-key={control.key}
          data-assumption-type="boolean"
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => commit(event.currentTarget.checked)}
        />{' '}
        {control.label}
      </label>
    );
  }

  if (control.type === 'number') {
    return (
      <label className="boon-control">
        {control.label}
        <DraftNumberInput
          data-assumption-key={control.key}
          data-assumption-type="number"
          min={control.minimum}
          max={control.maximum}
          step={control.step}
          value={Number(value)}
          onCommit={(draft) => {
            const nextValue = Math.max(control.minimum, Math.min(control.maximum, Number(draft) || 0));
            commit(nextValue);
            return nextValue;
          }}
        />
      </label>
    );
  }

  const optionIcon = (option: ProfessionAssumptionOption): string =>
    option.icon || app.skillById.get(Number(option.skillId))?.icon || '';
  const hasIcons = control.options.some(optionIcon);
  if (!hasIcons) {
    return (
      <label className="boon-control">
        {control.label}
        <select
          className="gear-select"
          data-assumption-key={control.key}
          data-assumption-type="select"
          value={String(value)}
          onChange={(event) => commit(event.currentTarget.value)}
        >
          {control.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const selected = control.options.find((option) => option.value === String(value)) ?? control.options[0];
  if (!selected) return null;

  return (
    <div className="boon-control assumption-icon-control">
      <span>{control.label}</span>
      <details className="assumption-icon-select">
        <summary>
          <img src={optionIcon(selected)} alt="" />
          <span>{selected.label}</span>
        </summary>
        <div className="assumption-icon-options" role="listbox" aria-label={control.label}>
          {control.options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === String(value)}
              data-assumption-option-key={control.key}
              data-assumption-option-value={option.value}
              onClick={() => commit(option.value)}
            >
              <img src={optionIcon(option)} alt="" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

interface TargetArmorControlProps {
  readonly app: ProfessionAppState;
  readonly armor: number;
}

function TargetArmorControl({ app, armor }: TargetArmorControlProps) {
  const initialPreset = TARGET_ARMOR_OPTIONS.some((option) => option.value === armor) ? String(armor) : 'custom';
  const [preset, setPreset] = useState(initialPreset);
  const customInput = useRef<HTMLInputElement>(null);

  useEffect(() => setPreset(initialPreset), [initialPreset]);

  return (
    <label className="boon-control">
      Target armor
      <select
        className="gear-select"
        id="target-armor-preset"
        value={preset}
        onChange={(event) => {
          const nextPreset = event.currentTarget.value;
          setPreset(nextPreset);
          if (nextPreset === 'custom') {
            requestAnimationFrame(() => customInput.current?.focus());
            return;
          }

          app.build.targetArmor = normalizeTargetArmor(nextPreset);
          app.changed();
        }}
      >
        {TARGET_ARMOR_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label} ({value})
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      <DraftNumberInput
        inputRef={customInput}
        id="target-armor"
        min={1}
        value={armor}
        aria-label="Custom target armor"
        hidden={preset !== 'custom'}
        onCommit={(draft) => {
          app.build.targetArmor = normalizeTargetArmor(draft);
          app.changed();
          return app.build.targetArmor;
        }}
      />
    </label>
  );
}

interface AssumptionsPanelProps {
  readonly app: ProfessionAppState;
}

/** Renders assumption state as React-owned controls while committing all simulation data through ProfessionApp. */
function AssumptionsPanel({ app }: AssumptionsPanelProps) {
  const assumptions = app.build.assumptions as ProfessionBuildAssumptions;
  const conditions = (assumptions.targetConditions ||= {});
  const targetArmor = normalizeTargetArmor(app.build.targetArmor);
  app.build.targetArmor = targetArmor;
  const controls = assumptionControlsForSpecialization(
    app.adapter.assumptionControls,
    app.adapter.eliteSpecialization(app.build)
  );
  const updateEffect = (type: 'boon' | 'condition', key: string, value: number | boolean): void => {
    if (type === 'boon') {
      assumptions[key] = value;
    } else if (value) {
      conditions[key] = value;
    } else {
      delete conditions[key];
    }

    app.changed();
  };

  const effectItem = (
    name: string,
    type: 'boon' | 'condition',
    key: string,
    value: number | boolean,
    stackable = false
  ) => {
    const stacks = stackable ? Math.max(0, Math.min(25, Number(value) || 0)) : null;
    const checked = stackable ? Number(value) > 0 : Boolean(value);
    return (
      <EffectItem
        key={`${type}-${key}`}
        name={name}
        type={type}
        effectKey={key}
        checked={checked}
        stacks={stacks}
        onChecked={(nextChecked) => updateEffect(type, key, stackable ? (nextChecked ? Math.max(1, stacks || 0) : 0) : nextChecked)}
        onStacks={(draft) => {
          const nextValue = Math.max(0, Math.min(25, Number(draft) || 0));
          updateEffect(type, key, nextValue);
          return nextValue;
        }}
      />
    );
  };

  const targetControls = controls.filter((control) => !control.section || control.section === 'target');
  const simulationControls = controls.filter(
    (control) => control.section === 'simulation' && !isSimulationRandomnessControl(control)
  );
  const customSections = new Map<string, ProfessionAssumptionControl[]>();
  controls
    .filter((control) => Boolean(control.section) && !['target', 'simulation'].includes(control.section ?? ''))
    .forEach((control) => {
      const section = control.section;
      if (!section) return;
      const sectionControls = customSections.get(section) ?? [];
      sectionControls.push(control);
      customSections.set(section, sectionControls);
    });

  return (
    <>
      <Section sectionKey="boons" label="Boons">
        {effectItem('Might', 'boon', 'might', Number(assumptions.might) || 0, true)}
        {PERMANENT_BOONS.map(([key, name]) =>
          effectItem(name, 'boon', key, Boolean(assumptions[key]))
        )}
      </Section>
      {TARGET_CONDITION_GROUPS.map((group) => (
        <Section
          key={group.label}
          sectionKey={`conditions-${group.label.toLowerCase()}`}
          label={group.label === 'Damaging' ? 'Conditions' : group.label}
        >
          {group.conditions.map((name) =>
            effectItem(
              name,
              'condition',
              name,
              conditions[name] ?? false,
              STACKING_TARGET_CONDITIONS.has(name)
            )
          )}
        </Section>
      ))}
      <Section sectionKey="target" label="Target">
        <label className="boon-control">
          Maximum HP
          <DraftNumberInput
            id="target-hp"
            min={0}
            step={100000}
            value={Number(app.build.targetHealth)}
            onCommit={(draft) => {
              app.build.targetHealth = Math.max(0, Number(draft) || 0);
              app.changed();
              return app.build.targetHealth;
            }}
          />
        </label>
        <label className="boon-control">
          Starting health %
          <DraftNumberInput
            id="target-starting-health-percent"
            min={0}
            max={100}
            step={1}
            value={Number(app.build.targetStartingHealthPercent ?? 100)}
            onCommit={(draft) => {
              app.build.targetStartingHealthPercent = Math.max(0, Math.min(100, Number(draft) || 0));
              app.changed();
              return app.build.targetStartingHealthPercent;
            }}
          />
        </label>
        <TargetArmorControl app={app} armor={targetArmor} />
        <label className="boon-control">
          Skill activations/s
          <DraftNumberInput
            id="target-skill-activations"
            min={0}
            max={10}
            step={0.1}
            value={Number(assumptions.targetSkillActivationsPerSecond) || 0}
            onCommit={(draft) => {
              const value = Math.max(0, Math.min(10, Number(draft) || 0));
              assumptions.targetSkillActivationsPerSecond = value;
              app.changed();
              return value;
            }}
          />
        </label>
        <label className="boon-control">
          <input
            id="target-moving"
            type="checkbox"
            checked={Boolean(assumptions.targetMoving)}
            onChange={(event) => {
              assumptions.targetMoving = event.currentTarget.checked;
              app.changed();
            }}
          />{' '}
          Moving
        </label>
        {targetControls.map((control) => (
          <ProfessionControl key={control.key} app={app} assumptions={assumptions} control={control} />
        ))}
      </Section>
      {[...customSections].map(([sectionName, sectionControls]) => (
        <Section
          key={sectionName}
          sectionKey={`custom-${sectionName.toLowerCase().replaceAll(' ', '-')}`}
          label={sectionName}
        >
          {sectionControls.map((control) => (
            <ProfessionControl key={control.key} app={app} assumptions={assumptions} control={control} />
          ))}
        </Section>
      ))}
      <Section sectionKey="party" label="Party">
        <label className="boon-control">
          Additional allied players
          <DraftNumberInput
            id="allied-player-count"
            min={0}
            max={4}
            step={1}
            value={Number(assumptions.alliedPlayerCount) || 0}
            onCommit={(draft) => {
              const value = Math.max(0, Math.min(4, Math.trunc(Number(draft) || 0)));
              assumptions.alliedPlayerCount = value;
              app.changed();
              return value;
            }}
          />
        </label>
      </Section>
      <Section sectionKey="simulation" label="Simulation">
        <label className="boon-control">
          Time of day
          <select
            className="gear-select"
            id="time-of-day"
            value={assumptions.timeOfDay === 'night' ? 'night' : 'day'}
            onChange={(event) => {
              assumptions.timeOfDay = event.currentTarget.value === 'night' ? 'night' : 'day';
              app.changed();
            }}
          >
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </label>
        <label
          className="boon-control"
          title="Controls minions, clones, turrets, and other ordinary summons. Mesmer phantasms and the Mechanist mech are unchanged."
        >
          <input
            id="share-player-boons-with-summons"
            type="checkbox"
            checked={assumptions.sharePlayerBoonsWithSummons !== false}
            onChange={(event) => {
              assumptions.sharePlayerBoonsWithSummons = event.currentTarget.checked;
              app.changed();
            }}
          />{' '}
          Share player boons with summons
        </label>
        {simulationControls.map((control) => (
          <ProfessionControl key={control.key} app={app} assumptions={assumptions} control={control} />
        ))}
      </Section>
      <RotationDisplayControls app={app} />
    </>
  );
}

/** Keeps the legacy build-editor entry point while handing the assumptions subtree exclusively to React. */
export function renderAssumptions(app: ProfessionAppState): void {
  renderReact(requiredElement('perma-boons'), <AssumptionsPanel app={app} />);
}
