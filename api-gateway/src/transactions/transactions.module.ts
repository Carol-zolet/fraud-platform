import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        publicKey: readKeyFile('public.pem'),
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
