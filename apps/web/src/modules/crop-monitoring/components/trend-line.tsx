import { INDEX_SCALES, indexColor, type IndexKind } from "../indices";

// Index values over recent passes, oldest on the left. Cloudy passes (null)
// leave a gap with a hollow marker on the baseline, so missing data is
// visible rather than smoothed over. Dashed lines mark the "watch" and
// "good" thresholds.
export function TrendLine({
  kind,
  values,
  label,
  width = 240,
  height = 64,
}: {
  kind: IndexKind;
  // Oldest first.
  values: (number | null)[];
  label: string;
  width?: number;
  height?: number;
}) {
  const { min, max, good, watch } = INDEX_SCALES[kind];
  const pad = 6;
  const x = (index: number) =>
    pad +
    (values.length > 1 ? (index / (values.length - 1)) * (width - 2 * pad) : (width - 2 * pad) / 2);
  const y = (value: number) =>
    pad + (1 - (Math.min(max, Math.max(min, value)) - min) / (max - min)) * (height - 2 * pad);

  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 1) {
        segments.push(current.join(" "));
      }
      current = [];
      return;
    }
    current.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  });
  if (current.length > 1) {
    segments.push(current.join(" "));
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="h-auto w-full">
      {[good, watch].map((threshold) => (
        <line
          key={threshold}
          x1={pad}
          x2={width - pad}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="var(--color-ink-faint)"
          strokeDasharray="3 4"
          strokeWidth={1}
        />
      ))}
      {segments.map((points) => (
        <polyline
          key={points}
          points={points}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {values.map((value, index) =>
        value === null ? (
          <circle
            key={index}
            cx={x(index)}
            cy={height - pad}
            r={3}
            fill="var(--color-surface)"
            stroke="var(--color-ink-faint)"
            strokeWidth={1.5}
          />
        ) : (
          <circle
            key={index}
            cx={x(index)}
            cy={y(value)}
            r={index === values.length - 1 ? 5 : 3.5}
            fill={indexColor(kind, value)}
            stroke="var(--color-ink)"
            strokeWidth={1.2}
          />
        )
      )}
    </svg>
  );
}
