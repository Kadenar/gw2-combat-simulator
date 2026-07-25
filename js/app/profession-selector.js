export const PROFESSION_ROUTES = Object.freeze({
  mesmer: "mesmer.html",
  elementalist: "elementalist.html",
  guardian: "guardian.html",
  necromancer: "necromancer.html",
});

export function professionRoute(professionId) {
  return PROFESSION_ROUTES[professionId] || "index.html";
}

export function bindProfessionSelector(root = document) {
  const select = root.getElementById("profession-select");
  if (!select) return;

  const active = select.dataset.activeProfession;
  if (active in PROFESSION_ROUTES) select.value = active;

  select.addEventListener("change", () => {
    const route = professionRoute(select.value);
    const current = globalThis.location?.pathname?.split("/").pop() || "index.html";
    if (current !== route) globalThis.location.assign(route);
  });
}

if (typeof document !== "undefined") {
  bindProfessionSelector(document);
}
