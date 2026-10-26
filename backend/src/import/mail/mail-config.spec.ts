import { ConfigService } from '@nestjs/config';
import { loadMailConfig } from './mail-config';

const configOf = (env: Record<string, string>) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService;

const base = {
  IMAP_HOST: 'imap.gmail.com',
  IMAP_USER: 'someone@gmail.com',
  IMAP_PASSWORD: 'abcd efgh ijkl mnop',
  IMAP_ALLOWED_SENDERS: 'Statements@Bank.example, other@bank.example',
};

describe('loadMailConfig', () => {
  it('is disabled until host, user, password and senders are set', () => {
    expect(loadMailConfig(configOf({}))).toBeNull();
    expect(
      loadMailConfig(configOf({ ...base, IMAP_ALLOWED_SENDERS: ' ' })),
    ).toBeNull();
  });

  it('applies defaults and normalizes values', () => {
    expect(loadMailConfig(configOf(base))).toEqual({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      user: 'someone@gmail.com',
      password: 'abcdefghijklmnop',
      folder: 'INBOX',
      processedFolder: undefined,
      markSeen: true,
      allowedSenders: ['statements@bank.example', 'other@bank.example'],
      lookbackDays: 14,
      zipPassword: undefined,
    });
  });

  it('reads the optional settings', () => {
    expect(
      loadMailConfig(
        configOf({
          ...base,
          IMAP_FOLDER: 'Bank',
          IMAP_PROCESSED_FOLDER: 'Bank/Imported',
          IMAP_MARK_SEEN: 'false',
          IMAP_LOOKBACK_DAYS: '30',
          STATEMENT_ZIP_PASSWORD: '1234',
        }),
      ),
    ).toMatchObject({
      folder: 'Bank',
      processedFolder: 'Bank/Imported',
      markSeen: false,
      lookbackDays: 30,
      zipPassword: '1234',
    });
  });
});
