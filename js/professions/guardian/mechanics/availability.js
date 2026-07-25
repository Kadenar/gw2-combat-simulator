export function selectedGuardianSpecialization(context = {}) {
  const config = context.config || context;
  if (typeof config.specialization === "string") {
    return config.specialization;
  }
  return (config.specializations || [])
    .map(value => typeof value === "string" ? value : value?.name)
    .find(name =>
      context.catalog?.specializations?.some(specialization =>
        specialization.elite && specialization.name === name)) || "";
}

export function validateGuardianAvailability(context, skill) {
  if (!skill.implemented) return false;
  const specialization =
    selectedGuardianSpecialization(context) || "Core";
  return !(
    skill.type !== "Weapon"
    && skill.specialization
    && specialization !== skill.specialization
  );
}
