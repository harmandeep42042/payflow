import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CustomerFeaturesProxyController } from './customer-features-proxy.controller';
import { CustomerFeaturesProxyService } from './customer-features-proxy.service';

@Module({ imports: [HttpModule], controllers: [CustomerFeaturesProxyController], providers: [CustomerFeaturesProxyService] })
export class CustomerFeaturesProxyModule {}
