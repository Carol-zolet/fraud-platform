import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';

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

  @Get()
  async findAll(@Query('limit') limit = 50) {
    return this.auditService.findAll(Number(limit));
  }

  @Get('frauds')
  async findFrauds(@Query('limit') limit = 50) {
    return this.auditService.findFrauds(Number(limit));
  }

  @Get('stats')
  async getStats() {
    return this.auditService.getStats();
  }
}