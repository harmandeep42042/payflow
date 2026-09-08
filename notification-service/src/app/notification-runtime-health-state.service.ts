import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationRuntimeHealthState {
  private rabbitMqStarted = false;

  markRabbitMqStarted(): void {
    this.rabbitMqStarted = true;
  }

  markRabbitMqStopped(): void {
    this.rabbitMqStarted = false;
  }

  isRabbitMqStarted(): boolean {
    return this.rabbitMqStarted;
  }
}