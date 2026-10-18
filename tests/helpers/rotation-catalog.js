/** Build the ordered skills and ID index together so import fixtures use the production lookup contract. */
export function rotationCatalog(skills) {
  return { skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) };
}
