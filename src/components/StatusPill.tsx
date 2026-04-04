import type { JobStatus } from '@/types';

const toneMap: Record<JobStatus, 'blue' | 'yellow' | 'green' | 'red'> = {
  REQUESTED: 'blue',
  RECEIVED: 'blue',
  AWAITING_PLAYER: 'yellow',
  IN_PROGRESS: 'yellow',
  FINISHED: 'yellow',
  PAID: 'green',
  PICKED_UP: 'green',
  CANCELLED: 'red',
};

const labelMap: Partial<Record<JobStatus, string>> = {
  AWAITING_PLAYER: 'Awaiting Player Response',
};

export function StatusPill({ status }: { status: JobStatus }) {
  return <span className={`status-chip ${toneMap[status]}`}>{labelMap[status] || status.replaceAll('_', ' ')}</span>;
}
