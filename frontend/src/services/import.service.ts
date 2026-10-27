import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import {
  ImportBatchSummary,
  ImportUploadResult,
  MailCheckResult,
  MailImportOverview,
  MailMessage,
  RecategorizeResult,
} from '../core/models/import.model';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/import`;

  upload(file: File, password?: string) {
    const body = new FormData();
    body.append('file', file);
    if (password) body.append('password', password);
    return this.http.post<ImportUploadResult>(`${this.url}/upload`, body);
  }

  batches() {
    return this.http.get<ImportBatchSummary[]>(`${this.url}/batches`);
  }

  recategorize(batchId: string) {
    return this.http.post<RecategorizeResult>(`${this.url}/batches/${batchId}/recategorize`, {});
  }

  mail() {
    return this.http.get<MailImportOverview>(`${this.url}/mail`);
  }

  checkMail() {
    return this.http.post<MailCheckResult>(`${this.url}/mail/check`, {});
  }

  rerunMail(id: string) {
    return this.http.post<MailMessage>(`${this.url}/mail/${id}/rerun`, {});
  }
}
