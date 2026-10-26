import { BadRequestException } from '@nestjs/common';
import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { extractXmlFiles } from './archive';

async function zip(
  files: Record<string, string>,
  options: { password?: string; zipCrypto?: boolean } = {},
) {
  const writer = new ZipWriter(new Uint8ArrayWriter(), options);
  for (const [name, content] of Object.entries(files)) {
    await writer.add(name, new TextReader(content));
  }
  return Buffer.from(await writer.close());
}

describe('extractXmlFiles', () => {
  it('passes a plain XML file through', async () => {
    const content = Buffer.from('<Document/>');
    expect(await extractXmlFiles('a.xml', content)).toEqual([
      { name: 'a.xml', content },
    ]);
  });

  it('extracts XML files from an unencrypted ZIP and skips other files', async () => {
    const files = await extractXmlFiles(
      's.zip',
      await zip({ 'a.xml': '<A/>', 'readme.txt': 'x' }),
    );
    expect(files.map((f) => [f.name, f.content.toString()])).toEqual([
      ['a.xml', '<A/>'],
    ]);
  });

  it.each([
    ['AES', false],
    ['ZipCrypto', true],
  ])('extracts a %s-encrypted ZIP with the password', async (_, zipCrypto) => {
    const archive = await zip(
      { 'a.xml': '<A/>' },
      { password: '1234', zipCrypto },
    );
    const files = await extractXmlFiles('s.zip', archive, '1234');
    expect(files[0].content.toString()).toBe('<A/>');
  });

  it('asks for a password when the ZIP is encrypted', async () => {
    const archive = await zip({ 'a.xml': '<A/>' }, { password: '1234' });
    await expect(extractXmlFiles('s.zip', archive)).rejects.toThrow(
      'password-protected',
    );
  });

  it('rejects a wrong password', async () => {
    const archive = await zip(
      { 'a.xml': '<A/>' },
      { password: '1234', zipCrypto: true },
    );
    await expect(extractXmlFiles('s.zip', archive, '9999')).rejects.toThrow(
      'Wrong ZIP password',
    );
  });

  it('rejects a ZIP without XML files', async () => {
    await expect(
      extractXmlFiles('s.zip', await zip({ 'a.txt': 'x' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a corrupt ZIP', async () => {
    const corrupt = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(40),
    ]);
    await expect(extractXmlFiles('s.zip', corrupt)).rejects.toThrow(
      'Could not read the ZIP file',
    );
  });
});
