/** Copies mutable preview inputs and retains shared catalogs and calculation owners. */
import { buildContextInput } from '#gw2/app/build/isolated-preview.js';
import type { AttributePreviewInput } from '#gw2/app/build/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { cloneData } from '#kernel/core/clone.js';

export type SkillDamageInput = AttributePreviewInput & Pick<ProfessionAppState, 'gameId' | 'contentId' | 'weaponData'>;

/** Skip unavailable attributes and omit rotation commands, which do not affect isolated damage. */
export function captureSkillDamageInput(source: SkillDamageInput): SkillDamageInput | null {
  if (!source.attributeData) return null;

  const context = buildContextInput(source);
  return {
    gameId: source.gameId,
    contentId: source.contentId,
    build: cloneData({ ...context.build, rotation: [] }),
    patch: context.patch,
    simulationSettings: { transitionDelays: context.transitionDelays },
    adapter: source.adapter,
    profession: source.profession,
    activeCatalog: source.activeCatalog,
    weaponData: source.weaponData,
    attributeData: { activeTraits: [...source.attributeData.activeTraits] }
  };
}
