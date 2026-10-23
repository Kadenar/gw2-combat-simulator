import {
  DEFAULT_FRACTAL_BUFFS,
  FRACTAL_AUGMENTATIONS,
  validateFractalBuffs,
  type FractalBuffs
} from '#gw2/app/optimizer/gear/fractal-buffs.js';

/** Optimizer-local controls assume maximum mastery and full potion stacks. */
export function renderFractalControls(buffs: FractalBuffs = { ...DEFAULT_FRACTAL_BUFFS }): string {
  const select = (key: 'augmentation', label: string, choices: Record<string, { label: string }>) =>
    `<label class="optimizer-infusion-count">${label}<select name="fractal-${key}" data-fractal>${Object.entries(
      choices
    )
      .map(
        ([value, choice]) =>
          `<option value="${value}"${buffs[key] === value ? ' selected' : ''}>${choice.label}</option>`
      )
      .join('')}</select></label>`;
  return `<details class="optimizer-section optimizer-disclosure"${buffs.enabled ? ' open' : ''}><summary>Fractal buffs${buffs.enabled ? ' (enabled)' : ''}</summary>
    <label><input type="checkbox" name="fractal-enabled" data-fractal${buffs.enabled ? ' checked' : ''}> Enable fractal buffs</label>
    <p>Applies to this optimizer search and its previews. Assumes maximum mastery and 5 stacks of each potion.</p>
    <div class="optimizer-pair">
      <label class="optimizer-infusion-count">Total agony resistance<input name="fractal-agonyResistance" data-fractal type="number" min="0" max="${Number.MAX_SAFE_INTEGER}" step="1" required value="${buffs.agonyResistance}"></label>
      ${select('augmentation', 'Account augmentation', FRACTAL_AUGMENTATIONS)}
    </div><p>Enter total AR inside fractals, including augmentation and temporary bonuses.</p>
  </details>`;
}

/** Capture the search environment separately from the saved build. */
export function readFractalControls(form: HTMLFormElement): FractalBuffs {
  const data = new FormData(form);
  const buffs = {
    enabled: data.has('fractal-enabled'),
    agonyResistance: Number(data.get('fractal-agonyResistance')),
    augmentation: data.get('fractal-augmentation')
  };
  validateFractalBuffs(buffs);
  return buffs;
}
