import { Logger } from '@nestjs/common';
import { ImapFlow, MailboxLockObject } from 'imapflow';
import { MailConfig } from './mail-config';

export interface MailRef {
  uid: number;
  messageId: string;
  folder: string;
}

export interface Mailbox {
  /** Messages from the allowed senders received within the lookback window. */
  findCandidates(senders: string[], since: Date): Promise<MailRef[]>;
  findByMessageId(messageId: string): Promise<MailRef | null>;
  download(ref: MailRef): Promise<Buffer>;
  markProcessed(ref: MailRef): Promise<void>;
  close(): Promise<void>;
}

export type MailboxFactory = (config: MailConfig) => Promise<Mailbox>;
export const MAILBOX_FACTORY = Symbol('MAILBOX_FACTORY');

export const openImapMailbox: MailboxFactory = async (config) => {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });
  client.on('error', (e: Error) =>
    new Logger('ImapMailbox').warn(`IMAP connection error: ${e.message}`),
  );
  await client.connect();
  return new ImapMailbox(client, config);
};

class ImapMailbox implements Mailbox {
  private lock: MailboxLockObject | null = null;
  private openFolder: string | null = null;

  constructor(
    private readonly client: ImapFlow,
    private readonly config: MailConfig,
  ) {}

  async findCandidates(senders: string[], since: Date) {
    await this.select(this.config.folder);
    const uids = new Set<number>();
    for (const from of senders) {
      const found = await this.client.search({ from, since }, { uid: true });
      for (const uid of found || []) uids.add(uid);
    }
    return this.refs([...uids]);
  }

  async findByMessageId(messageId: string) {
    const folders = [this.config.folder, this.config.processedFolder].filter(
      (f): f is string => !!f,
    );
    for (const folder of folders) {
      await this.select(folder);
      const found = await this.client.search(
        { header: { 'message-id': messageId } },
        { uid: true },
      );
      const [ref] = await this.refs(found || []);
      if (ref) return ref;
    }
    return null;
  }

  async download(ref: MailRef) {
    await this.select(ref.folder);
    const msg = await this.client.fetchOne(
      String(ref.uid),
      { source: true },
      { uid: true },
    );
    if (!msg || !msg.source) {
      throw new Error('The message is no longer in the mailbox');
    }
    return msg.source;
  }

  async markProcessed(ref: MailRef) {
    await this.select(ref.folder);
    const range = String(ref.uid);
    if (this.config.markSeen) {
      await this.client.messageFlagsAdd(range, ['\\Seen'], { uid: true });
    }
    if (
      this.config.processedFolder &&
      ref.folder !== this.config.processedFolder
    ) {
      await this.client.messageMove(range, this.config.processedFolder, {
        uid: true,
      });
    }
  }

  async close() {
    this.lock?.release();
    this.lock = null;
    await this.client.logout().catch(() => this.client.close());
  }

  private async select(folder: string) {
    if (this.openFolder === folder) return;
    this.lock?.release();
    this.lock = await this.client.getMailboxLock(folder);
    this.openFolder = folder;
  }

  private async refs(uids: number[]): Promise<MailRef[]> {
    if (uids.length === 0) return [];
    const folder = this.openFolder!;
    const refs: MailRef[] = [];
    for await (const msg of this.client.fetch(
      uids.join(','),
      { envelope: true },
      { uid: true },
    )) {
      refs.push({
        uid: msg.uid,
        // Fallback for the rare message without a Message-ID header.
        messageId: msg.envelope?.messageId || `${folder}:${msg.uid}`,
        folder,
      });
    }
    return refs.sort((a, b) => a.uid - b.uid);
  }
}
