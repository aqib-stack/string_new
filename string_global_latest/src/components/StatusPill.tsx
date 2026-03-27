import type { JobStatus } from '@/types';

const toneMap: Record<JobStatus, 'blue' | 'yellow' | 'green'> = {
  REQUESTED: 'blue',
  RECEIVED: 'blue',
  IN_PROGRESS: 'yellow',
  FINISHED: 'yellow',
  PAID: 'green',
  PICKED_UP: 'green',
};

export function StatusPill({ status }: { status: JobStatus }) {
  return <span className={`status-chip ${toneMap[status]}`}>{status.replaceAll('_', ' ')}</span>;
}
