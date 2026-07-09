import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, KafkaContext, Ctx } from '@nestjs/microservices';
import { AuditService } from './audit.service';

@Controller()
export class AuditConsumer {
  private readonly logger = new Logger(AuditConsumer.name);

  constructor(private readonly auditService: AuditService) {}

  @MessagePattern('transactions.predictions')
  async handlePrediction(@Payload() message: any, @Ctx() context: KafkaContext) {
    const offset = context.getMessage().offset;
    const partition = context.getPartition();
    this.logger.log('[KAFKA] Received | partition=' + partition + ' | offset=' + offset);
    try {
      const payload = typeof message === 'string' ? JSON.parse(message) : message;
      await this.auditService.savePrediction(payload, offset, partition);
    } catch (error) {
      this.logger.error('[KAFKA] Failed: ' + error.message);
    }
  }
}
