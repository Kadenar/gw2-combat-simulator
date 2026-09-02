import { Fragment, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { gw2ApiText } from '#gw2/app/presentation/shared/html.js';
import { renderReact } from '#ui/react-root.js';
import { requiredElement } from '#ui/shared/dom.js';

import type { ProfessionAppState, ProfessionSpecialization } from '#gw2/app/types.js';

const SPEC_BG = (name: string): string =>
  `https://wiki.guildwars2.com/wiki/Special:FilePath/${encodeURIComponent(name)}_specialization.png`;

/** Clamps every persisted starting resource after a specialization changes its available resource views. */
export function clampStartingResourceValues(app: ProfessionAppState, specialization: string): void {
  for (const definition of app.resourceDefinitions(specialization)) {
    const buildKey = definition.buildKey || 'initialResource';
    const value = Number(app.build[buildKey]);
    if (Number.isFinite(value)) {
      app.build[buildKey] = Math.min(value, definition.startMaximum ?? definition.maximum);
    }
  }
}

/** Applies one picker choice while keeping specialization lines unique and limiting the build to one elite line. */
export function selectSpecialization(app: ProfessionAppState, line: number, name: string): void {
  const specializations = app.specializations as unknown as readonly ProfessionSpecialization[];
  const current = app.build.specializations[line];
  const selected = specializations.find((specialization) => specialization.name === name);
  if (
    !Number.isInteger(line) ||
    !current ||
    !selected ||
    current.name === name ||
    app.build.specializations.some((specialization, index) => index !== line && specialization.name === name)
  ) {
    return;
  }

  app.build.specializations[line] = { name, traits: '1-1-1' };
  if (selected.elite) {
    app.build.specializations.forEach((specialization, index) => {
      if (index === line) return;
      if (specializations.find((candidate) => candidate.name === specialization.name)?.elite) {
        app.build.specializations[index] = {
          name: app.adapter.specializationFallback,
          traits: '1-1-1'
        };
      }
    });
  }

  clampStartingResourceValues(app, app.adapter.eliteSpecialization(app.build));
  app.changed();
}

interface SpecializationRowProps {
  readonly app: ProfessionAppState;
  readonly lineIndex: number;
  readonly specializations: readonly ProfessionSpecialization[];
}

/** Keeps each picker stable while trait and specialization choices commit through the mutable build model. */
function SpecializationRow({ app, lineIndex, specializations }: SpecializationRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selection = app.build.specializations[lineIndex];
  const spec = specializations.find((candidate) => candidate.name === selection?.name) ?? specializations[0];
  if (!selection || !spec) return null;

  const selectedNames = app.build.specializations.map((candidate) => candidate.name);
  const picks = selection.traits.split('-').map(Number);
  const style = { '--spec-bg': `url('${SPEC_BG(spec.name)}')` } as CSSProperties;
  const selectTrait = (tier: number, pick: number): void => {
    const nextPicks = selection.traits.split('-');
    nextPicks[tier] = String(pick);
    selection.traits = nextPicks.join('-');
    app.changed();
  };

  const onTraitKeyDown = (event: KeyboardEvent<HTMLElement>, tier: number, pick: number): void => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    selectTrait(tier, pick);
  };

  return (
    <div className="spec-row" style={style}>
      <div className="spec-bg" />
      <div className="spec-content">
        <details
          className="spec-picker"
          open={pickerOpen}
          onToggle={(event) => setPickerOpen(event.currentTarget.open)}
        >
          <summary
            className="spec-picker-trigger"
            aria-label={`Change ${spec.name} specialization`}
            title="Change specialization"
          />
          <div className="spec-picker-menu">
            <strong>Select specialization</strong>
            <div className="spec-picker-options">
              {specializations.map((candidate) => {
                const selected = candidate.name === selection.name;
                return (
                  <button
                    type="button"
                    className={`spec-picker-option${selected ? ' is-selected' : ''}`}
                    key={candidate.name}
                    data-line={lineIndex}
                    data-specialization={candidate.name}
                    aria-pressed={selected}
                    aria-label={candidate.name}
                    title={candidate.name}
                    disabled={selectedNames.includes(candidate.name)}
                    onClick={() => {
                      setPickerOpen(false);
                      selectSpecialization(app, lineIndex, candidate.name);
                    }}
                  >
                    <img src={candidate.icon} alt="" />
                    <span>{candidate.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </details>
        <div className="spec-heading">{spec.name}</div>
        <div className="spec-selection">
          <img className="spec-selected-icon" src={spec.icon} alt="" />
          <div className="spec-tiers">
            {[0, 1, 2].map((tier) => {
              const minor = spec.minorTraits[tier];
              return (
                <Fragment key={tier}>
                  {tier ? <span className={`spec-line pick-${picks[tier - 1]}`} /> : null}
                  <div className={`spec-tier pick-${picks[tier]}`}>
                    <div className="spec-trait-minor" title={`${minor.name}\n${gw2ApiText(minor.description)}`}>
                      <img src={minor.icon} alt="" />
                    </div>
                    <div className="spec-trait-majors">
                      {spec.majorTraits[tier].map((trait, position) => {
                        const pick = position + 1;
                        const selected = picks[tier] === pick;
                        return (
                          <div
                            className={`spec-trait-major ${selected ? 'sel' : 'dim'}`}
                            key={trait.id ?? trait.name}
                            data-line={lineIndex}
                            data-tier={tier}
                            data-pick={pick}
                            title={`${trait.name}\n${gw2ApiText(trait.description)}`}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            onClick={() => selectTrait(tier, pick)}
                            onKeyDown={(event) => onTraitKeyDown(event, tier, pick)}
                          >
                            <img src={trait.icon} alt="" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Retains the build-editor contract while making React the sole owner of the trait panel. */
export function renderTraits(app: ProfessionAppState): void {
  const specializations = app.specializations as unknown as readonly ProfessionSpecialization[];
  renderReact(
    requiredElement('traits-panel'),
    <>
      {app.build.specializations.map((_, lineIndex) => (
        <SpecializationRow
          app={app}
          lineIndex={lineIndex}
          specializations={specializations}
          key={lineIndex}
        />
      ))}
    </>
  );
}
