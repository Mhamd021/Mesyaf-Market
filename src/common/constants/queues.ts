export const QUEUES = {
  DELIVERER_ASSIGNMENT: 'deliverer-assignment',
  BATCH_TIMEOUT : "batch-timeout",
} as const;

export const JOBS = {
  ASSIGN_DELIVERER: 'assign-deliverer',
  CLOSE_BATCH_TIMEOUT: "close-batch-timeout"
} as const;