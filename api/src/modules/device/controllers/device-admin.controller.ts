import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DeviceService } from '../services/device.service';
import { DeviceDetailDto, TransferDeviceDto, UpdateDeviceDto } from '../dto/device.dto';
import { PairDeviceDto } from '../dto/pair-device.dto';
import { PreviewScreensDto, ScreensResponseDto } from '../dto/display-profile.dto';
import type { ScreensResponse } from '../screens/screen-composer';
import { DeviceMetricDto } from '../dto/device-metrics-input.dto';
import { TIMEZONE_IDS } from '../timezones/timezones';

@ApiTags('devices')
@ApiSecurity('X-Api-Key')
@Controller({ path: 'devices', version: '1' })
export class DeviceAdminController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered devices (optionally filtered by userId)' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter devices claimed by specific user'
  })
  @ApiOkResponse({ type: [DeviceDetailDto] })
  async list(@Query('userId') userId?: string): Promise<DeviceDetailDto[]> {
    return this.deviceService.listAll(userId);
  }

  // Declared before ':uuid' so "timezones" is not taken for a device id.
  @Get('timezones')
  @ApiOperation({ summary: 'Supported device time zones (IANA names) for the settings picker' })
  @ApiOkResponse({ type: [String] })
  timezones(): string[] {
    return TIMEZONE_IDS;
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get device by hardware UUID' })
  @ApiOkResponse({ type: DeviceDetailDto })
  async getByUuid(@Param('uuid') uuid: string): Promise<DeviceDetailDto> {
    const device = await this.deviceService.findByUuid(uuid);
    if (!device) {
      throw new NotFoundException(`Device '${uuid}' not found`);
    }
    return device;
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Update device settings' })
  @ApiOkResponse({ type: DeviceDetailDto })
  async update(
    @Param('uuid') uuid: string,
    @Body() body: UpdateDeviceDto
  ): Promise<DeviceDetailDto> {
    const updated = await this.deviceService.update(uuid, body);
    if (!updated) {
      throw new NotFoundException(`Device '${uuid}' not found`);
    }
    return updated;
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a device and its telemetry' })
  async delete(@Param('uuid') uuid: string): Promise<void> {
    const deleted = await this.deviceService.remove(uuid);
    if (!deleted) {
      throw new NotFoundException(`Device '${uuid}' not found`);
    }
  }

  @Delete('pending/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Cancel the owner's pending pairing request (no hardware UUID yet) by its internal id"
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'Owner (username); only their pending request is deleted'
  })
  async cancelPending(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('userId') userId?: string
  ): Promise<void> {
    if (!userId) {
      throw new BadRequestException("Missing required parameter: 'userId'");
    }
    await this.deviceService.cancelPendingClaim(id, userId);
  }

  // Shared bucket: requests come from the BFF, not the end user.
  @Post('pair')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim and pair an ESP32 device using its 6-character pairing code' })
  @ApiOkResponse({ type: DeviceDetailDto })
  async pair(@Body() body: PairDeviceDto): Promise<DeviceDetailDto> {
    return this.deviceService.pairDevice(body);
  }

  @Post(':uuid/transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer a display to another account by username (stays paired)' })
  @ApiOkResponse({ type: DeviceDetailDto })
  async transfer(
    @Param('uuid') uuid: string,
    @Body() body: TransferDeviceDto
  ): Promise<DeviceDetailDto> {
    return this.deviceService.transferDevice(uuid, body);
  }

  @Post(':uuid/unpair')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpair a device and return it to pairing mode' })
  @ApiOkResponse({ type: DeviceDetailDto })
  async unpair(@Param('uuid') uuid: string): Promise<DeviceDetailDto> {
    return this.deviceService.unpairDevice(uuid);
  }

  @Get(':uuid/metrics')
  @ApiOperation({ summary: 'Get telemetry history for a device' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiOkResponse({ type: [DeviceMetricDto] })
  async getMetrics(
    @Param('uuid') uuid: string,
    @Query('limit') limit = 50
  ): Promise<DeviceMetricDto[]> {
    return this.deviceService.getMetrics(uuid, Number(limit) || 50);
  }

  @Post(':uuid/screens/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Compose screens from unsaved settings (web app live preview); saves nothing'
  })
  @ApiOkResponse({ type: ScreensResponseDto })
  async previewScreens(
    @Param('uuid') uuid: string,
    @Body() body: PreviewScreensDto
  ): Promise<ScreensResponse> {
    return this.deviceService.previewScreens(uuid, body);
  }
}
