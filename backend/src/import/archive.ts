import { BadRequestException } from '@nestjs/common';
import {
  FileEntry,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  configure,
} from '@zip.js/zip.js';

configure({ useWebWorkers: false });

export const MAX_XML_BYTES = 20 * 1024 * 1024;

export interface ExtractedFile {
  name: string;
  content: Buffer;
}

export function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50;
}

/** Returns the XML files from an upload: the file itself, or every `.xml` inside a ZIP. */
export async function extractXmlFiles(
  name: string,
  content: Buffer,
  password?: string,
): Promise<ExtractedFile[]> {
  if (!isZip(content)) return [{ name, content }];

  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(content)));
  try {
    const entries = (await reader.getEntries()).filter(
      (e): e is FileEntry =>
        !e.directory && e.filename.toLowerCase().endsWith('.xml'),
    );
    if (entries.length === 0)
      throw new BadRequestException('The ZIP file contains no XML files');

    const files: ExtractedFile[] = [];
    for (const entry of entries) {
      if (entry.uncompressedSize > MAX_XML_BYTES) {
        throw new BadRequestException(`${entry.filename} is too large`);
      }
      if (entry.encrypted && !password) {
        throw new BadRequestException(
          'The ZIP file is password-protected; enter the password',
        );
      }
      let data: Uint8Array;
      try {
        data = await entry.getData(new Uint8ArrayWriter(), { password });
      } catch (e) {
        if (/password/i.test((e as Error).message)) {
          throw new BadRequestException('Wrong ZIP password');
        }
        throw new BadRequestException(`Could not extract ${entry.filename}`);
      }
      files.push({ name: entry.filename, content: Buffer.from(data) });
    }
    return files;
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException('Could not read the ZIP file');
  } finally {
    await reader.close();
  }
}
