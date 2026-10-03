import { Module } from '@nestjs/common';
import { TransitService } from './services/transit.service';
import { TransitController } from './controllers/transit.controller';

@Module({
  providers: [TransitService],
  controllers: [TransitController],
  exports: [TransitService]
})
export class TransitModule {}
