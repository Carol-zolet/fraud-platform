import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';

function readKeyFile(filename: string): Buffer {
  const candidates = [
    path.join(process.cwd(), 'keys', filename),
    path.join(process.cwd(), '..', 'keys', filename),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Chave não encontrada: ${filename} (procurado em ${candidates.join(', ')})`);
  }
  return fs.readFileSync(found);
}

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        privateKey: readKeyFile('private.pem'),
        signOptions: { algorithm: 'RS256', expiresIn: '8h' },
      }),
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
