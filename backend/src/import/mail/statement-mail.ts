import { AddressObject, simpleParser } from 'mailparser';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface StatementMail {
  sender: string | null;
  subject: string | null;
  sentAt: Date | null;
  senderAllowed: boolean;
  attachments: { name: string; content: Buffer }[];
}

const STATEMENT_FILE = /\.(xml|zip)$/i;
const STATEMENT_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/xml',
  'text/xml',
]);

function addresses(from: AddressObject | AddressObject[] | undefined) {
  return (Array.isArray(from) ? from : from ? [from] : [])
    .flatMap((a) => a.value)
    .map((a) => a.address?.toLowerCase())
    .filter((a): a is string => !!a);
}

/** Parses a raw email and returns its statement attachments (XML or ZIP). */
export async function parseStatementMail(
  source: Buffer,
  allowedSenders: string[],
): Promise<StatementMail> {
  const mail = await simpleParser(source);
  const from = addresses(mail.from);
  // IMAP's FROM search is a substring match, so check the exact address here.
  const senderAllowed =
    from.length > 0 && from.every((a) => allowedSenders.includes(a));

  const attachments = mail.attachments
    .filter(
      (a) =>
        (a.filename && STATEMENT_FILE.test(a.filename)) ||
        STATEMENT_TYPES.has(a.contentType.toLowerCase()),
    )
    .filter((a) => a.size <= MAX_ATTACHMENT_BYTES)
    .map((a, i) => ({
      name: a.filename || `attachment-${i + 1}`,
      content: a.content,
    }));

  return {
    sender: from[0] ?? null,
    subject: mail.subject ?? null,
    sentAt: mail.date ?? null,
    senderAllowed,
    attachments,
  };
}
