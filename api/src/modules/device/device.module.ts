import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { DeviceMetric } from './entities/device-metric.entity';
import { DeviceService } from './services/device.service';
import { DeviceClientController } from './controllers/device-client.controller';
import { DeviceAdminController } from './controllers/device-admin.controller';
import { User } from '../auth/entities/user.entity';
import { TransitModule } from '../transit/transit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Device, DeviceMetric, User]), TransitModule],
  providers: [DeviceService],
  controllers: [DeviceClientController, DeviceAdminController],
  exports: [DeviceService]
})
export class DeviceModule {}
