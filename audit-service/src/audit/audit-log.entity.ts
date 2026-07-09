import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ name: 'is_fraud', default: false })
  isFraud: boolean;

  @Column({ name: 'fraud_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  fraudScore: number;

  @Column({ nullable: true })
  userId: string;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload: object;

  @Column({ name: 'kafka_offset', nullable: true })
  kafkaOffset: string;

  @Column({ name: 'kafka_partition', nullable: true })
  kafkaPartition: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
