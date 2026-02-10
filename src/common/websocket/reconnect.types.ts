
export interface ReconnectEnvelope<T> {
  
  snapshotAt: Date;
  data: T | null;
}