
import type { HybridSetup } from '@/types';

export function getStringSetupSummary(data: {
  is_hybrid?: boolean;
  string_type?: string;
  tension?: string;
  hybrid_setup?: HybridSetup | null;
}) {
  const hybrid = Boolean(data?.is_hybrid && data?.hybrid_setup);
  const setup = data?.hybrid_setup || {};

  if (hybrid) {
    return {
      isHybrid: true,
      setupLabel: 'Hybrid',
      tensionLabel: 'Split tension',
      mainString: setup.mains_string || 'Not recorded',
      crossString: setup.crosses_string || 'Not recorded',
      mainTension: setup.mains_tension || 'Not recorded',
      crossTension: setup.crosses_tension || 'Not recorded',
    };
  }

  return {
    isHybrid: false,
    setupLabel: data?.string_type || 'Not recorded',
    tensionLabel: data?.tension || 'Not recorded',
    mainString: data?.string_type || 'Not recorded',
    crossString: '',
    mainTension: data?.tension || 'Not recorded',
    crossTension: '',
  };
}

export function StringSetupSummary({
  data,
  compact = false,
}: {
  data: {
    is_hybrid?: boolean;
    string_type?: string;
    tension?: string;
    hybrid_setup?: HybridSetup | null;
  };
  compact?: boolean;
}) {
  const summary = getStringSetupSummary(data);

  if (!summary.isHybrid) {
    return (
      <>
        <div className="meta-item"><strong>String setup</strong>{summary.setupLabel}</div>
        <div className="meta-item"><strong>Tension</strong>{summary.tensionLabel}</div>
      </>
    );
  }

  if (compact) {
    return (
      <>
        <div className="meta-item"><strong>Main string</strong>{summary.mainString}</div>
        <div className="meta-item"><strong>Main tension</strong>{summary.mainTension}</div>
        <div className="meta-item"><strong>Cross string</strong>{summary.crossString}</div>
        <div className="meta-item"><strong>Cross tension</strong>{summary.crossTension}</div>
      </>
    );
  }

  return (
    <>
      <div className="meta-item"><strong>Main string</strong>{summary.mainString}</div>
      <div className="meta-item"><strong>Main tension</strong>{summary.mainTension}</div>
      <div className="meta-item"><strong>Cross string</strong>{summary.crossString}</div>
      <div className="meta-item"><strong>Cross tension</strong>{summary.crossTension}</div>
    </>
  );
}
