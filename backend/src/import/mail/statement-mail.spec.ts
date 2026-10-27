import { parseStatementMail } from './statement-mail';
import { rawMail } from './__fixtures__/raw-mail';

const SENDER = 'statements@bank.example';
const xml = Buffer.from('<Document/>');

describe('parseStatementMail', () => {
  it('returns XML and ZIP attachments and skips the rest', async () => {
    const mail = await parseStatementMail(
      rawMail({
        attachments: [
          {
            filename: 'V000004.zip',
            contentType: 'application/octet-stream',
            content: Buffer.from('PK'),
          },
          { filename: 'statement.xml', contentType: 'text/xml', content: xml },
          {
            filename: 'terms.pdf',
            contentType: 'application/pdf',
            content: Buffer.from('%PDF'),
          },
        ],
      }),
      [SENDER],
    );

    expect(mail).toMatchObject({
      sender: SENDER,
      subject: 'Daily statement',
      senderAllowed: true,
    });
    expect(mail.sentAt?.toISOString()).toBe('2026-10-26T06:00:00.000Z');
    expect(mail.attachments.map((a) => a.name)).toEqual([
      'V000004.zip',
      'statement.xml',
    ]);
    expect(mail.attachments[1].content.equals(xml)).toBe(true);
  });

  it('rejects senders that only contain an allowed address', async () => {
    const mail = await parseStatementMail(rawMail({ from: `x${SENDER}` }), [
      SENDER,
    ]);
    expect(mail.senderAllowed).toBe(false);
  });

  it('matches the sender case-insensitively', async () => {
    const mail = await parseStatementMail(
      rawMail({ from: 'Statements@Bank.Example' }),
      [SENDER],
    );
    expect(mail.senderAllowed).toBe(true);
  });
});
