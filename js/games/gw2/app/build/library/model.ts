import type { BuildTemplatePreset, BuildTemplateSection } from '#gw2/app/build/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

/** Derives catalog labels and filters without loading assets or depending on the library DOM. */
type TemplateCategory = 'power' | 'condi' | 'other';
export type TemplateFilter = 'all' | Exclude<TemplateCategory, 'other'>;
type TemplateBoon = 'alacrity' | 'quickness' | 'none';
export type TemplateBoonFilter = 'all' | Exclude<TemplateBoon, 'none'>;

export const TEMPLATE_FILTERS: readonly TemplateFilter[] = ['all', 'power', 'condi'];
export const TEMPLATE_BOON_FILTERS: readonly TemplateBoonFilter[] = ['all', 'alacrity', 'quickness'];

export function templateSpecializations(manifest: readonly BuildTemplateSection[]): string[] {
  // Manifest sections represent active specializations, so they can drive the filter without loading every build file.
  return [...new Set(manifest.map(({ section }) => section))];
}

export function templateTileContent(preset: BuildTemplatePreset): {
  name: string;
  weapons: string;
  dps: string;
} {
  // Split manifest labels into role, weapons, and benchmark text so every tile keeps the requested visual hierarchy.
  const category = templateCategory(preset);
  const boon = templateBoon(preset);
  const weaponMatch = preset.label.match(/\(([^()]*)\)/);
  const detailsStart = weaponMatch?.index ?? preset.label.length;
  const name =
    category === 'other'
      ? preset.label
          .slice(0, detailsStart)
          .replace(/\s*-\s*$/, '')
          .trim()
      : `${category === 'condi' ? 'Condition' : 'Power'}${boon === 'none' ? '' : ` ${boon[0].toUpperCase()}${boon.slice(1)}`}`;
  const roleSuffix = preset.label
    .slice(name.length, detailsStart)
    .replace(/\s*-\s*$/, '')
    .trim();
  const weapons = (weaponMatch?.[1].match(/^\d+\s+Kits?$/i) ? roleSuffix : weaponMatch?.[1] || roleSuffix).replace(
    /\s*\/\s*/g,
    ' & '
  );
  const benchmarkDps = Number(preset.benchmarkDps);
  // Keep trailing variant labels visible so builds with the same weapons remain distinguishable.
  const variant = weaponMatch ? preset.label.slice(detailsStart + weaponMatch[0].length).trim() : '';
  // Keep Inferno visible beside the weapons so power presets remain distinguishable in the picker.
  const inferno = category === 'power' && /\binferno\b/i.test(`${preset.label} ${preset.build}`);

  return {
    name,
    weapons: [inferno ? 'Inferno' : '', weapons, variant].filter(Boolean).join(' '),
    dps:
      Number.isFinite(benchmarkDps) && benchmarkDps > 0 ? `${Math.round(benchmarkDps).toLocaleString('en-US')} DPS` : ''
  };
}

export function templateCategory(preset: Pick<BuildTemplatePreset, 'label' | 'build'>): TemplateCategory {
  const description = `${preset.label} ${preset.build}`.toLowerCase();
  // Inferno presets use power gear but omit the damage type from their display name.
  if (/\b(?:power|inferno)\b|\/b-power-/.test(description)) return 'power';
  if (/\b(?:condi|condition)\b|\/b-condi(?:tion)?-/.test(description)) {
    return 'condi';
  }

  return 'other';
}

export function templateBoon(preset: Pick<BuildTemplatePreset, 'label' | 'build'>): TemplateBoon {
  // Template names encode support roles, so the selector can filter them without loading every build asset.
  const description = `${preset.label} ${preset.build}`.toLowerCase();
  if (/\balacrity\b|[-/]alac-/.test(description)) return 'alacrity';
  if (/\bquickness\b|[-/]quick-/.test(description)) return 'quickness';
  return 'none';
}

export function isTemplateFilter(value: string | undefined): value is TemplateFilter {
  return TEMPLATE_FILTERS.includes(value as TemplateFilter);
}

export function isTemplateBoonFilter(value: string | undefined): value is TemplateBoonFilter {
  return TEMPLATE_BOON_FILTERS.includes(value as TemplateBoonFilter);
}

export function buildSignature(build: Gw2CanonicalBuild): string {
  return JSON.stringify(build);
}
