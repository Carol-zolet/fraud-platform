import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Token obrigatório');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      request['user'] = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    return true;
  }
}
