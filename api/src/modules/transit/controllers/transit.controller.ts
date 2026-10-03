import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransitService } from '../services/transit.service';
import { StationLocationDto, TransitStationboardResponseDto } from '../dto/transit-departure.dto';

@ApiTags('transit')
@Controller({ path: 'transit', version: '1' })
export class TransitController {
  constructor(private readonly transitService: TransitService) {}

  @Get('departures')
  @ApiOperation({ summary: 'Preview departures for a station' })
  @ApiQuery({ name: 'station', required: false, example: 'Zürich HB' })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  @ApiOkResponse({ type: TransitStationboardResponseDto })
  async getDepartures(
    @Query('station') station = 'Zürich HB',
    @Query('limit') limit = 8
  ): Promise<TransitStationboardResponseDto> {
    const departures = await this.transitService.getDepartures(station, Number(limit) || 8);
    return {
      station,
      departures
    };
  }

  @Get('stations')
  @ApiOperation({ summary: 'Search stations by query string' })
  @ApiQuery({ name: 'query', required: true, example: 'Zürich' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({ type: [StationLocationDto] })
  async searchStations(
    @Query('query') query: string,
    @Query('limit') limit = 10
  ): Promise<StationLocationDto[]> {
    return this.transitService.searchStations(query, Number(limit) || 10);
  }
}
