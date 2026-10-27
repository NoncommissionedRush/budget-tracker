export interface RawAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

/** Builds a minimal multipart email, like the bank's statement notifications. */
export function rawMail(opts: {
  from?: string;
  subject?: string;
  messageId?: string;
  attachments?: RawAttachment[];
}): Buffer {
  const boundary = 'BOUNDARY-test';
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Your daily statement is attached.',
    ...(opts.attachments ?? []).flatMap((a) => [
      `--${boundary}`,
      `Content-Type: ${a.contentType}; name="${a.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${a.filename}"`,
      '',
      a.content.toString('base64'),
    ]),
    `--${boundary}--`,
  ];
  return Buffer.from(
    [
      `From: Bank <${opts.from ?? 'statements@bank.example'}>`,
      'To: someone@example.com',
      `Subject: ${opts.subject ?? 'Daily statement'}`,
      `Message-ID: ${opts.messageId ?? '<m1@bank.example>'}`,
      'Date: Mon, 26 Oct 2026 07:00:00 +0100',
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      ...parts,
      '',
    ].join('\r\n'),
  );
}
