import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'postgres',
      port: 5432,
      username: 'fraud_user',
      password: 'fraud_pass',
      database: 'fraud_db',
      entities: [AuditLog],
      synchronize: true,
    }),
    AuditModule,
  ],
})
export class AppModule {}
