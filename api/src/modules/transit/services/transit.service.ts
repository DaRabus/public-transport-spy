import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { StationLocationDto, TransitDepartureDto } from '../dto/transit-departure.dto';

interface CachedBoard {
  fetchedAt: number;
  departures: TransitDepartureDto[];
}

@Injectable()
export class TransitService {
  private readonly logger = new Logger(TransitService.name);
  private readonly cache = new Map<string, CachedBoard>();
  private readonly cacheTtlMs = 30_000; // 30 seconds cache

  formatLine(item: { name?: string; category?: string; number?: string }): string {
    const category = item.category?.trim();
    const number = item.number?.trim();

    if (category && number) {
      if (category.length === 1 && /[A-Za-z]/.test(category)) {
        return `${category}${number}`;
      }
      return `${category} ${number}`;
    }

    if (item.name && item.name.length <= 10) {
      return item.name;
    }

    return category || item.name || 'Unknown';
  }

  async getDepartures(stationName: string, limit = 8): Promise<TransitDepartureDto[]> {
    const normalizedKey = stationName.trim().toLowerCase();
    const now = Date.now();
    const cached = this.cache.get(normalizedKey);

    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.departures.slice(0, limit);
    }

    try {
      const url = `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(
        stationName
      )}&limit=${Math.max(limit, 40)}`; // extra depth so screen filters still find enough rows

      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'PublicTransportSpy/1.0' },
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        throw new Error(`Upstream returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        stationboard?: Array<{
          name?: string;
          category?: string;
          number?: string;
          to?: string;
          stop?: {
            departureTimestamp?: number;
            delay?: number | null;
            platform?: string | null;
          };
        }>;
      };

      const items = data.stationboard || [];
      const departures: TransitDepartureDto[] = items.map((item) => {
        const baseTimestamp = item.stop?.departureTimestamp ?? Math.floor(now / 1000);
        const delayMinutes = item.stop?.delay ?? 0;
        const effectiveTimestamp = baseTimestamp + delayMinutes * 60;

        return {
          timestamp: effectiveTimestamp,
          line: this.formatLine(item),
          destination: item.to || 'Unknown',
          category: item.category?.trim() || undefined,
          platform: item.stop?.platform || null,
          delayMinutes
        };
      });

      this.cache.set(normalizedKey, {
        fetchedAt: now,
        departures
      });

      return departures.slice(0, limit);
    } catch (err) {
      this.logger.warn(
        { err, station: stationName },
        'Failed to fetch live departures from transport.opendata.ch; serving stale cache if available'
      );

      // Return stale cache if available
      if (cached) {
        return cached.departures.slice(0, limit);
      }

      // Never invent departures: callers show "timetable unavailable" instead of plausible fake trains.
      throw new ServiceUnavailableException('Timetable provider is unavailable');
    }
  }

  async searchStations(query: string, limit = 10): Promise<StationLocationDto[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const url = `https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(
        query.trim()
      )}&type=station`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'PublicTransportSpy/1.0' },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as {
        stations?: Array<{
          id?: string;
          name?: string;
          coordinate?: { x?: number; y?: number };
        }>;
      };

      const stations = data.stations || [];
      return stations.slice(0, limit).map((s) => ({
        id: s.id || '',
        name: s.name || '',
        latitude: s.coordinate?.x ?? null,
        longitude: s.coordinate?.y ?? null
      }));
    } catch (err) {
      this.logger.warn({ err, query }, 'Failed to search stations');
      return [];
    }
  }
}
