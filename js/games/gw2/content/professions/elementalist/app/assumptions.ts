import { createProfessionAssumptionControls } from '#gw2/app/profession/assumptions.js';

/**
 * Elementalist-only simulation assumptions offered in the build editor. Target hitbox
 * matters here because several Elementalist skills land far fewer packets on a small
 * target; the choice is persisted on the build and read by the hitbox event handler.
 */
export const ELEMENTALIST_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  {
    key: 'hitboxSize',
    label: 'Target hitbox',
    type: 'select',
    defaultValue: 'small',
    options: [
      { value: 'large', label: 'Large' },
      { value: 'small', label: 'Small' }
    ],
    section: 'target'
  }
]);
