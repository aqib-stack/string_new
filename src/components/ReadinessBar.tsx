export function ReadinessBar({ percent, label }: { percent: number; label: string }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className="readiness-wrap">
      <div className="readiness-meta">
        <strong>{width}%</strong>
        <span>{label}</span>
      </div>
      <div className="readiness-track">
        <div className="readiness-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
