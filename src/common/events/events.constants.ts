
export const EVENTS = {
  ORDER: {
    CREATED: 'order.created',
    ACCEPTED: 'order.accepted',
    REJECTED: 'order.rejected',
    READY: 'order.ready',
    COMPLETED: 'order.completed',
    CANCELLED: 'order.cancelled',
    DELIVERY_ISSUE: 'order.delivery_issue',
  },
  JOB: {
    ASSIGNED: 'job.assigned',
    STARTED: 'job.started',
    COMPLETED: 'job.completed',
    RECOVERED: 'job.recovered',
    ESCALATED: 'job.escalated',
  },
} as const;
