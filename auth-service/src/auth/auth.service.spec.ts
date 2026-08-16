import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from './auth.service';
import { UsersService, User } from '../users/users.service';

// Mesma lógica de resolução de chaves usada em auth.module.ts
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

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const testCredentialInput = crypto.randomBytes(9).toString('base64url');
  let testUser: User;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(testCredentialInput, 10);
    testUser = {
      id: 1,
      username: 'admin',
      password: passwordHash,
      role: 'admin',
    };
  });

  beforeEach(async () => {
    const usersServiceMock: Partial<UsersService> = {
      findOne: jest.fn((username: string) =>
        username === testUser.username ? testUser : undefined,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          privateKey: readKeyFile('private.pem'),
          publicKey: readKeyFile('public.pem'),
          signOptions: { algorithm: 'RS256', expiresIn: '8h' },
        }),
      ],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('validateUser — hashing e comparação de senha (bcrypt)', () => {
    it('retorna o usuário sem a senha quando a senha bate com o hash', async () => {
      const result = await authService.validateUser(
        testUser.username,
        testCredentialInput,
      );
      expect(result).toEqual({
        id: testUser.id,
        username: testUser.username,
        role: testUser.role,
      });
      expect((result as Partial<User>).password).toBeUndefined();
    });

    it('lança UnauthorizedException quando a senha não bate com o hash', async () => {
      await expect(
        authService.validateUser(testUser.username, 'senha-errada'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException para usuário inexistente', async () => {
      await expect(
        authService.validateUser('nao-existe', testCredentialInput),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login — geração de token JWT', () => {
    it('gera um access_token assinado (RS256) e válido para credenciais corretas', async () => {
      const result = await authService.login(
        testUser.username,
        testCredentialInput,
      );

      expect(result.access_token).toBeDefined();

      const decoded: { sub: number; username: string; role: string } =
        jwtService.verify(result.access_token);
      expect(decoded.sub).toBe(testUser.id);
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.role).toBe(testUser.role);
    });

    it('não gera token e lança UnauthorizedException para senha incorreta', async () => {
      await expect(
        authService.login(testUser.username, 'senha-errada'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verificação de token JWT (JwtService, RS256)', () => {
    it('lança erro ao verificar um token com a assinatura adulterada', async () => {
      const { access_token } = await authService.login(
        testUser.username,
        testCredentialInput,
      );

      const parts = access_token.split('.');
      const signature = parts[2];
      // Garante que o caractere realmente muda, não importa qual seja o original.
      const corruptedChar = signature[0] === 'a' ? 'b' : 'a';
      parts[2] = corruptedChar + signature.slice(1);
      const tampered = parts.join('.');

      expect(() => {
        jwtService.verify(tampered);
      }).toThrow();
    });

    it('lança erro ao verificar um token expirado', () => {
      const expiredToken = jwtService.sign(
        { sub: testUser.id, username: testUser.username, role: testUser.role },
        { expiresIn: '-1s' },
      );

      expect(() => {
        jwtService.verify(expiredToken);
      }).toThrow();
    });
  });
});
