import { ConfigService } from '@nestjs/config';

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  folder: string;
  processedFolder?: string;
  markSeen: boolean;
  allowedSenders: string[];
  lookbackDays: number;
  zipPassword?: string;
}

export function parseAddressList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns null when the mailbox import is not configured, which disables it. */
export function loadMailConfig(config: ConfigService): MailConfig | null {
  const get = (key: string) => config.get<string>(key)?.trim() || undefined;
  const host = get('IMAP_HOST');
  const user = get('IMAP_USER');
  const password = get('IMAP_PASSWORD');
  const allowedSenders = parseAddressList(get('IMAP_ALLOWED_SENDERS'));
  if (!host || !user || !password || allowedSenders.length === 0) return null;

  const port = Number(get('IMAP_PORT') ?? 993);
  const lookbackDays = Number(get('IMAP_LOOKBACK_DAYS') ?? 14);
  return {
    host,
    port,
    secure: get('IMAP_SECURE') !== 'false',
    user,
    // Gmail shows app passwords in groups of four; IMAP wants them without spaces.
    password: host.endsWith('gmail.com')
      ? password.replace(/\s+/g, '')
      : password,
    folder: get('IMAP_FOLDER') ?? 'INBOX',
    processedFolder: get('IMAP_PROCESSED_FOLDER'),
    markSeen: get('IMAP_MARK_SEEN') !== 'false',
    allowedSenders,
    lookbackDays:
      Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : 14,
    zipPassword: get('STATEMENT_ZIP_PASSWORD'),
  };
}
