import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Este método "ouve" o Kafka. 
   * Toda vez que a sua IA (Python) envia uma predição, 
   * este código é acionado automaticamente.
   */
  @EventPattern('transactions.predictions')
  async handleTransaction(@Payload() data: any, @Ctx() context: KafkaContext) {
    console.log('--- [KAFKA] NOVA MENSAGEM RECEBIDA ---');
    console.log('Dados da IA:', JSON.stringify(data, null, 2));

    try {
      // Chama o service para salvar no PostgreSQL
      await this.auditService.create(data);
      console.log('✅ Transação salva no banco com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao salvar transação:', error.message);
    }
  }

  // --- Rotas GET (usadas pelo Grafana e Frontend) ---
  // Guard aplicado por método, não na classe: o @EventPattern acima não é uma
  // requisição HTTP (não tem request.headers), então um @UseGuards de classe
  // quebraria o consumo de mensagens do Kafka.

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('limit') limit = 50) {
    return this.auditService.findAll(Number(limit));
  }

  @Get('frauds')
  @UseGuards(JwtAuthGuard)
  async findFrauds(@Query('limit') limit = 50) {
    return this.auditService.findFrauds(Number(limit));
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.auditService.getStats();
  }
}