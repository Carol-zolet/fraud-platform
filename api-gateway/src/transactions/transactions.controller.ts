import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtService } from '@nestjs/jwt';

class TransactionDto {
  amount: number;
  merchant: string;
  location: string;
}

interface JwtPayload {
  sub: number;
  username: string;
  role: string;
}

@Controller('transactions')
export class TransactionsController {
  constructor(
    private transactionsService: TransactionsService,
    private jwtService: JwtService,
  ) {}

  @Post()
  async create(
    @Body() dto: TransactionDto,
    @Headers('authorization') auth: string,
  ) {
    if (!auth) throw new UnauthorizedException('Token obrigatório');
    const token = auth.replace('Bearer ', '');
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
    return this.transactionsService.publish({
      ...dto,
      userId: payload.sub,
      role: payload.role,
    });
  }
}
