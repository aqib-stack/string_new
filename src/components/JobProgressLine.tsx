import type { JobStatus } from '@/types';

const steps = ['REQUESTED', 'RECEIVED', 'IN_PROGRESS', 'FINISHED', 'PAID', 'PICKED_UP'] as const;
const playerLabels: Record<(typeof steps)[number], string> = {
  REQUESTED: 'Requested',
  RECEIVED: 'At Stringer',
  IN_PROGRESS: 'Being Strung',
  FINISHED: 'Ready',
  PAID: 'Paid',
  PICKED_UP: 'Picked Up',
};

export function JobProgressLine({ status, playerView = false }: { status: JobStatus; playerView?: boolean }) {
  const activeIndex = steps.indexOf((status === 'AWAITING_PLAYER' ? 'RECEIVED' : status) as any);

  return (
    <div className="progress-line">
      {steps.map((step, index) => (
        <div key={step} className={`progress-step ${index <= activeIndex ? 'active' : ''}`}>
          <span className="progress-dot" />
          <span className="progress-label">{playerView ? playerLabels[step] : step.replaceAll('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}
