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
