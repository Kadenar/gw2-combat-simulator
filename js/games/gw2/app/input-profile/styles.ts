import { ensureDocumentStyles } from '#ui/shared/dom.js';

const styles = `
  .input-profile-dialog { --dialog-width:540px; }
  .input-profile-dialog table { width:100%; border-collapse:collapse; font-size:12px; }
  .input-profile-dialog td,.input-profile-dialog th { padding:5px; text-align:left; }
  .input-profile-dialog input,.input-profile-dialog select { max-width:100%; background:var(--bg-panel-alt); color:var(--text-bright); border:1px solid var(--border); padding:5px; }
  .input-profile-dialog [data-binding] { width:120px; }
  .input-profile-dialog .input-profile-fields { overflow-x:auto; }

  /* Reach groups colour action shares; transition bars show occurrence counts. */
  .input-activity {
    --input-pace:#5c5b6e; --input-reach:#3987e5; --input-transition:#d95926; --input-modifier:#199e70;
    --input-raise:#25242c; --input-reach-0:#222129; --input-reach-1:#1e2838; --input-reach-2:#213656;
    --input-highlight:#64e3ee; --input-highlight-soft:rgba(100,227,238,.14); --input-highlight-mid:rgba(100,227,238,.3);
    margin-top:8px; font-size:12px; color:var(--text);
  }
  .input-activity [data-component="near"] { background:var(--input-pace); }
  .input-activity [data-component="stretch"] { background:var(--input-reach); }
  .input-activity [data-component="far"], .input-activity [data-component="transition"] { background:var(--input-transition); }
  .input-activity [data-component="unknown"] { background:var(--text-dim); }
  .input-activity [data-component="modifier"] { background:var(--input-modifier); }

  /* Let the measured chart shrink with the workspace instead of fixing the grid to its previous SVG width. */
  .input-activity-body { container-type:inline-size; display:grid; grid-template-columns:minmax(0,1fr); gap:24px; padding:8px 12px 16px; max-height:clamp(280px, 70dvh, 880px); overflow-y:auto; scrollbar-gutter:stable; }
  body:not([data-rotation-focus]) .rotation-panel:has(.input-activity[open]) { max-height:none; overflow:visible; }
  body[data-rotation-focus] .rotation-panel:has(.input-activity[open]) { overflow-y:auto; }
  .input-activity h4 { font-size:11px; text-transform:uppercase; letter-spacing:.07em; color:var(--text-dim); font-weight:600; margin:0 0 10px; }
  .input-activity p { margin:0; line-height:1.55; }
  .input-activity b { color:var(--text-bright); font-weight:600; }
  .input-muted { color:var(--text-dim); font-size:11px; }

  .input-overview { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px 24px; align-items:start; }
  .input-overview p { max-width:72ch; }

  .input-evidence { display:grid; grid-template-columns:minmax(0,1.08fr) minmax(0,1fr); gap:24px 36px; }
  .input-evidence > section { min-width:0; display:grid; gap:22px; align-content:start; }
  .input-split { display:flex; gap:2px; height:14px; }
  .input-split i { display:block; min-width:3px; }
  .input-split i:first-child { border-radius:4px 0 0 4px; }
  .input-split i:last-child { border-radius:0 4px 4px 0; }
  .input-split-legend { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px 18px; margin-top:10px; }
  .input-split-legend > div { display:grid; grid-template-columns:10px minmax(0,1fr) auto; gap:1px 8px; align-items:baseline; }
  .input-split-legend > div > i { width:10px; height:10px; border-radius:2px; align-self:center; }
  .input-split-legend b { font-family:var(--mono); font-variant-numeric:tabular-nums; }
  .input-split-legend small { grid-column:2 / -1; color:var(--text-dim); font-size:11px; }
  .input-split-legend .is-zero { opacity:.55; }

  .input-key { display:inline-flex; align-items:center; justify-content:center; min-width:22px; height:22px; padding:0 6px; box-sizing:border-box; border:1px solid var(--border-light); border-bottom-width:2px; border-radius:4px; background:var(--input-raise); color:var(--text-bright); font:600 11px var(--mono); line-height:1; vertical-align:middle; }
  .input-key.is-modifier { border-color:color-mix(in srgb, var(--input-modifier) 70%, var(--border-light)); }
  .input-key-plus { margin:0 2px; color:var(--text-dim); font-size:11px; }
  .input-key-arrow { margin:0 4px; color:var(--text-dim); }

  .input-kb { position:relative; }
  /* Key and chart lines name controls and percentages; allow them to wrap inside the shared tooltip frame. */
  .input-activity .chart-tooltip { max-width:min(320px, 100%); white-space:normal; overflow-wrap:anywhere; }
  .input-kb-svg { display:block; width:100%; max-width:600px; height:auto; }
  .input-kb-cap { fill:var(--input-reach-0); stroke:#34333f; stroke-width:1; transition:stroke .12s; }
  .input-kb-key.is-reach-1 .input-kb-cap { fill:var(--input-reach-1); }
  .input-kb-key.is-reach-2 .input-kb-cap { fill:var(--input-reach-2); }
  .input-kb-key.is-used { cursor:default; }
  .input-kb-key.is-used .input-kb-cap { stroke:#c4c4d2; stroke-width:1.5; }
  .input-kb-key.is-used.is-modifier .input-kb-cap { stroke:var(--input-modifier); }
  .input-kb-key.is-emphasis .input-kb-cap { stroke:var(--input-highlight); stroke-width:2.5; }
  /* Dim by muting outlines and labels; key fills stay opaque so adjacent mouse shapes never show through. */
  .input-kb-svg.has-emphasis .input-kb-key:not(.is-emphasis) .input-kb-cap { stroke:#34333f; stroke-width:1; }
  .input-kb-svg.has-emphasis .input-kb-key:not(.is-emphasis) text { fill-opacity:.4; }
  .input-kb-label { fill:#6d6d80; font:600 13px var(--mono); text-anchor:middle; }
  .input-kb-label.is-small { font-size:10px; }
  .input-kb-key.is-used .input-kb-label { fill:var(--text-bright); }
  .input-kb-count { fill:var(--text-dim); font:10px var(--mono); text-anchor:middle; }
  .input-kb .input-muted { margin-top:8px; line-height:2; }
  .input-kb-legend { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:10px; font-size:11px; color:var(--text-dim); }
  .input-kb-legend span { display:inline-flex; align-items:center; gap:6px; }
  .input-kb-legend i { width:14px; height:12px; border-radius:2px; border:1px solid #34333f; background:var(--input-reach-0); }
  .input-kb-legend i.is-reach-1 { background:var(--input-reach-1); }
  .input-kb-legend i.is-reach-2 { background:var(--input-reach-2); }

  /* Rows share one column grid so names align after the widest keycap set, such as E → Shift+E. */
  .input-rows { display:grid; grid-template-columns:max-content minmax(0,1fr) 72px 60px; column-gap:10px; row-gap:2px; }
  .input-row, .input-rows-head { grid-column:1 / -1; display:grid; grid-template-columns:subgrid; align-items:center; }
  .input-row { width:100%; padding:7px 8px; border:0; border-radius:3px; background:transparent; color:var(--text); font:inherit; text-align:left; cursor:pointer; }
  .input-row:hover, .input-row.is-emphasis { background:var(--input-raise); }
  .input-row[aria-pressed="true"] { background:var(--input-highlight-soft); box-shadow:inset 2px 0 0 var(--input-highlight); }
  .input-rows-head { padding:0 8px 4px; font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.06em; }
  .input-rows-head span:last-child { grid-column:3 / 5; text-align:right; }
  .input-transition-head span:nth-child(3) { text-align:right; }
  .input-transition-head span:last-child { grid-column:4; }
  .input-row-keys { white-space:nowrap; }
  .input-row-name { min-width:0; line-height:1.35; }
  .input-row-name small { display:block; color:var(--text-dim); font-size:11px; }
  .input-row-bar { display:flex; gap:1px; height:8px; overflow:hidden; border-radius:4px; background:var(--bg-panel-alt); }
  .input-row-bar i { display:block; height:100%; }
  .input-row-value { text-align:right; color:var(--text-bright); font-family:var(--mono); font-variant-numeric:tabular-nums; }

  .input-chart { position:relative; min-height:170px; }
  .input-chart svg { display:block; }
  .input-chart .is-grid { stroke:#2c2c36; }
  .input-chart-tick { fill:var(--text-dim); font:10px var(--mono); }
  .input-chart-area { fill:rgba(169,169,189,.1); }
  .input-chart-line { fill:none; stroke:#a9a9bd; stroke-width:1.75; stroke-linejoin:round; }
  .input-chart-section { fill:var(--input-highlight-soft); }
  .input-chart-section.is-selected { fill:var(--input-highlight-mid); }
  .input-chart-mark { stroke-width:2; }
  .input-chart-mark.is-key { stroke:var(--input-highlight); }
  .input-chart-mark.is-transition { stroke:var(--input-transition); }
  .input-chart-cross { stroke:var(--text-bright); stroke-opacity:.4; }
  .input-chart-cross-dot { fill:var(--text-bright); }
  /* Range brackets replace detached section cards and keep hover, selection, and keyboard focus visible. */
  .input-chart-bracket { cursor:pointer; color:var(--input-highlight); }
  .input-chart-bracket path { fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .input-chart-bracket:hover path, .input-chart-bracket[aria-pressed="true"] path, .input-chart-bracket:focus-visible path { stroke-width:3; }
  /* Focus follows the bracket shape instead of drawing a button box around the range labels. */
  .input-chart-bracket:focus { outline:none; }
  .input-chart-bracket:focus-visible path { stroke:var(--text-bright); }
  .input-chart-range-label { fill:var(--text-bright); font-size:11px; }
  .input-chart-range-detail { fill:var(--text-dim); font-size:10px; }

  @container (max-width: 760px) {
    .input-evidence { grid-template-columns:minmax(0,1fr); }
  }
  @container (max-width: 480px) {
    .input-overview, .input-split-legend { grid-template-columns:minmax(0,1fr); }
    .input-rows { grid-template-columns:max-content minmax(0,1fr) 36px 60px; column-gap:8px; }
  }
  @media (prefers-reduced-motion: reduce) { .input-kb-cap { transition:none; } }

  /* Cyan selection and subdued surrounding entries distinguish the section from red cancelled-auto styling. */
  #rotation-timeline.input-activity-selection { box-sizing:border-box; padding-top:var(--input-activity-scroll-inset, 0px); }
  #rotation-timeline.input-activity-selection .rot-skill:not(.input-activity-highlight) { opacity:.35; filter:saturate(.35); }
  #rotation-timeline .rot-skill.input-activity-highlight { outline:3px solid #64e3ee; outline-offset:2px; box-shadow:0 0 10px 2px #64e3ee66; opacity:1; filter:none; }
  #rotation-timeline .input-activity-start::after { content:'Start'; position:absolute; top:-17px; left:-5px; padding:1px 4px; border-radius:2px; background:#64e3ee; color:#101415; font:700 10px/12px sans-serif; pointer-events:none; z-index:2; }
`;

/** Use the existing disclosure aesthetic and keep expanded content reachable in both workspace modes. */
export function ensureInputProfileStyles(document: Document): void {
  ensureDocumentStyles(document, 'input-profile-styles', styles);
}
