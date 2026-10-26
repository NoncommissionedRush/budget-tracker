import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ImportService } from '../../services/import.service';
import {
  ImportBatchSummary,
  MailImportOverview,
  MailMessage,
} from '../../core/models/import.model';
import { apiErrorMessage } from '../../shared/utils/api-error';

@Component({
  selector: 'app-import-history',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Import history</h1>
        <a routerLink="/import" class="text-sm font-medium text-[var(--color-brand-600)] hover:underline">Upload</a>
      </div>

      @if (notice()) {
        <p class="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-xl">{{ notice() }}</p>
      }
      @if (error()) {
        <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="text-sm text-gray-400">Loading…</p>
      } @else {
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-gray-900 mb-1">Mailbox</h2>
              @if (mail()?.status; as status) {
                @if (status.enabled) {
                  <p class="text-sm text-gray-500">
                    Checks {{ status.folder }} every hour for mail from {{ status.allowedSenders.join(', ') }}.
                  </p>
                  @if (status.lastCheck; as last) {
                    <p class="text-xs mt-1" [class]="last.error ? 'text-red-600' : 'text-gray-400'">
                      Last check {{ last.startedAt | date: 'd. M. HH:mm' }}:
                      @if (last.error) {
                        {{ last.error }}
                      } @else {
                        {{ last.found }} new, {{ last.processed }} imported, {{ last.failed }} failed
                      }
                    </p>
                  }
                } @else {
                  <p class="text-sm text-gray-500">Not configured. Set the IMAP_* variables in backend/.env.</p>
                }
              }
            </div>
            @if (mail()?.status?.enabled) {
              <button type="button" (click)="checkNow()" [disabled]="busy() !== null"
                class="shrink-0 px-4 py-2 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:bg-[var(--color-brand-600)] disabled:opacity-50 transition-colors">
                {{ busy() === 'check' ? 'Checking…' : 'Check now' }}
              </button>
            }
          </div>

          @if (mail()?.messages?.length) {
            <ul class="mt-4 divide-y divide-gray-100">
              @for (m of mail()!.messages; track m.id) {
                <li class="py-3 flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ m.subject ?? '(no subject)' }}</p>
                    <p class="text-xs text-gray-500 truncate">
                      {{ (m.sentAt ?? m.createdAt) | date: 'd. M. yyyy HH:mm' }}
                      · {{ m.fileCount }} file{{ m.fileCount === 1 ? '' : 's' }}
                      @if (m.attempts > 1) { · {{ m.attempts }} attempts }
                    </p>
                    @if (m.error) {
                      <p class="text-xs mt-1" [class]="m.status === 'FAILED' ? 'text-red-600' : 'text-gray-400'">{{ m.error }}</p>
                    }
                  </div>
                  <div class="shrink-0 flex flex-col items-end gap-2">
                    <span class="text-xs font-medium px-2 py-1 rounded-lg" [class]="statusClass(m)">{{ statusLabel(m) }}</span>
                    <button type="button" (click)="rerun(m)" [disabled]="busy() !== null"
                      class="text-xs font-medium text-[var(--color-brand-600)] hover:underline disabled:opacity-50">
                      {{ busy() === m.id ? 'Running…' : 'Re-run' }}
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        <h2 class="text-lg font-semibold text-gray-900 mb-3">Batches</h2>
        @if (batches().length === 0) {
          <div class="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <p class="text-sm text-gray-500">No statements imported yet.</p>
          </div>
        }
        <div class="space-y-3">
          @for (b of batches(); track b.id) {
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div class="flex items-start justify-between gap-3 mb-3">
                <div class="min-w-0">
                  <p class="font-medium text-gray-900 truncate">{{ b.fileName ?? b.format }}</p>
                  <p class="text-xs text-gray-500">
                    {{ b.createdAt | date: 'd. M. yyyy HH:mm' }} · {{ b.source === 'EMAIL' ? 'Email' : 'Upload' }}
                  </p>
                </div>
                <button type="button" (click)="recategorize(b)" [disabled]="busy() !== null || b.needsReviewCount === 0"
                  title="Run the categorization rules again on this batch's unreviewed transactions"
                  class="shrink-0 text-xs font-medium text-[var(--color-brand-600)] hover:underline disabled:opacity-40 disabled:no-underline">
                  {{ busy() === b.id ? 'Running…' : 'Re-run rules' }}
                </button>
              </div>
              <dl class="grid grid-cols-5 gap-2 text-center">
                <div class="rounded-lg bg-gray-50 p-2">
                  <dt class="text-[10px] text-gray-500">New</dt>
                  <dd class="text-sm font-semibold text-gray-900">{{ b.importedCount }}</dd>
                </div>
                <div class="rounded-lg bg-gray-50 p-2">
                  <dt class="text-[10px] text-gray-500">Categorized</dt>
                  <dd class="text-sm font-semibold text-gray-900">{{ b.categorizedCount }}</dd>
                </div>
                <div class="rounded-lg bg-gray-50 p-2">
                  <dt class="text-[10px] text-gray-500">To review</dt>
                  <dd class="text-sm font-semibold text-gray-900">{{ b.needsReviewCount }}</dd>
                </div>
                <div class="rounded-lg bg-gray-50 p-2">
                  <dt class="text-[10px] text-gray-500">Ignored</dt>
                  <dd class="text-sm font-semibold text-gray-900">{{ b.ignoredCount }}</dd>
                </div>
                <div class="rounded-lg bg-gray-50 p-2">
                  <dt class="text-[10px] text-gray-500">Duplicates</dt>
                  <dd class="text-sm font-semibold text-gray-900">{{ b.duplicateCount }}</dd>
                </div>
              </dl>
              @if (b.errors.length) {
                <ul class="mt-3 text-xs text-red-600 list-disc pl-5">
                  @for (e of b.errors; track $index) {
                    <li>{{ e.entryRef ? e.entryRef + ': ' : '' }}{{ e.message }}</li>
                  }
                </ul>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ImportHistoryComponent implements OnInit {
  private readonly importService = inject(ImportService);

  readonly loading = signal(true);
  readonly busy = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly mail = signal<MailImportOverview | null>(null);
  readonly batches = signal<ImportBatchSummary[]>([]);

  ngOnInit() {
    this.load();
  }

  load() {
    forkJoin({ mail: this.importService.mail(), batches: this.importService.batches() }).subscribe({
      next: ({ mail, batches }) => {
        this.mail.set(mail);
        this.batches.set(batches);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err, 'Could not load the import history'));
        this.loading.set(false);
      },
    });
  }

  checkNow() {
    this.run('check', this.importService.checkMail(), (r) =>
      `Mailbox checked: ${r.found} new, ${r.processed} imported, ${r.failed} failed.`,
    );
  }

  rerun(m: MailMessage) {
    this.run(m.id, this.importService.rerunMail(m.id), (r) =>
      r.status === 'FAILED' ? null : `Re-imported “${r.subject ?? 'email'}”.`,
    );
  }

  recategorize(b: ImportBatchSummary) {
    this.run(b.id, this.importService.recategorize(b.id), (r) =>
      `${r.categorized} categorized, ${r.ignored} ignored, ${r.remaining} still to review.`,
    );
  }

  statusLabel(m: MailMessage) {
    return { PROCESSED: 'Imported', FAILED: 'Failed', SKIPPED: 'Skipped' }[m.status];
  }

  statusClass(m: MailMessage) {
    return {
      PROCESSED: 'bg-green-50 text-green-700',
      FAILED: 'bg-red-50 text-red-700',
      SKIPPED: 'bg-gray-100 text-gray-600',
    }[m.status];
  }

  private run<T>(key: string, request: Observable<T>, message: (result: T) => string | null) {
    this.busy.set(key);
    this.error.set(null);
    this.notice.set(null);
    request.subscribe({
      next: (result) => {
        this.notice.set(message(result));
        this.busy.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err, 'Something went wrong'));
        this.busy.set(null);
        this.load();
      },
    });
  }
}
