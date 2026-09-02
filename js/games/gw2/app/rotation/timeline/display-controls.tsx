import { useState } from 'react';
import { rotationDeadTimeVisibility, setRotationDeadTimeVisibility } from '#gw2/app/rotation/timeline/size.js';
import { storeRotationProcOverlayVisibility } from '#gw2/app/rotation/timeline/proc-overlays.js';
import { activeSpecialization } from '#gw2/app/rotation/shared/context.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { renderTimeline } from '#gw2/app/rotation/timeline/view.js';

interface CheckboxControlProps {
  readonly checked: boolean;
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly onChange: (checked: boolean) => void;
}

function CheckboxControl({ checked, id, label, title, onChange }: CheckboxControlProps) {
  return (
    <label className='boon-control' htmlFor={id} title={title}>
      <input id={id} type='checkbox' checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      {label}
    </label>
  );
}

interface RotationDisplayControlsProps {
  readonly app: ProfessionAppState;
}

/** Keeps timeline-only display preferences inside the React-owned Simulation Config subtree. */
export function RotationDisplayControls({ app }: RotationDisplayControlsProps) {
  const [open, setOpen] = useState(true);
  const [showDeadTime, setShowDeadTime] = useState(() => rotationDeadTimeVisibility(document));
  const [overlaySigils, setOverlaySigils] = useState(Boolean(app.overlaySigilProcs));
  const [overlayRelics, setOverlayRelics] = useState(Boolean(app.overlayRelicProcs));
  const [overlaySovereignOfLight, setOverlaySovereignOfLight] = useState(Boolean(app.overlaySovereignOfLightProcs));

  return (
    <details
      id='rotation-display-controls'
      className='perma-group'
      data-assumption-section='timeline-display'
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className='perma-group-label'>Timeline Display</summary>
      <div className='perma-group-content'>
        <CheckboxControl
          id='rotation-show-dead-time'
          label='Display idle time'
          title='Show time between skills when no skill cast is active'
          checked={showDeadTime}
          onChange={(checked) => {
            setShowDeadTime(checked);
            setRotationDeadTimeVisibility(document, checked);
          }}
        />
        <CheckboxControl
          id='rotation-overlay-sigil-procs'
          label='Overlay sigils'
          title='Show sigil activations at their simulated positions in the rotation'
          checked={overlaySigils}
          onChange={(checked) => {
            setOverlaySigils(checked);
            app.overlaySigilProcs = checked;
            storeRotationProcOverlayVisibility(document, 'sigil', checked);
            renderTimeline(app);
          }}
        />
        <CheckboxControl
          id='rotation-overlay-relic-procs'
          label='Overlay relics'
          title='Show relic activations at their simulated positions in the rotation'
          checked={overlayRelics}
          onChange={(checked) => {
            setOverlayRelics(checked);
            app.overlayRelicProcs = checked;
            storeRotationProcOverlayVisibility(document, 'relic', checked);
            renderTimeline(app);
          }}
        />
        {activeSpecialization(app) === 'Luminary' ? (
          <CheckboxControl
            id='rotation-overlay-sovereign-of-light-procs'
            label='Overlay Sovereign of Light'
            title='Show Sovereign of Light activations at their simulated positions in the rotation'
            checked={overlaySovereignOfLight}
            onChange={(checked) => {
              setOverlaySovereignOfLight(checked);
              app.overlaySovereignOfLightProcs = checked;
              storeRotationProcOverlayVisibility(document, 'sovereignOfLight', checked);
              renderTimeline(app);
            }}
          />
        ) : null}
      </div>
    </details>
  );
}
