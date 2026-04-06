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
  REQUESTED: 'Requested',
  RECEIVED: 'Received',
  AWAITING_PLAYER: 'Awaiting Player Response',
  IN_PROGRESS: 'In Progress',
  FINISHED: 'Ready',
  PAID: 'Awaiting Pickup',
  PICKED_UP: 'Picked Up',
  CANCELLED: 'Cancelled',
};

export function StatusPill({ status, paymentRequested = false }: { status: JobStatus; paymentRequested?: boolean }) {
  const label = status === 'FINISHED' && paymentRequested ? 'Awaiting Payment' : (labelMap[status] || status.replaceAll('_', ' '));
  return <span className={`status-chip ${toneMap[status]}`}>{label}</span>;
}
