import type { HybridSetup } from '@/types';

function clean(value?: string) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'hybrid setup') return '';
  return text;
}

function cleanTension(value?: string) {
  const text = clean(value);
  if (!text) return '';
  const number = text.replace(/[^0-9.]/g, '');
  return number || text;
}

export function getStringSetupSummary(data: {
  is_hybrid?: boolean;
  string_type?: string;
  tension?: string;
  hybrid_setup?: HybridSetup | null;
}) {
  const hybrid = Boolean(data?.is_hybrid);
  const setup = data?.hybrid_setup || {};

  if (hybrid) {
    const mainString = clean(setup.mains_string) || 'No main string selected';
    const crossString = clean(setup.crosses_string) || 'No cross string selected';
    const mainTension = cleanTension(setup.mains_tension) || 'No main tension';
    const crossTension = cleanTension(setup.crosses_tension) || 'No cross tension';

    return {
      isHybrid: true,
      setupLabel: `${mainString} / ${crossString}`,
      tensionLabel: `${mainTension} / ${crossTension}`,
      mainString,
      crossString,
      mainTension: mainTension.startsWith('No ') ? mainTension : `${mainTension} lbs`,
      crossTension: crossTension.startsWith('No ') ? crossTension : `${crossTension} lbs`,
    };
  }

  const singleTension = cleanTension(data?.tension) || 'No tension saved';

  return {
    isHybrid: false,
    setupLabel: clean(data?.string_type) || 'No saved setup',
    tensionLabel: singleTension === 'No tension saved' ? singleTension : `${singleTension} lbs`,
    mainString: clean(data?.string_type) || 'No saved setup',
    crossString: '',
    mainTension: singleTension === 'No tension saved' ? singleTension : `${singleTension} lbs`,
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

  if (!compact) {
    return (
      <>
        <div className="meta-item"><strong>Main / Cross</strong>{summary.setupLabel}</div>
        <div className="meta-item"><strong>Tension</strong>{summary.tensionLabel}</div>
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
