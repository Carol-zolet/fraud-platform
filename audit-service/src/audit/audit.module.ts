import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditConsumer } from './audit.consumer';
import { AuditController } from './audit.controller';
import { JwtAuthGuard } from './jwt-auth.guard';

// Mesma lógica de resolução de chaves usada em transactions.module.ts (api-gateway)
function readKeyFile(filename: string): Buffer {
  const candidates = [
    path.join(process.cwd(), 'keys', filename),
    path.join(process.cwd(), '..', 'keys', filename),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `Chave não encontrada: ${filename} (procurado em ${candidates.join(', ')})`,
    );
  }
  return fs.readFileSync(found);
}

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        publicKey: readKeyFile('public.pem'),
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
  ],
  providers: [AuditService, AuditConsumer, JwtAuthGuard],
  controllers: [AuditController],
})
export class AuditModule {}
