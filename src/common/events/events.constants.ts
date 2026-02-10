
export const EVENTS = {
  ORDER: {
    CREATED: 'order.created',
    ACCEPTED: 'order.accepted',
    REJECTED: 'order.rejected',
    READY: 'order.ready',
    COMPLETED: 'order.completed',
    CANCELLED: 'order.cancelled',
  },
  JOB: {
    ASSIGNED: 'job.assigned',
    STARTED: 'job.started',
    COMPLETED: 'job.completed',
  },
} as const;
