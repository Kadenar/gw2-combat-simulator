import { bindBuildTemplateImportDialog } from '#gw2/app/build/io/build-template-import-dialog.js';
import { initBuildTemplates, updateTemplateSelection } from '#gw2/app/build/panels/presets.js';
import type { BuildEditor } from '#app/shell/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

type BuildPanelId = 'gear' | 'traits' | 'attributes' | 'skills' | 'assumptions';
type BuildPanelRenderers = Readonly<Record<BuildPanelId, (app: ProfessionAppState) => void>>;

let buildPanelRenderers: BuildPanelRenderers | null = null;
let buildPanelPromise: Promise<BuildPanelRenderers> | null = null;

/** Loads browser-only React panels during editor initialization without adding them to simulation worker graphs. */
function loadBuildPanels(): Promise<BuildPanelRenderers> {
  buildPanelPromise ||= Promise.all([
    import('#gw2/app/build/panels/gear.js'),
    import('#gw2/app/build/panels/traits.js'),
    import('#gw2/app/build/panels/attributes.js'),
    import('#gw2/app/build/panels/skills.js'),
    import('#gw2/app/build/panels/assumptions.js')
  ]).then(([gear, traits, attributes, skills, assumptions]) => {
    buildPanelRenderers = {
      gear: gear.renderGear,
      traits: traits.renderTraits,
      attributes: attributes.renderAttributes,
      skills: skills.renderSkills,
      assumptions: assumptions.renderAssumptions
    };
    return buildPanelRenderers;
  });
  return buildPanelPromise;
}

function renderBuildPanel(id: BuildPanelId, app: ProfessionAppState): void {
  if (buildPanelRenderers) buildPanelRenderers[id](app);
  else void loadBuildPanels().then((renderers) => renderers[id](app));
}

/** Supplies the existing GW2 editor sections through the game-neutral contribution contract. */
export const gw2BuildEditor: BuildEditor<ProfessionAppState> = Object.freeze({
  sections: Object.freeze([
    {
      id: 'gear',
      render: (app: ProfessionAppState) => renderBuildPanel('gear', app)
    },
    {
      id: 'traits',
      render: (app: ProfessionAppState) => renderBuildPanel('traits', app)
    },
    {
      id: 'attributes',
      render: (app: ProfessionAppState) => renderBuildPanel('attributes', app)
    },
    {
      id: 'skills',
      render: (app: ProfessionAppState) => renderBuildPanel('skills', app)
    },
    {
      id: 'assumptions',
      render: (app: ProfessionAppState) => renderBuildPanel('assumptions', app)
    }
  ]),
  async initialize(app: ProfessionAppState) {
    await Promise.all([initBuildTemplates(app), loadBuildPanels()]);
  },
  updateSelection: updateTemplateSelection,
  bindControls(app: ProfessionAppState) {
    // Keep in-game build import beside the remaining build choices after removing the preview-only combat layout.
    const title = document.querySelector<HTMLElement>('.selectable-skills-title');
    if (!title) throw new Error('Selectable skills header is missing.');
    if (title.querySelector('.build-template-import')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-io build-template-import';
    button.textContent = 'Import GW2 Build';
    title.append(button);
    bindBuildTemplateImportDialog(app, button);
  }
});
