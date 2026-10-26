import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

const STATUS_BY_CODE: Record<string, { status: HttpStatus; message: string }> = {
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found' },
  P2003: { status: HttpStatus.BAD_REQUEST, message: 'Referenced record does not exist' },
  P2002: { status: HttpStatus.CONFLICT, message: 'Record already exists' },
};

/** Maps known Prisma errors to 4xx responses; anything else falls through to Nest's default 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = STATUS_BY_CODE[exception.code];
    if (!mapped) {
      return super.catch(exception, host);
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(mapped.status)
      .json({
        statusCode: mapped.status,
        message: mapped.message,
        error: HttpStatus[mapped.status],
      });
  }
}
