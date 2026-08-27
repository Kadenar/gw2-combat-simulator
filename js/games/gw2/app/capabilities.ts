import type { Gw2AppCapabilities, ProfessionAppState } from './types.js';

const patchPreview = () => import('../integrations/patches/view.js');

/** Keeps optional GW2 analysis, preview, and import tools out of the shared shell contract. */
export const gw2AppCapabilities: Gw2AppCapabilities = Object.freeze({
  modifierContributions: true,
  randomDistribution: true,
  relicComparison: true,
  patchPreview: Object.freeze({
    async mount(app: ProfessionAppState) {
      const { mountPatchPreviewControls } = await patchPreview();
      mountPatchPreviewControls(app);
    },
    async render(container: HTMLElement, app: ProfessionAppState) {
      const { renderPatchComparison } = await patchPreview();
      renderPatchComparison(container, app);
    }
  }),
  keybindImport: Object.freeze({
    label: 'Import GW2 XML',
    accept: '.xml,application/xml,text/xml',
    async parse(source: string) {
      const { parseGw2HotkeyBindingsXml } = await import('../integrations/keybinds/parser.js');
      return parseGw2HotkeyBindingsXml(source);
    }
  })
});
