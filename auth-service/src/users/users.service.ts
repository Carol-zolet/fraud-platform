import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type User = {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'analyst' | 'viewer';
};

@Injectable()
export class UsersService {
  private readonly users: User[];

  constructor(private configService: ConfigService) {
    this.users = [
      {
        id: 1,
        username: 'admin',
        password: this.getRequiredHash('ADMIN_PASSWORD_HASH'),
        role: 'admin',
      },
      {
        id: 2,
        username: 'analyst',
        password: this.getRequiredHash('ANALYST_PASSWORD_HASH'),
        role: 'analyst',
      },
      {
        id: 3,
        username: 'viewer',
        password: this.getRequiredHash('VIEWER_PASSWORD_HASH'),
        role: 'viewer',
      },
    ];
  }

  private getRequiredHash(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Variável de ambiente ${key} não definida`);
    }
    return value;
  }

  findOne(username: string): User | undefined {
    return this.users.find((u) => u.username === username);
  }
}
