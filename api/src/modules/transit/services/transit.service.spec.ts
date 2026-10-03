import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransitService } from './transit.service';

describe('TransitService', () => {
  let service: TransitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransitService]
    }).compile();

    service = module.get<TransitService>(TransitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('formatLine', () => {
    it('formats single letter S-bahn lines correctly without space', () => {
      expect(service.formatLine({ category: 'S', number: '2' })).toBe('S2');
      expect(service.formatLine({ category: 'U', number: '1' })).toBe('U1');
    });

    it('formats multi-letter train categories with space', () => {
      expect(service.formatLine({ category: 'IR', number: '36' })).toBe('IR 36');
      expect(service.formatLine({ category: 'IC', number: '1' })).toBe('IC 1');
    });

    it('falls back to name or category when number is absent', () => {
      expect(service.formatLine({ name: 'Tram 10' })).toBe('Tram 10');
      expect(service.formatLine({ category: 'RE' })).toBe('RE');
      expect(service.formatLine({})).toBe('Unknown');
    });
  });

  describe('getDepartures', () => {
    afterEach(() => jest.restoreAllMocks());

    it('reports the provider as unavailable instead of inventing departures', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
      await expect(service.getDepartures('Unreachable Test Station', 5)).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it('serves a stale cached board while the provider is down', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          stationboard: [
            { category: 'S', number: '2', to: 'Uster', stop: { departureTimestamp: 1780000000 } }
          ]
        })
      } as Response);
      await service.getDepartures('Stale Cache Station', 5);
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000); // past the 30 s TTL
      fetchSpy.mockRejectedValue(new Error('ECONNRESET'));
      expect((await service.getDepartures('Stale Cache Station', 5))[0].line).toBe('S2');
    });
  });

  describe('getDepartures enrichment', () => {
    afterEach(() => jest.restoreAllMocks());

    it('passes through platform, category and delay so screens can filter and show them', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          stationboard: [
            {
              category: 'S',
              number: '2',
              to: 'Zürich Flughafen',
              stop: { departureTimestamp: 1780000000, delay: 3, platform: '31' }
            },
            {
              category: 'B',
              number: '32',
              to: 'Strassenverkehrsamt',
              stop: { departureTimestamp: 1780000300 }
            }
          ]
        })
      } as Response);

      const departures = await service.getDepartures('Enrich Test Station', 10);
      expect(departures[0]).toEqual({
        timestamp: 1780000000 + 180,
        line: 'S2',
        destination: 'Zürich Flughafen',
        category: 'S',
        platform: '31',
        delayMinutes: 3
      });
      expect(departures[1]).toMatchObject({ category: 'B', platform: null, delayMinutes: 0 });
    });
  });
});
