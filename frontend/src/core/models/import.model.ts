export interface ImportFileResult {
  fileName: string;
  status: 'imported' | 'duplicate_file';
  batchId: string;
  format: string;
  totalCount: number;
  importedCount: number;
  duplicateCount: number;
  ignoredCount: number;
  categorizedCount: number;
  needsReviewCount: number;
  errors: { entryRef: string | null; message: string }[];
}

export interface ImportUploadResult {
  files: ImportFileResult[];
}

export type ImportSource = 'UPLOAD' | 'EMAIL';

export interface ImportBatchSummary {
  id: string;
  source: ImportSource;
  fileName: string | null;
  format: string;
  messageId: string | null;
  createdAt: string;
  totalCount: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: { entryRef: string | null; message: string }[];
  categorizedCount: number;
  needsReviewCount: number;
  ignoredCount: number;
}

export type MailMessageStatus = 'PROCESSED' | 'FAILED' | 'SKIPPED';

export interface MailMessage {
  id: string;
  messageId: string;
  folder: string;
  sender: string | null;
  subject: string | null;
  sentAt: string | null;
  status: MailMessageStatus;
  attempts: number;
  fileCount: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MailCheckResult {
  startedAt: string;
  finishedAt: string | null;
  found: number;
  processed: number;
  failed: number;
  skipped: number;
  error: string | null;
}

export interface MailImportOverview {
  status: {
    enabled: boolean;
    running: boolean;
    folder: string | null;
    allowedSenders: string[];
    lookbackDays: number | null;
    lastCheck: MailCheckResult | null;
  };
  messages: MailMessage[];
}

export interface RecategorizeResult {
  categorized: number;
  ignored: number;
  remaining: number;
}
