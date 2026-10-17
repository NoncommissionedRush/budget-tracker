import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });
}

describe('PrismaExceptionFilter', () => {
  let res: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;
  const filter = new PrismaExceptionFilter();

  beforeEach(() => {
    res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    host = {
      switchToHttp: () => ({ getResponse: () => res }),
    } as unknown as ArgumentsHost;
  });

  it.each([
    ['P2025', 404],
    ['P2003', 400],
    ['P2002', 409],
  ])('maps %s to %i', (code, status) => {
    filter.catch(prismaError(code), host);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: status }));
  });

  it('leaves other Prisma errors to the default handler', () => {
    const fallback = jest
      .spyOn(Object.getPrototypeOf(PrismaExceptionFilter.prototype), 'catch')
      .mockImplementation(() => undefined);
    filter.catch(prismaError('P1001'), host);
    expect(fallback).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    fallback.mockRestore();
  });
});
