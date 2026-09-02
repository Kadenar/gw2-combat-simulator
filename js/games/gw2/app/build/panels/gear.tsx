import { Fragment, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { FOOD_GROUPS } from '#gw2/platform/equipment/consumables/food.js';
import { GEAR_SLOTS, INFUSION_BONUS, INFUSION_STATS, PREFIX_GROUPS } from '#gw2/platform/equipment/gear/stats.js';
import { RELIC_GROUPS } from '#gw2/platform/equipment/relics/catalog.js';
import { RUNE_GROUPS } from '#gw2/platform/equipment/gear/runes.js';
import { SIGIL_GROUPS } from '#gw2/platform/equipment/sigils/catalog.js';
import { UTILITY_GROUPS } from '#gw2/platform/equipment/consumables/utilities.js';
import { setWeaponSigil } from '#gw2/platform/equipment/sigils/loadout.js';
import { DraftNumberInput } from '#ui/draft-number-input.js';
import { renderReact } from '#ui/react-root.js';
import { requiredElement } from '#ui/shared/dom.js';
import {
  foodOptionLabel,
  prefixOptionLabel,
  relicOptionLabel,
  runeOptionLabel,
  sigilOptionLabel,
  utilityOptionLabel
} from '#gw2/app/build/equipment-option-labels.js';

import type { ProfessionAppState } from '#gw2/app/types.js';

interface OptionGroup {
  readonly label: string;
  readonly items: readonly string[];
}

interface DetailedSelectProps {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly controlId: string;
  readonly dataIndex?: number;
  readonly dataSet?: number;
  readonly dataSlot?: string | number;
  readonly disabledOption?: (value: string) => boolean;
  readonly groups: readonly OptionGroup[];
  readonly id?: string;
  readonly leadingOption?: { readonly label: string; readonly value: string };
  readonly onChange: (value: string) => void;
  readonly optionLabel: (value: string) => string;
  readonly placeholder?: string;
  readonly value: string;
}

function splitOptionLabel(label: string): { name: string; details: string } {
  const separator = ' — ';
  const separatorIndex = label.indexOf(separator);
  return separatorIndex < 0
    ? { name: label, details: '' }
    : { name: label.slice(0, separatorIndex), details: label.slice(separatorIndex + separator.length) };
}

/** Uses the native Popover API for detailed equipment choices while React owns values and accessibility state. */
function DetailedSelect({
  ariaLabel,
  className = '',
  controlId,
  dataIndex,
  dataSet,
  dataSlot,
  disabledOption = () => false,
  groups,
  id,
  leadingOption,
  onChange,
  optionLabel,
  placeholder,
  value
}: DetailedSelectProps) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = `gear-select-menu-${controlId}`;
  const triggerLabel = placeholder || splitOptionLabel(optionLabel(value)).name;
  const select = (nextValue: string): void => {
    menu.current?.hidePopover();
    onChange(nextValue);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const choices = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.gear-select-option:not(:disabled)')];
    const currentIndex = choices.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
    event.preventDefault();
    choices[nextIndex]?.focus();
  };

  const option = (optionValue: string, label: string) => {
    const { name, details } = splitOptionLabel(label);
    return (
      <button
        type="button"
        className="gear-select-option"
        data-value={optionValue}
        disabled={disabledOption(optionValue)}
        role="option"
        aria-selected={optionValue === value}
        key={optionValue}
        onClick={() => select(optionValue)}
      >
        <span className="gear-option-name">{name}</span>
        {details ? <span className="gear-option-detail">{details}</span> : null}
      </button>
    );
  };

  return (
    <div className={`gear-select-display${open ? ' is-open' : ''}`}>
      <select
        id={id}
        className={`gear-select${className ? ` ${className}` : ''}`}
        aria-label={ariaLabel}
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        data-index={dataIndex}
        data-set={dataSet}
        data-slot={dataSlot}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {leadingOption ? <option value={leadingOption.value}>{leadingOption.label}</option> : null}
        {groups.map((group) =>
          group.label ? (
            <optgroup label={group.label} key={group.label}>
              {group.items.map((item) => (
                <option value={item} disabled={disabledOption(item)} key={item}>
                  {optionLabel(item)}
                </option>
              ))}
            </optgroup>
          ) : (
            <Fragment key="ungrouped">
              {group.items.map((item) => (
                <option value={item} disabled={disabledOption(item)} key={item}>
                  {optionLabel(item)}
                </option>
              ))}
            </Fragment>
          )
        )}
      </select>
      <button
        type="button"
        className="gear-select-trigger"
        popoverTarget={menuId}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {triggerLabel}
      </button>
      <div
        ref={menu}
        id={menuId}
        className="gear-select-menu"
        popover="auto"
        role="listbox"
        aria-label={ariaLabel}
        onKeyDown={onMenuKeyDown}
        onToggle={(event) => {
          const current = event.currentTarget;
          const isOpen = current.matches(':popover-open');
          setOpen(isOpen);
          if (!isOpen) return;

          const trigger = current.previousElementSibling;
          if (!(trigger instanceof HTMLButtonElement)) return;
          const triggerRect = trigger.getBoundingClientRect();
          const menuRect = current.getBoundingClientRect();
          current.style.left = `${Math.max(8, Math.min(triggerRect.left, window.innerWidth - menuRect.width - 8))}px`;
          current.style.top = `${
            triggerRect.bottom + menuRect.height + 2 <= window.innerHeight
              ? triggerRect.bottom + 2
              : Math.max(8, triggerRect.top - menuRect.height - 2)
          }px`;
          current.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)')?.focus();
        }}
      >
        {leadingOption ? option(leadingOption.value, leadingOption.label) : null}
        {groups.map((group) =>
          group.label ? (
            <div className="gear-select-group" role="group" aria-label={group.label} key={group.label}>
              <div className="gear-select-group-label">{group.label}</div>
              {group.items.map((item) => option(item, optionLabel(item)))}
            </div>
          ) : (
            <Fragment key="ungrouped-menu">
              {group.items.map((item) => option(item, optionLabel(item)))}
            </Fragment>
          )
        )}
      </div>
    </div>
  );
}

function GearSectionHeading({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
  return (
    <div className="gear-section-heading" hidden={hidden}>
      {children}
    </div>
  );
}

function GearRow({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
  return (
    <div className="gear-row" hidden={hidden}>
      {children}
    </div>
  );
}

interface GearPrefixRowProps {
  readonly app: ProfessionAppState;
  readonly controlId: string;
  readonly hidden?: boolean;
  readonly label: string;
  readonly prefix: string;
  readonly setNumber?: number;
  readonly slot: string | number;
  readonly statSlot: string;
  readonly weapon?: boolean;
}

function GearPrefixRow({
  app,
  controlId,
  hidden,
  label,
  prefix,
  setNumber,
  slot,
  statSlot,
  weapon = false
}: GearPrefixRowProps) {
  return (
    <GearRow hidden={hidden}>
      <span className="gear-label">{label}</span>
      <DetailedSelect
        ariaLabel={`${label} prefix`}
        className={weapon ? 'weapon-prefix' : 'gear-prefix'}
        controlId={controlId}
        dataSet={setNumber}
        dataSlot={slot}
        groups={PREFIX_GROUPS}
        id={weapon ? `sel-stat${setNumber}-${Number(slot) + 1}` : undefined}
        value={prefix}
        optionLabel={(name) => prefixOptionLabel(name, statSlot)}
        onChange={(nextPrefix) => {
          if (weapon && setNumber === 2) app.build.alternateWeaponPrefixes[Number(slot)] = nextPrefix;
          else app.build.gear[weapon ? `Weapon${Number(slot) + 1}` : String(slot)] = nextPrefix;
          app.changed();
        }}
      />
    </GearRow>
  );
}

function WeaponPrefixRows({
  app,
  allowEmpty = false,
  prefixes,
  setNumber,
  weapons
}: {
  app: ProfessionAppState;
  allowEmpty?: boolean;
  prefixes: string[];
  setNumber: number;
  weapons: string[];
}) {
  const twoHanded = app.weaponData[weapons[0]]?.wielding === '2h';
  const unequipped = allowEmpty && !weapons[0];
  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false;

  return (
    <>
      <GearSectionHeading hidden={unequipped}>
        {hasSecondWeaponSet ? `Weapon set ${setNumber}` : 'Weapon'}
      </GearSectionHeading>
      {[0, 1].map((slot) => (
        <GearPrefixRow
          app={app}
          controlId={`weapon-prefix-${setNumber}-${slot}`}
          hidden={unequipped || (twoHanded && slot === 1)}
          label={twoHanded && slot === 0 ? 'Weapon (2H)' : `Weapon ${slot + 1}`}
          prefix={prefixes[slot]}
          setNumber={setNumber}
          slot={slot}
          statSlot={twoHanded && slot === 0 ? 'Weapon2H' : `Weapon${slot + 1}`}
          weapon
          key={slot}
        />
      ))}
    </>
  );
}

/** Renders armor and weapon-prefix rows with stable keys so a recalculation does not replace focused selects. */
function GearSlots({ app }: { app: ProfessionAppState }) {
  const build = app.build;
  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false;

  return (
    <>
      <GearSectionHeading>Equipment</GearSectionHeading>
      {GEAR_SLOTS.filter((slot) => !['Weapon1', 'Weapon2'].includes(slot)).map((slot) => (
        <GearPrefixRow
          app={app}
          controlId={`gear-prefix-${slot}`}
          label={slot === 'Leggins' ? 'Leggings' : slot}
          prefix={build.gear[slot]}
          slot={slot}
          statSlot={slot}
          key={slot}
        />
      ))}
      <WeaponPrefixRows app={app} setNumber={1} weapons={build.weapons} prefixes={[build.gear.Weapon1, build.gear.Weapon2]} />
      {hasSecondWeaponSet ? (
        <WeaponPrefixRows
          app={app}
          setNumber={2}
          weapons={build.alternateWeapons}
          prefixes={build.alternateWeaponPrefixes}
          allowEmpty
        />
      ) : null}
    </>
  );
}

function SetAllPrefixes({ app }: { app: ProfessionAppState }) {
  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false;
  return (
    <>
      <span>Set all</span>
      <DetailedSelect
        ariaLabel="Set all equipment prefixes"
        controlId="set-all"
        groups={PREFIX_GROUPS}
        id="sel-set-all"
        value=""
        placeholder="Choose prefix"
        leadingOption={{ value: '', label: 'Choose prefix' }}
        optionLabel={prefixOptionLabel}
        onChange={(value) => {
          if (!value) return;
          for (const slot of GEAR_SLOTS) app.build.gear[slot] = value;
          if (hasSecondWeaponSet) app.build.alternateWeaponPrefixes = [value, value];
          app.changed();
        }}
      />
    </>
  );
}

function UpgradeRow({
  app,
  groups,
  id,
  label,
  optionLabel,
  value,
  update
}: {
  app: ProfessionAppState;
  groups: readonly OptionGroup[];
  id: string;
  label: string;
  optionLabel: (value: string) => string;
  value: string;
  update: (value: string) => void;
}) {
  return (
    <GearRow>
      <span className="gear-label">{label}</span>
      <DetailedSelect
        ariaLabel={label}
        controlId={id}
        groups={groups}
        id={id}
        value={value}
        optionLabel={optionLabel}
        onChange={(nextValue) => {
          update(nextValue);
          app.changed();
        }}
      />
    </GearRow>
  );
}

/** Renders upgrades and enforces the shared 18-infusion cap when a numeric draft commits. */
function EquipmentInfo({ app }: { app: ProfessionAppState }) {
  const build = app.build;
  return (
    <>
      <GearSectionHeading>Upgrades</GearSectionHeading>
      <UpgradeRow app={app} groups={RUNE_GROUPS} id="sel-rune" label="Rune" optionLabel={runeOptionLabel} value={build.rune} update={(value) => (build.rune = value)} />
      <UpgradeRow app={app} groups={RELIC_GROUPS} id="sel-relic" label="Relic" optionLabel={relicOptionLabel} value={build.relic} update={(value) => (build.relic = value)} />
      <UpgradeRow app={app} groups={FOOD_GROUPS} id="sel-food" label="Food" optionLabel={foodOptionLabel} value={build.food} update={(value) => (build.food = value)} />
      <UpgradeRow app={app} groups={UTILITY_GROUPS} id="sel-utility" label="Utility" optionLabel={utilityOptionLabel} value={build.utility} update={(value) => (build.utility = value)} />
      <GearRow>
        <span className="gear-label">Jade Bot</span>
        <input
          type="checkbox"
          id="chk-jbc"
          className="gear-checkbox"
          checked={build.jadeBotCore}
          onChange={(event) => {
            build.jadeBotCore = event.currentTarget.checked;
            app.changed();
          }}
        />
      </GearRow>
      {build.infusions.map((infusion, index) => (
        <GearRow key={index}>
          <span className="gear-label">Infusion {index + 1}</span>
          <div className="infusion-controls">
            <DraftNumberInput
              className="inf-count"
              data-index={index}
              min={0}
              max={18}
              value={infusion.count}
              onCommit={(draft) => {
                const other = build.infusions.reduce(
                  (sum, candidate, candidateIndex) => (candidateIndex === index ? sum : sum + candidate.count),
                  0
                );
                infusion.count = Math.max(0, Math.min(Number(draft) || 0, 18 - other));
                app.changed();
                return infusion.count;
              }}
            />
            <DetailedSelect
              ariaLabel={`Infusion ${index + 1} attribute`}
              className="inf-stat"
              controlId={`infusion-${index}`}
              dataIndex={index}
              groups={[{ label: '', items: INFUSION_STATS }]}
              value={infusion.stat}
              optionLabel={(stat) => `${stat} (+${INFUSION_BONUS} each)`}
              onChange={(stat) => {
                infusion.stat = stat;
                app.changed();
              }}
            />
          </div>
        </GearRow>
      ))}
      <GearRow>
        <span className="gear-label">Total</span>
        <span className="inf-total">{build.infusions.reduce((sum, infusion) => sum + infusion.count, 0)}/18</span>
      </GearRow>
    </>
  );
}

function WeaponSetRows({
  allowEmpty = false,
  app,
  mainHands,
  offHands,
  setNumber,
  sigils,
  weapons
}: {
  allowEmpty?: boolean;
  app: ProfessionAppState;
  mainHands: readonly string[];
  offHands: readonly string[];
  setNumber: number;
  sigils: string[];
  weapons: string[];
}) {
  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false;
  const twoHanded = app.weaponData[weapons[0]]?.wielding === '2h';
  const unequipped = allowEmpty && !weapons[0];
  const offHandStyle = (twoHanded ? { opacity: 0.4, pointerEvents: 'none' } : undefined) as CSSProperties;

  return (
    <>
      <GearSectionHeading>Weapon set{hasSecondWeaponSet ? ` ${setNumber}` : ''}</GearSectionHeading>
      <GearRow>
        <span className="gear-label">Main hand</span>
        <select
          id={`sel-mh${setNumber}`}
          className="gear-select"
          value={weapons[0]}
          onChange={(event) => {
            const value = event.currentTarget.value;
            weapons[0] = value;
            if (!value) {
              weapons[1] = '';
              app.build.startingWeaponSet = 1;
              app.attributeWeaponSet = 1;
            } else if (app.weaponData[value]?.wielding === '2h') {
              weapons[1] = '';
            } else if (!weapons[1]) {
              weapons[1] = app.adapter.defaultOffhand({ mainHand: value, offHands }) || offHands[0] || '';
            }

            app.changed();
          }}
        >
          {allowEmpty ? <option value="">None</option> : null}
          {mainHands.map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
        </select>
      </GearRow>
      <div style={offHandStyle} hidden={unequipped}>
        <GearRow>
          <span className="gear-label">Off hand</span>
          <select
            id={`sel-oh${setNumber}`}
            className="gear-select"
            value={weapons[1]}
            onChange={(event) => {
              weapons[1] = event.currentTarget.value;
              app.changed();
            }}
          >
            {offHands.map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
          </select>
        </GearRow>
      </div>
      <div hidden={unequipped}>
        {[0, 1].map((slot) => (
          <GearRow key={slot}>
            <span className="gear-label">Sigil {slot + 1}</span>
            <DetailedSelect
              ariaLabel={`Weapon set ${setNumber} sigil ${slot + 1}`}
              controlId={`sigil-${setNumber}-${slot}`}
              groups={SIGIL_GROUPS}
              id={`sel-sig${setNumber}-${slot + 1}`}
              value={sigils[slot]}
              disabledOption={(name) => name === sigils[slot === 0 ? 1 : 0]}
              optionLabel={sigilOptionLabel}
              onChange={(value) => {
                setWeaponSigil(app.build, setNumber - 1, slot, value);
                app.changed();
              }}
            />
          </GearRow>
        ))}
      </div>
    </>
  );
}

/** Renders weapon and sigil selectors through their existing build normalization operations. */
function WeaponSelection({ app }: { app: ProfessionAppState }) {
  const build = app.build;
  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false;
  const mainHands = Object.entries(app.weaponData)
    .filter(([, data]) => ['mh', 'mh+oh', '2h'].includes(data.wielding))
    .map(([name]) => name);
  const offHands = Object.entries(app.weaponData)
    .filter(([, data]) => ['oh', 'mh+oh'].includes(data.wielding))
    .map(([name]) => name);

  return (
    <>
      <WeaponSetRows app={app} setNumber={1} weapons={build.weapons} sigils={build.weaponSigils[0]} mainHands={mainHands} offHands={offHands} />
      {hasSecondWeaponSet ? (
        <WeaponSetRows app={app} setNumber={2} weapons={build.alternateWeapons} sigils={build.weaponSigils[1]} mainHands={mainHands} offHands={offHands} allowEmpty />
      ) : null}
    </>
  );
}

/** Retains the build-editor entry point while four stable React roots replace all gear HTML injection and binding. */
export function renderGear(app: ProfessionAppState): void {
  renderReact(requiredElement('gear-set-all'), <SetAllPrefixes app={app} />);
  renderReact(requiredElement('gear-slots'), <GearSlots app={app} />);
  renderReact(requiredElement('equipment-info'), <EquipmentInfo app={app} />);
  renderReact(requiredElement('weapon-select'), <WeaponSelection app={app} />);
}
