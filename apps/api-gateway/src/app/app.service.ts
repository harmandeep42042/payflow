import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  }

  getLiveness() {
    return {
      status: 'ok',
      service: 'api-gateway',
      check: 'liveness',
      timestamp: new Date().toISOString(),
    };
  }

  getReadiness() {
    return {
      status: 'ready',
      service: 'api-gateway',
      check: 'readiness',
      timestamp: new Date().toISOString(),
    };
  }
}