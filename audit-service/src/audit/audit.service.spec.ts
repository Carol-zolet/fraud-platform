import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn((data: Partial<AuditLog>) => data as AuditLog),
      save: jest.fn((data: Partial<AuditLog>) =>
        Promise.resolve({ id: 'mock-id', createdAt: new Date(), ...data } as AuditLog),
      ),
      find: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: getRepositoryToken(AuditLog), useValue: mockRepo }],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repo = module.get(getRepositoryToken(AuditLog));
  });

  describe('create', () => {
    it('mapeia transaction_id, amount e is_fraud (formato snake_case da IA)', async () => {
      const result = await service.create({
        transaction_id: 'TXN-1',
        amount: '150.50',
        is_fraud: true,
        fraud_score: '0.98',
        user_id: 'user-1',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'TXN-1',
          amount: 150.5,
          isFraud: true,
          fraudScore: 0.98,
          userId: 'user-1',
        }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.transactionId).toBe('TXN-1');
    });

    it('marca isFraud=true quando prediction === "fraud", mesmo sem is_fraud explícito', async () => {
      await service.create({ transaction_id: 'TXN-2', amount: 100, prediction: 'fraud' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isFraud: true }),
      );
    });

    it('usa "unknown" e valores default quando campos essenciais estão ausentes', async () => {
      await service.create({});

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'unknown',
          amount: 0,
          isFraud: false,
          fraudScore: 0,
          userId: null,
        }),
      );
    });
  });

  describe('savePrediction', () => {
    it('persiste offset e partition do Kafka junto com os dados da predição', async () => {
      await service.savePrediction(
        { transaction_id: 'TXN-3', amount: 200, score: 0.75, prediction: 'fraud' },
        '42',
        1,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'TXN-3',
          amount: 200,
          fraudScore: 0.75,
          isFraud: true,
          kafkaOffset: '42',
          kafkaPartition: 1,
        }),
      );
    });

    it('usa kafkaOffset null e partition 0 quando não informados', async () => {
      await service.savePrediction({ transaction_id: 'TXN-4', amount: 10 });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ kafkaOffset: null, kafkaPartition: 0 }),
      );
    });
  });

  describe('findAll', () => {
    it('busca ordenado por createdAt DESC com o limit informado', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);
      await service.findAll(10);

      expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, take: 10 });
    });

    it('usa limit=50 por padrão', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);
      await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, take: 50 });
    });
  });

  describe('findFrauds', () => {
    it('filtra por isFraud=true', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);
      await service.findFrauds(20);

      expect(repo.find).toHaveBeenCalledWith({
        where: { isFraud: true },
        order: { createdAt: 'DESC' },
        take: 20,
      });
    });
  });

  describe('getStats', () => {
    it('calcula total, frauds, normal e fraudRate corretamente', async () => {
      (repo.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(25); // frauds

      const stats = await service.getStats();

      expect(stats).toEqual({ total: 100, frauds: 25, normal: 75, fraudRate: '25.00%' });
    });

    it('retorna fraudRate "0%" quando não há nenhum registro', async () => {
      (repo.count as jest.Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const stats = await service.getStats();

      expect(stats).toEqual({ total: 0, frauds: 0, normal: 0, fraudRate: '0%' });
    });
  });
});
