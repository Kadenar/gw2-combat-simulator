import { professionRegistry } from '#gw2/app/profession-registry.js';
import { decodeGw2BuildTemplate, resolveGw2BuildTemplate } from '#gw2/platform/builds/templates/codec.js';
import { replaceBuildConfiguration } from '#gw2/app/build/state/persistence.js';

import type { Gw2BuildTemplateWeaponSet, ResolvedGw2BuildTemplate } from '#gw2/platform/builds/templates/codec.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

interface BuildTemplateProfession {
  readonly code: number;
  readonly id: string;
  readonly name: string;
  readonly route: string;
}

// Derive import identities from the registry so mismatch links use the same names and routes as navigation.
const BUILD_TEMPLATE_PROFESSIONS: Readonly<Record<string, BuildTemplateProfession>> = Object.freeze(
  Object.fromEntries(
    professionRegistry.map(({ buildTemplateCode: code, id, name, route }) => [id, { code, id, name, route }])
  )
);
const BUILD_TEMPLATE_PROFESSIONS_BY_CODE = new Map(
  Object.values(BUILD_TEMPLATE_PROFESSIONS).map((profession) => [profession.code, profession])
);

export class BuildTemplateProfessionMismatchError extends Error {
  readonly actualProfession: BuildTemplateProfession;

  constructor(actualProfession: BuildTemplateProfession, currentProfession: BuildTemplateProfession) {
    super(
      `This build code is for ${actualProfession.name}. You are currently viewing the ${currentProfession.name} simulator.`
    );
    this.name = 'BuildTemplateProfessionMismatchError';
    this.actualProfession = actualProfession;
  }
}

function currentProfession(app: ProfessionAppState): BuildTemplateProfession {
  const profession = BUILD_TEMPLATE_PROFESSIONS[app.adapter.id];
  if (!profession) {
    throw new Error(`${app.adapter.id} does not support GW2 build templates.`);
  }

  return profession;
}

/** Returns the resolver's frozen selections for review without changing application state. */
export function previewBuildTemplateCode(app: ProfessionAppState, chatCode: string): ResolvedGw2BuildTemplate {
  const current = app.build as ProfessionAppState['build'] & {
    readonly startAttunement?: string;
  };
  const expectedProfession = currentProfession(app);
  const decoded = decodeGw2BuildTemplate(chatCode);
  const actualProfession = BUILD_TEMPLATE_PROFESSIONS_BY_CODE.get(decoded.professionCode);
  if (actualProfession && actualProfession.code !== expectedProfession.code) {
    throw new BuildTemplateProfessionMismatchError(actualProfession, expectedProfession);
  }

  return resolveGw2BuildTemplate(decoded, {
    catalog: app.activeCatalog,
    expectedProfession,
    preferredAttunement: String(current.startAttunement || 'Fire')
  });
}

/** Applies a previously reviewed preview while retaining gear stats and rotation. */
export function applyBuildTemplatePreview(
  app: ProfessionAppState,
  preview: ResolvedGw2BuildTemplate,
  weapons: Gw2BuildTemplateWeaponSet | null = preview.weapons
): readonly string[] {
  const current = app.build;
  app.build = replaceBuildConfiguration(
    {
      ...current,
      ...(weapons ? { weapons: [...weapons] } : {}),
      specializations: [...preview.specializations],
      selectedSkills: {
        ...current.selectedSkills,
        ...preview.selectedSkills
      }
    },
    current,
    app.adapter
  );
  app.changed();
  return preview.warnings;
}
