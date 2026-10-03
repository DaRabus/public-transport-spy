import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLERS } from './shared-modules/config/throttling';
import { CommonModule } from './shared-modules/common.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { TransitModule } from './transit/transit.module';
import { DeviceModule } from './device/device.module';
import { AuthModule } from './auth/auth.module';
import { AdminApiKeyGuard } from './shared-modules/guards/admin-api-key.guard';

@Module({
  imports: [
    // No global guard: limits are opted into per endpoint with @UseGuards(ThrottlerGuard) + @Throttle.
    // Browser-facing /v1 routes arrive via the BFF, so all users share one IP there.
    ThrottlerModule.forRoot(THROTTLERS),
    CommonModule,
    DatabaseModule,
    HealthModule,
    TransitModule,
    DeviceModule,
    AuthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AdminApiKeyGuard
    }
  ]
})
export class AppModule {}
