export const ROTATION_TIMELINE_SIZE_STORAGE_KEY = "gw2-rotation-timeline-size";

export const ROTATION_TIMELINE_SIZE_OPTIONS = Object.freeze([
  { value: "normal", label: "100%" },
  { value: "large", label: "125%" },
  { value: "extra-large", label: "150%" },
] as const);

export type RotationTimelineSize =
  (typeof ROTATION_TIMELINE_SIZE_OPTIONS)[number]["value"];

export function normalizeRotationTimelineSize(
  value: unknown,
): RotationTimelineSize {
  const match = ROTATION_TIMELINE_SIZE_OPTIONS.find(
    (option) => option.value === value,
  );
  return match?.value || "normal";
}

function readStoredSize(root: Document): RotationTimelineSize {
  try {
    return normalizeRotationTimelineSize(
      root.defaultView?.localStorage.getItem(
        ROTATION_TIMELINE_SIZE_STORAGE_KEY,
      ),
    );
  } catch {
    return "normal";
  }
}

function storeSize(root: Document, size: RotationTimelineSize): void {
  try {
    root.defaultView?.localStorage.setItem(
      ROTATION_TIMELINE_SIZE_STORAGE_KEY,
      size,
    );
  } catch {
    // Browser storage may be unavailable in private or embedded contexts.
  }
}

export function mountRotationTimelineSize(root: Document = document): void {
  const timeline = root.getElementById("rotation-timeline");
  const toolbar = timeline
    ?.closest<HTMLElement>(".rotation-panel")
    ?.querySelector<HTMLElement>(".rotation-mid");
  const panel = timeline?.closest<HTMLElement>(".rotation-panel");
  if (!timeline || !toolbar || !panel) return;

  const storedSize = readStoredSize(root);
  panel.dataset.rotationSize = storedSize;

  const existing = root.getElementById("rotation-timeline-size");
  if (existing?.tagName === "SELECT") {
    (existing as HTMLSelectElement).value = storedSize;
    return;
  }

  const control = root.createElement("label");
  control.className = "rotation-size-control";
  control.htmlFor = "rotation-timeline-size";

  const label = root.createElement("span");
  label.textContent = "Timeline size";
  control.append(label);

  const select = root.createElement("select");
  select.id = "rotation-timeline-size";
  select.title = "Change the size of skills in the rotation timeline";
  for (const option of ROTATION_TIMELINE_SIZE_OPTIONS) {
    const element = root.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }
  select.value = storedSize;
  select.addEventListener("change", () => {
    const size = normalizeRotationTimelineSize(select.value);
    select.value = size;
    panel.dataset.rotationSize = size;
    storeSize(root, size);
  });
  control.append(select);

  const startState = toolbar.querySelector(".start-att-selector");
  toolbar.insertBefore(
    control,
    startState || toolbar.querySelector(".rotation-btns"),
  );
}
