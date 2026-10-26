import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { ImportUploadResult } from '../core/models/import.model';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);

  upload(file: File, password?: string) {
    const body = new FormData();
    body.append('file', file);
    if (password) body.append('password', password);
    return this.http.post<ImportUploadResult>(`${environment.apiUrl}/import/upload`, body);
  }
}
