import { CamtParser } from './camt-parser';
import {
  ParsedStatement,
  StatementParser,
  UnsupportedFormatError,
} from './statement-parser';

export * from './statement-parser';

const PARSERS: StatementParser[] = [new CamtParser()];

export function parseStatement(xml: string): ParsedStatement {
  const parser = PARSERS.find((p) => p.canParse(xml));
  if (!parser) throw new UnsupportedFormatError('Unsupported statement format');
  return parser.parse(xml);
}
