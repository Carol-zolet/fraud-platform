import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

interface TransactionPayload {
  amount: number;
  merchant: string;
  location: string;
  userId: number;
  role: string;
}

@Injectable()
export class TransactionsService implements OnModuleInit {
  private producer: Producer;
  private kafka: Kafka;

  constructor(private readonly configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'api-gateway',
      brokers: [
        this.configService.get<string>('KAFKA_BROKER', 'localhost:29092'),
      ],
    });
  }

  async onModuleInit() {
    this.producer = this.kafka.producer();
    await this.producer.connect();
    console.log('Kafka producer conectado!');
  }

  async publish(transaction: TransactionPayload) {
    const message = {
      ...transaction,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    await this.producer.send({
      topic: 'transactions.raw',
      messages: [{ value: JSON.stringify(message) }],
    });

    console.log('Transação publicada no Kafka:', message.id);
    return { success: true, transactionId: message.id, message };
  }
}
