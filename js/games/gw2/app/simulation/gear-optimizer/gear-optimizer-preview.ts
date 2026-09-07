import { readAttributePreviewValues, renderAttributeStats } from '#gw2/app/build/panels/attributes.js';
import { getProfessionEntry } from '#gw2/app/profession/registry.js';
import { escapeHtml } from '#gw2/app/presentation/shared/html.js';
import { ARMOR_ICONS, EQUIPMENT_ICONS, GEAR_ICONS } from '#gw2/platform/equipment/icons.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/catalog.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';
import {
  optimizerWeaponSets,
  type GearOptimizerRequest,
  type OptimizerCandidate
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Inspect a captured candidate using the same attribute calculation as Workspace, without equipping or saving it. */
export function renderOptimizerPreview(
  container: HTMLElement,
  app: ProfessionAppState,
  request: GearOptimizerRequest,
  candidate: OptimizerCandidate,
  weaponSet = request.build.startingWeaponSet
): void {
  const attributePreview = readAttributePreviewValues(container);
  const build = structuredClone({ ...request.build, ...candidate.equipment });
  const activeCatalog = app.profession.catalogFor?.(request.patchId) || app.profession.catalog;
  const preview = {
    ...app,
    build,
    patchId: request.patchId,
    activeCatalog,
    skillByName: activeCatalog.skillsByName,
    skillById: activeCatalog.skillsById,
    attributeWeaponSet: weaponSet,
    results: null
  } as ProfessionAppState;
  app.adapter.recalculate(preview);
  const specialization = app.adapter.eliteSpecialization(build);
  const entry = getProfessionEntry(app.adapter.id);
  const artwork = entry?.specializationArtwork?.find(({ name }) => name === specialization)?.conceptArt;
  const sets = optimizerWeaponSets(build, app.adapter);
  // Icons identify slots visually; accessible names and tooltips retain the complete equipment configuration.
  const item = (
    label: string,
    value: string,
    icon?: string,
    upgrades: readonly { label: string; value: string; icon?: string }[] = []
  ): string => {
    const description = `${label}: ${value || 'None'}${upgrades.map((upgrade) => `; ${upgrade.label}: ${upgrade.value || 'None'}`).join('')}`;
    return `<div class="optimizer-preview-item" role="group" aria-label="${escapeHtml(description)}" title="${escapeHtml(description)}" tabindex="0">
      ${icon ? `<img class="optimizer-preview-item-icon" src="${escapeHtml(icon)}" alt="" width="60" height="60" loading="lazy">` : ''}
      <div><strong>${escapeHtml(value || 'None')}</strong>${upgrades
        .map(
          (upgrade) =>
            `<span class="optimizer-preview-upgrade">${upgrade.icon ? `<img src="${escapeHtml(upgrade.icon)}" alt="" width="16" height="16" loading="lazy">` : ''}${escapeHtml(upgrade.value || 'None')}</span>`
        )
        .join('')}</div></div>`;
  };

  // Keep section names available to assistive technology without repeating them above the gear.
  const card = (title: string, items: string): string =>
    `<section class="optimizer-preview-card" aria-label="${title}">${items}</section>`;
  const armor = ['Helm', 'Shoulders', 'Chest', 'Gloves', 'Leggins', 'Boots']
    .map((slot) =>
      item(slot === 'Leggins' ? 'Leggings' : slot, build.gear[slot], ARMOR_ICONS[entry!.armorWeight][slot], [
        { label: 'Rune', value: build.rune, icon: EQUIPMENT_ICONS[build.rune] }
      ])
    )
    .join('');
  // Two-handed weapons hold both sigils; dual-wielded weapons each show their own upgrade.
  const weapons = sets
    .map((set) => {
      const names = set === 0 ? build.weapons : build.alternateWeapons;
      const prefixes = set === 0 ? [build.gear.Weapon1, build.gear.Weapon2] : build.alternateWeaponPrefixes;
      const twoHanded = app.weaponData[names[0]]?.wielding === '2h';
      return `<div class="optimizer-preview-weapon-group" role="group" aria-label="Weapon set ${set + 1}">${names
        .flatMap((name, slot) =>
          !name || (slot === 1 && twoHanded)
            ? []
            : [
                item(
                  name,
                  prefixes[slot],
                  GEAR_ICONS[name],
                  (twoHanded ? [0, 1] : [slot]).map((sigilSlot) => {
                    const value = build.weaponSigils[set][sigilSlot];
                    return { label: `Sigil ${sigilSlot + 1}`, value, icon: SIGIL_DATA[value]?.icon };
                  })
                )
              ]
        )
        .join('')}</div>`;
    })
    .join('');
  const trinkets = ['Back', 'Accessory1', 'Accessory2', 'Amulet', 'Ring1', 'Ring2']
    .map((slot) => item(slot.replace(/(\d)$/, ' $1'), build.gear[slot], GEAR_ICONS[slot.replace(/\d$/, '')]))
    .join('');
  const upgrades =
    item('Relic', build.relic, (RELIC_DATA as Record<string, { icon?: string }>)[build.relic]?.icon) +
    item('Food', build.food, EQUIPMENT_ICONS[build.food]) +
    item('Utility', build.utility, EQUIPMENT_ICONS[build.utility]);
  const infusions =
    build.infusions
      .filter(({ count }) => count)
      .map(({ stat, count }) => item('Infusions', `${count} × ${stat}`))
      .join('') || item('Infusions', 'None');
  container.hidden = false;
  container.innerHTML = `<div class="optimizer-preview-heading"><div class="optimizer-preview-title"><h3>Result character</h3><span>Preview only</span></div><strong>${candidate.score.dps.toFixed(2)} DPS</strong></div>
    ${candidate.score.warnings.length ? `<p class="optimizer-preview-note" role="status">${candidate.score.warnings.map(escapeHtml).join('<br>')}</p>` : ''}
    <div class="optimizer-character">
      <div class="optimizer-preview-equipment">${card('Armor', armor)}${card('Weapons', weapons)}</div>
      <div class="optimizer-preview-portrait">${artwork ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(specialization)} artwork" width="600" height="600">` : ''}</div>
      <div class="optimizer-preview-details">${card('Stats', `<label class="optimizer-preview-weapon-set"${sets.length < 2 ? ' hidden' : ''}>Weapon set <select aria-label="Preview weapon set">${sets.map((set) => `<option value="${set + 1}"${set + 1 === weaponSet ? ' selected' : ''}>${set + 1}</option>`).join('')}</select></label><div class="optimizer-preview-attributes"></div>`)}
      ${card('Trinkets', `<div class="optimizer-preview-trinkets">${trinkets}</div>`)}${card('Upgrades &amp; consumables', upgrades)}${card('Infusions', infusions)}</div>
    </div>`;
  renderAttributeStats(
    container.querySelector<HTMLElement>('.optimizer-preview-attributes')!,
    preview,
    attributePreview
  );
  container.querySelector<HTMLSelectElement>('select')!.addEventListener('change', (event) => {
    renderOptimizerPreview(container, app, request, candidate, Number((event.target as HTMLSelectElement).value));
    container.querySelector<HTMLSelectElement>('select')!.focus();
  });
}
