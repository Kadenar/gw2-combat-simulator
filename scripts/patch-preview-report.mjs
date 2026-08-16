import { activePatchPreview } from "../dist/js/patches/active-preview.js";
import { loadProfession } from "../dist/js/app/profession/registry.js";

if (!activePatchPreview) {
  console.log("No active patch preview is authored.");
  process.exit(0);
}

console.log(
  `Patch preview: ${activePatchPreview.label} (${activePatchPreview.id})`,
);
for (const [professionId, patch] of Object.entries(
  activePatchPreview.professions || {},
)) {
  const profession = await loadProfession(professionId);
  if (!profession) {
    throw new Error(`Unknown patch-preview profession ${professionId}.`);
  }
  profession.catalogFor?.(activePatchPreview.id);
  console.log(`\n${profession.name}`);
  for (const key of Object.keys(patch.skills || {})) {
    const numericId = /^\d+$/.test(key) ? Number(key) : null;
    const skill =
      profession.catalog.skillsById.get(key) ||
      (numericId == null
        ? null
        : profession.catalog.skillsById.get(numericId)) ||
      profession.catalog.skillsByName.get(key);
    if (!skill) throw new Error(`Unknown ${profession.name} skill ${key}.`);
    console.log(`  [ ] skill ${skill.name} (${String(skill.id)})`);
  }
  for (const key of Object.keys(patch.constants || {})) {
    console.log(`  [ ] constant ${key}`);
  }
  for (const note of patch.notes || []) {
    console.log(
      `  [${note.status === "applied" ? " " : "-"}] ${note.status}: ${note.subject}`,
    );
  }
}
for (const key of Object.keys(activePatchPreview.constants || {})) {
  console.log(`\n[ ] global constant ${key}`);
}
for (const note of activePatchPreview.notes || []) {
  console.log(
    `\n[${note.status === "applied" ? " " : "-"}] ${note.status}: ${note.subject}`,
  );
}
