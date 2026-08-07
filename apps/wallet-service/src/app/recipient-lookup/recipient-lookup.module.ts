import {
  Module,
} from '@nestjs/common';

import {
  PrismaModule,
} from '@payflow/database';

import {
  RecipientLookupController,
} from './recipient-lookup.controller';

import {
  RecipientLookupService,
} from './recipient-lookup.service';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    RecipientLookupController,
  ],

  providers: [
    RecipientLookupService,
  ],
})
export class RecipientLookupModule {}