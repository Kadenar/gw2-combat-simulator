export interface ChartMarkerLabel {
  readonly label: string;
  readonly timeMs: number;
  readonly color: string;
}

/** Pack measured labels into separate lanes without moving their actual transition lines or clipping at chart edges. */
export function layoutChartMarkerLabels(
  markers: readonly ChartMarkerLabel[],
  durationMs: number,
  left: number,
  plotWidth: number,
  measure: (label: string) => number
) {
  const width = Math.max(1, plotWidth);
  const laneEnds: number[] = [];
  return [...markers]
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((marker) => {
      let label = marker.label;

      // Keep labels readable on phones; full encounter names remain available on the phase controls and table.
      if (measure(label) > width) {
        let low = 0;
        let high = label.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);

          if (measure(`${label.slice(0, middle)}…`) <= width) low = middle;
          else high = middle - 1;
        }

        label = `${label.slice(0, low)}…`;
      }

      const labelWidth = Math.min(width, measure(label));
      const x = left + (marker.timeMs / Math.max(1, durationMs)) * width;
      const labelLeft = Math.max(left, Math.min(x - labelWidth / 2, left + width - labelWidth));
      let lane = laneEnds.findIndex((end) => end + 8 <= labelLeft);

      if (lane < 0) lane = laneEnds.length;

      laneEnds[lane] = labelLeft + labelWidth;
      return { ...marker, label, x, left: labelLeft, width: labelWidth, lane };
    });
}
