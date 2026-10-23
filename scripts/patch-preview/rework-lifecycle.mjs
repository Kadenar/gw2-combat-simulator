import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Keep temporary rework ownership visible so promotion removes registrations as well as behavior. */
export function reworkChecklist(profession, tooltips, patch) {
  return (patch.reworks ?? []).map((id) => {
    const module = profession.nativeDefinition.moduleVariants?.[id];
    const descriptions = tooltips.reworks?.[id];

    if (!module || !descriptions) throw new Error(`Missing rework module or tooltip map: ${id}`);

    return `${id}: moduleVariants[${id}] replaces ${module.id}; ${profession.id}/app/tooltips.ts reworks[${id}] (${Object.keys(descriptions.traits).length} traits, ${Object.keys(descriptions.skills ?? {}).length} skills)`;
  });
}

/** Source markers identify live extension points that cannot be discovered from compiled module metadata. */
export async function reworkExtensionPoints(sourceRoot) {
  const files = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
  const points = [];
  for (const entry of files) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;

    const file = path.join(entry.parentPath, entry.name);
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      const match = /Rework extension point \(([^)]+)\)/.exec(line);

      if (match)
        points.push({
          variant: match[1],
          file: path.relative(sourceRoot, file).replaceAll('\\', '/'),
          line: index + 1
        });
    }
  }

  return points.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** Unpublished assumptions must be resolved before a preview can become the live patch. */
export function assertPromotionReady(preview) {
  const remaining = Object.entries(preview.professions ?? {}).flatMap(([id, patch]) =>
    (patch.provisional ?? []).map((control) => `${id}.${control.id}`)
  );

  if (remaining.length) throw new Error(`Promotion blocked by provisional controls: ${remaining.join(', ')}`);
}
