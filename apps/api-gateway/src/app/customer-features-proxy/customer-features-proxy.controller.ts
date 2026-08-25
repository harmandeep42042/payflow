import { All, Controller, Req, UseGuards } from '@nestjs/common';
import { GatewayJwtAuthGuard } from '../gateway-auth/guards/gateway-jwt-auth.guard';
import { CustomerFeaturesProxyService } from './customer-features-proxy.service';

type ProxyRequest = { method: string; url: string; query: Record<string, unknown>; body: unknown; headers: { authorization?: string } };

@UseGuards(GatewayJwtAuthGuard)
@Controller('customer-features')
export class CustomerFeaturesProxyController {
  constructor(private readonly proxy: CustomerFeaturesProxyService) {}
  @All('{*path}')
  forward(@Req() request: ProxyRequest) {
    const rawPath = request.url.split('?')[0] ?? '';
    const marker = '/customer-features';
    const path = rawPath.slice(rawPath.indexOf(marker) + marker.length) || '/';
    return this.proxy.forward(request.method, path, request.query, request.body, request.headers.authorization);
  }
}
