import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { PrismaService } from './../src/prisma/prisma.service';

// Runs the real HTTP stack (validation, filters, routing) against a mocked Prisma client.
describe('Budget API (e2e)', () => {
  let app: INestApplication;
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
    incomeConfig: { findFirst: jest.fn() },
    category: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    subcategory: { findFirst: jest.fn() },
    expense: { findMany: jest.fn(), create: jest.fn() },
    importBatch: { findUnique: jest.fn(), create: jest.fn() },
    bankTransaction: { findMany: jest.fn(), findUnique: jest.fn(), createMany: jest.fn() },
    categorizationRule: { findMany: jest.fn(), create: jest.fn(), aggregate: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  describe('GET /api/v1/dashboard', () => {
    beforeEach(() => {
      prisma.incomeConfig.findFirst.mockResolvedValue({
        monthlyAmount: new Prisma.Decimal(2000),
        incomeDay: 25,
      });
      prisma.category.findMany.mockResolvedValue([]);
      prisma.expense.findMany.mockResolvedValue([]);
    });

    it('returns the selected month', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard?year=2026&month=7')
        .expect(200);
      expect(res.body.period).toMatchObject({
        year: 2026,
        month: 7,
        periodStart: '2026-07-25',
        periodEnd: '2026-08-24',
      });
    });

    it('rejects an invalid month', () =>
      request(app.getHttpServer()).get('/api/v1/dashboard?year=2026&month=13').expect(400));
  });

  describe('POST /api/v1/expenses', () => {
    const body = { categoryId: 'ghost', amount: 5, description: 'x', expenseDate: '2026-10-16' };

    it('returns 400 for an unknown category', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      const res = await request(app.getHttpServer()).post('/api/v1/expenses').send(body).expect(400);
      expect(res.body.message).toContain('ghost');
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('returns 400 for a foreign-key violation', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'ghost' });
      prisma.expense.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'test' }),
      );
      await request(app.getHttpServer()).post('/api/v1/expenses').send(body).expect(400);
    });
  });

  it('PATCH /api/v1/categories/reorder returns 400 for unknown ids', async () => {
    prisma.category.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .patch('/api/v1/categories/reorder')
      .send({ order: ['ghost'] })
      .expect(400);
  });

  it('maps a missing record (P2025) to 404', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', isUnbudgeted: false });
    prisma.category.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: 'test' }),
    );
    await request(app.getHttpServer())
      .patch('/api/v1/categories/c1')
      .send({ name: 'Food' })
      .expect(404);
  });

  describe('POST /api/v1/import/upload', () => {
    const fixture = readFileSync(
      join(__dirname, '../src/import/parsers/__fixtures__/camt053-synthetic.xml'),
    );

    it('imports an uploaded XML statement', async () => {
      prisma.importBatch.findUnique.mockResolvedValue(null);
      prisma.importBatch.create.mockImplementation(({ data }) => ({ id: 'b1', ...data }));
      prisma.bankTransaction.findMany.mockResolvedValue([]);
      prisma.bankTransaction.createMany.mockResolvedValue({ count: 8 });
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));

      const res = await request(app.getHttpServer())
        .post('/api/v1/import/upload')
        .attach('file', fixture, 'statement.xml')
        .expect(200);
      expect(res.body.files[0]).toMatchObject({ status: 'imported', importedCount: 8 });
    });

    it('returns 400 without a file', () =>
      request(app.getHttpServer()).post('/api/v1/import/upload').field('password', 'x').expect(400));

    it('returns 400 for a non-statement file', () =>
      request(app.getHttpServer())
        .post('/api/v1/import/upload')
        .attach('file', Buffer.from('hello'), 'notes.txt')
        .expect(400));
  });

  describe('rules and review', () => {
    it('creates a rule', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat' });
      prisma.categorizationRule.aggregate.mockResolvedValue({ _max: { priority: null } });
      prisma.categorizationRule.create.mockImplementation(({ data }) => ({ id: 'r1', ...data }));
      const res = await request(app.getHttpServer())
        .post('/api/v1/rules')
        .send({ field: 'COUNTERPARTY_NAME', pattern: 'Coffee', categoryId: 'cat' })
        .expect(201);
      expect(res.body).toMatchObject({ id: 'r1', priority: 0, matchType: 'CONTAINS' });
    });

    it('rejects an unknown rule field', () =>
      request(app.getHttpServer())
        .post('/api/v1/rules')
        .send({ field: 'AMOUNT', pattern: 'x', categoryId: 'cat' })
        .expect(400));

    it('validates the "always do this" rule of a correction', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/review/t1/categorize')
        .send({ categoryId: 'cat', rule: { matchType: 'REGEX' } })
        .expect(400);
      expect(prisma.bankTransaction.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown transaction', async () => {
      prisma.bankTransaction.findUnique.mockResolvedValue(null);
      await request(app.getHttpServer()).post('/api/v1/review/ghost/ignore').send({}).expect(404);
    });
  });
});
