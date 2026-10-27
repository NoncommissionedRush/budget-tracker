import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailMessage, MailMessageStatus } from '@prisma/client';
import { subDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportService } from '../import.service';
import { extractXmlFiles } from '../archive';
import { MailConfig, loadMailConfig } from './mail-config';
import { MAILBOX_FACTORY, MailRef, Mailbox, MailboxFactory } from './mailbox';
import { StatementMail, parseStatementMail } from './statement-mail';

type MailMeta = Partial<Pick<StatementMail, 'sender' | 'subject' | 'sentAt'>>;

/** Failed messages are retried automatically this many times, then only via re-run. */
export const MAX_AUTO_ATTEMPTS = 3;
const STARTUP_DELAY_MS = 10_000;

export interface MailCheckResult {
  startedAt: Date;
  finishedAt: Date | null;
  found: number;
  processed: number;
  failed: number;
  skipped: number;
  error: string | null;
}

interface Outcome {
  status: MailMessageStatus;
  fileCount: number;
  error: string | null;
}

@Injectable()
export class MailImportService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MailImportService.name);
  private readonly config: MailConfig | null;
  private running: Promise<MailCheckResult> | null = null;
  private lastCheck: MailCheckResult | null = null;
  private startupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly importService: ImportService,
    @Inject(MAILBOX_FACTORY) private readonly openMailbox: MailboxFactory,
    config: ConfigService,
  ) {
    this.config = loadMailConfig(config);
  }

  get enabled() {
    return this.config !== null;
  }

  // Catches up on whatever arrived while the app (or the Mac) was off.
  onApplicationBootstrap() {
    if (!this.config) {
      this.logger.log('Mailbox import disabled: IMAP_* settings missing');
      return;
    }
    this.startupTimer = setTimeout(
      () => void this.scheduledCheck(),
      STARTUP_DELAY_MS,
    );
    this.startupTimer.unref();
  }

  onApplicationShutdown() {
    clearTimeout(this.startupTimer);
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'mail-import' })
  async scheduledCheck() {
    if (!this.config) return;
    await this.check().catch(() => undefined);
  }

  status() {
    return {
      enabled: this.enabled,
      running: this.running !== null,
      folder: this.config?.folder ?? null,
      allowedSenders: this.config?.allowedSenders ?? [],
      lookbackDays: this.config?.lookbackDays ?? null,
      lastCheck: this.lastCheck,
    };
  }

  /** Runs one mailbox check; concurrent callers share the run in progress. */
  check(): Promise<MailCheckResult> {
    const config = this.requireConfig();
    this.running ??= this.runCheck(config).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Fetches one message again and imports it regardless of its earlier outcome. */
  async rerun(id: string): Promise<MailMessage> {
    const config = this.requireConfig();
    const record = await this.prisma.mailMessage.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Mail message ${id} not found`);

    const mailbox = await this.openMailbox(config);
    try {
      const ref = await mailbox.findByMessageId(record.messageId);
      if (!ref) {
        return this.save(record, {
          status: 'FAILED',
          fileCount: 0,
          error: 'The message is no longer in the mailbox',
        });
      }
      return await this.processMessage(mailbox, ref, config);
    } finally {
      await mailbox.close();
    }
  }

  private async runCheck(config: MailConfig): Promise<MailCheckResult> {
    const result: MailCheckResult = {
      startedAt: new Date(),
      finishedAt: null,
      found: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      error: null,
    };
    this.lastCheck = result;

    let mailbox: Mailbox | null = null;
    try {
      mailbox = await this.openMailbox(config);
      const candidates = await mailbox.findCandidates(
        config.allowedSenders,
        subDays(new Date(), config.lookbackDays),
      );
      const pending = await this.withoutHandled(candidates);
      result.found = pending.length;

      for (const ref of pending) {
        const saved = await this.processMessage(mailbox, ref, config);
        if (saved.status === 'PROCESSED') result.processed++;
        else if (saved.status === 'FAILED') result.failed++;
        else result.skipped++;
      }
    } catch (e) {
      result.error = (e as Error).message;
      this.logger.error(`Mailbox check failed: ${result.error}`);
      throw new ServiceUnavailableException(
        `Mailbox check failed: ${result.error}`,
      );
    } finally {
      await mailbox?.close().catch(() => undefined);
      result.finishedAt = new Date();
      this.logger.log(
        `Mailbox check: ${result.found} new, ${result.processed} imported, ` +
          `${result.failed} failed, ${result.skipped} skipped`,
      );
    }
    return result;
  }

  private async withoutHandled(candidates: MailRef[]) {
    if (candidates.length === 0) return [];
    const known = await this.prisma.mailMessage.findMany({
      where: { messageId: { in: candidates.map((c) => c.messageId) } },
      select: { messageId: true, status: true, attempts: true },
    });
    const done = new Set(
      known
        .filter((k) => k.status !== 'FAILED' || k.attempts >= MAX_AUTO_ATTEMPTS)
        .map((k) => k.messageId),
    );
    const seen = new Set<string>();
    return candidates.filter((c) => {
      if (done.has(c.messageId) || seen.has(c.messageId)) return false;
      seen.add(c.messageId);
      return true;
    });
  }

  private async processMessage(
    mailbox: Mailbox,
    ref: MailRef,
    config: MailConfig,
  ): Promise<MailMessage> {
    let meta: MailMeta = {};
    let outcome: Outcome;
    try {
      const mail = await parseStatementMail(
        await mailbox.download(ref),
        config.allowedSenders,
      );
      meta = mail;
      outcome = await this.importMail(ref, mail, config);
    } catch (e) {
      outcome = { status: 'FAILED', fileCount: 0, error: (e as Error).message };
    }

    const saved = await this.save(ref, outcome, meta);
    if (outcome.status !== 'FAILED') {
      await mailbox
        .markProcessed(ref)
        .catch((e: Error) =>
          this.logger.warn(
            `Could not mark ${ref.messageId} as processed: ${e.message}`,
          ),
        );
    }
    return saved;
  }

  private async importMail(
    ref: MailRef,
    mail: StatementMail,
    config: MailConfig,
  ): Promise<Outcome> {
    if (!mail.senderAllowed) {
      return {
        status: 'SKIPPED',
        fileCount: 0,
        error: `Sender ${mail.sender ?? 'unknown'} is not allow-listed`,
      };
    }
    if (mail.attachments.length === 0) {
      return {
        status: 'SKIPPED',
        fileCount: 0,
        error: 'No XML or ZIP attachment',
      };
    }

    const errors: string[] = [];
    let fileCount = 0;
    for (const attachment of mail.attachments) {
      try {
        const files = await extractXmlFiles(
          attachment.name,
          attachment.content,
          config.zipPassword,
        );
        for (const file of files) {
          await this.importService.importXml(file.name, file.content, {
            source: 'EMAIL',
            messageId: ref.messageId,
            receivedAt: mail.sentAt ?? undefined,
          });
          fileCount++;
        }
      } catch (e) {
        const message = (e as Error).message;
        errors.push(
          message.startsWith(attachment.name)
            ? message
            : `${attachment.name}: ${message}`,
        );
      }
    }
    return {
      status: errors.length > 0 ? 'FAILED' : 'PROCESSED',
      fileCount,
      error: errors.length > 0 ? errors.join('; ') : null,
    };
  }

  private save(
    ref: Pick<MailRef, 'messageId' | 'folder'>,
    outcome: Outcome,
    meta: MailMeta = {},
  ) {
    const data = {
      folder: ref.folder,
      sender: meta.sender ?? undefined,
      subject: meta.subject ?? undefined,
      sentAt: meta.sentAt ?? undefined,
      status: outcome.status,
      fileCount: outcome.fileCount,
      error: outcome.error,
    };
    return this.prisma.mailMessage.upsert({
      where: { messageId: ref.messageId },
      create: { messageId: ref.messageId, ...data },
      update: { ...data, attempts: { increment: 1 } },
    });
  }

  private requireConfig(): MailConfig {
    if (!this.config) {
      throw new ServiceUnavailableException(
        'Mailbox import is not configured. Set the IMAP_* variables in backend/.env.',
      );
    }
    return this.config;
  }
}
