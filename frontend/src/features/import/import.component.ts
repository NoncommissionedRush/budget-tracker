import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ImportService } from '../../services/import.service';
import { ImportFileResult } from '../../core/models/import.model';
import { apiErrorMessage } from '../../shared/utils/api-error';

@Component({
  selector: 'app-import',
  imports: [RouterLink],
  template: `
    <div class="max-w-2xl mx-auto px-4 py-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Import</h1>

      <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-900 mb-1">Bank statement</h2>
        <p class="text-sm text-gray-500 mb-6">
          Upload a camt.053 XML statement, or the ZIP file the bank emails you.
        </p>

        <form (submit)="$event.preventDefault(); upload()">
          <label
            class="flex flex-col items-center justify-center gap-2 w-full px-4 py-8 mb-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-[var(--color-brand-500)] cursor-pointer transition-colors">
            <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span class="text-sm font-medium text-gray-700">{{ file()?.name ?? 'Choose a .xml or .zip file' }}</span>
            <input type="file" accept=".xml,.zip,application/xml,text/xml,application/zip" class="hidden"
              (change)="onFileChange($event)" />
          </label>

          @if (isZip()) {
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">ZIP password</label>
              <input
                type="password"
                autocomplete="off"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent"
              />
              <p class="text-xs text-gray-400 mt-1">Used only to open this file. It is not saved.</p>
            </div>
          }

          @if (error()) {
            <p class="text-sm text-red-600 mb-4">{{ error() }}</p>
          }

          <button
            type="submit"
            [disabled]="!file() || uploading()"
            class="w-full py-3 rounded-xl bg-[var(--color-brand-500)] text-white font-semibold hover:bg-[var(--color-brand-600)] disabled:opacity-50 transition-colors">
            {{ uploading() ? 'Importing…' : 'Import' }}
          </button>
        </form>
      </div>

      @for (result of results(); track result.batchId) {
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mt-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-900 truncate">{{ result.fileName }}</h3>
            @if (result.status === 'duplicate_file') {
              <span class="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-600">Already imported</span>
            } @else {
              <span class="text-xs font-medium px-2 py-1 rounded-lg bg-green-50 text-green-700">Imported</span>
            }
          </div>
          <dl class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div class="rounded-xl bg-gray-50 p-3">
              <dt class="text-xs text-gray-500">New</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ result.importedCount }}</dd>
            </div>
            <div class="rounded-xl bg-gray-50 p-3">
              <dt class="text-xs text-gray-500">Categorized</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ result.categorizedCount }}</dd>
            </div>
            <div class="rounded-xl bg-gray-50 p-3">
              <dt class="text-xs text-gray-500">To review</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ result.needsReviewCount }}</dd>
            </div>
            <div class="rounded-xl bg-gray-50 p-3">
              <dt class="text-xs text-gray-500">Ignored</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ result.ignoredCount }}</dd>
            </div>
            <div class="rounded-xl bg-gray-50 p-3">
              <dt class="text-xs text-gray-500">Duplicates</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ result.duplicateCount }}</dd>
            </div>
          </dl>
          @if (result.needsReviewCount > 0) {
            <a routerLink="/review"
              class="mt-4 block text-center text-sm font-medium text-[var(--color-brand-600)] hover:underline">
              Review {{ result.needsReviewCount }} transaction{{ result.needsReviewCount === 1 ? '' : 's' }} →
            </a>
          }
          @if (result.errors.length) {
            <ul class="mt-4 text-sm text-red-600 list-disc pl-5">
              @for (e of result.errors; track $index) {
                <li>{{ e.entryRef ? e.entryRef + ': ' : '' }}{{ e.message }}</li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
})
export class ImportComponent {
  private readonly importService = inject(ImportService);

  readonly file = signal<File | null>(null);
  readonly password = signal('');
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly results = signal<ImportFileResult[]>([]);
  readonly isZip = computed(() => this.file()?.name.toLowerCase().endsWith('.zip') ?? false);

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.error.set(null);
  }

  upload() {
    const file = this.file();
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    this.importService.upload(file, this.isZip() ? this.password() : undefined).subscribe({
      next: (res) => {
        this.results.set(res.files);
        this.password.set('');
        this.uploading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err, 'Import failed'));
        this.uploading.set(false);
      },
    });
  }
}
