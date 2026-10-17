import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
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
});
