import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

    // Método create para criar um novo registro de auditoria
    async create(data: any): Promise<AuditLog> {
      const newLog = this.auditLogRepo.create({
        transactionId: data.transaction_id || data.transactionId || 'unknown',
        amount: parseFloat(data.amount) || 0,
        isFraud: data.is_fraud === true || data.prediction === 'fraud',
        fraudScore: parseFloat(data.fraud_score || data.score) || 0,
        userId: data.user_id || null,
        rawPayload: data,
        kafkaOffset: null,
        kafkaPartition: 0,
      });
      return await this.auditLogRepo.save(newLog);
    }

  async savePrediction(payload: any, kafkaOffset?: string, partition?: number): Promise<AuditLog> {
    const log = this.auditLogRepo.create({
      transactionId: payload.transaction_id || payload.transactionId || 'unknown',
      amount: parseFloat(payload.amount) || 0,
      isFraud: payload.is_fraud === true || payload.prediction === 'fraud',
      fraudScore: parseFloat(payload.fraud_score || payload.score) || 0,
      userId: payload.user_id || null,
      rawPayload: payload,
      kafkaOffset: kafkaOffset || null,
      kafkaPartition: partition || 0,
    });
    const saved = await this.auditLogRepo.save(log);
    this.logger.log('[AUDIT] Saved | txn=' + saved.transactionId + ' | fraud=' + saved.isFraud);
    return saved;
  }

  async findAll(limit = 50): Promise<AuditLog[]> {
    return this.auditLogRepo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async findFrauds(limit = 50): Promise<AuditLog[]> {
    return this.auditLogRepo.find({ where: { isFraud: true }, order: { createdAt: 'DESC' }, take: limit });
  }

  async getStats(): Promise<any> {
    const total = await this.auditLogRepo.count();
    const frauds = await this.auditLogRepo.count({ where: { isFraud: true } });
    return { total, frauds, normal: total - frauds, fraudRate: total > 0 ? ((frauds / total) * 100).toFixed(2) + '%' : '0%' };
  }
}
