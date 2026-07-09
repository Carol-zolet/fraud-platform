import { Injectable } from '@nestjs/common';

export type User = {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'analyst' | 'viewer';
};

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    { id: 1, username: 'admin', password: '***BCRYPT_HASH_REMOVED_FROM_HISTORY***', role: 'admin' },
    { id: 2, username: 'analyst', password: '***BCRYPT_HASH_REMOVED_FROM_HISTORY***', role: 'analyst' },
    { id: 3, username: 'viewer', password: '***BCRYPT_HASH_REMOVED_FROM_HISTORY***', role: 'viewer' },
  ];

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }
}
