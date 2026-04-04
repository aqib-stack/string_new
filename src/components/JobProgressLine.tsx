import type { JobStatus } from '@/types';

const steps = ['REQUESTED', 'RECEIVED', 'IN_PROGRESS', 'FINISHED', 'PAID', 'PICKED_UP'] as const;

export function JobProgressLine({ status }: { status: JobStatus }) {
  const activeIndex = steps.indexOf((status === 'AWAITING_PLAYER' ? 'RECEIVED' : status) as any);

  return (
    <div className="progress-line">
      {steps.map((step, index) => (
        <div key={step} className={`progress-step ${index <= activeIndex ? 'active' : ''}`}>
          <span className="progress-dot" />
          <span className="progress-label">{step.replaceAll('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}
