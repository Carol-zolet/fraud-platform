import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('AuditService');
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'audit-service',
        brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
      },
      consumer: {
        groupId: 'audit-consumer-group',
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(3003);

  logger.log('Audit Service rodando em http://localhost:3003');
  logger.log('Consumindo Kafka: transactions.predictions');
}

bootstrap();
