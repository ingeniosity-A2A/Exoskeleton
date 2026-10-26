/**
 * Librarian intake surface.
 * Wraps the zero-copy streaming foundation.
 */

export interface IntakeRecord {
  recordId: string;
  tenantId: string;
  agentId: string;
  content: string;
  memoryType: string;
  timestamp: number;
  payloadRef?: string;
}

export interface IntakeReport {
  totalRecords: number;
  elapsedSeconds: number;
  throughputRecSec: number;
}

/**
 * Placeholder for the Python zero-copy engine bridge.
 * Production path will invoke engine/rev_ike.py or a native port.
 */
export async function runZeroCopyIntake(
  totalRecords: number = 10_000
): Promise<IntakeReport> {
  // Bridge to engine/rev_ike.py in a later slice.
  // For now this documents the contract only.
  return {
    totalRecords,
    elapsedSeconds: 0,
    throughputRecSec: 0,
  };
}
