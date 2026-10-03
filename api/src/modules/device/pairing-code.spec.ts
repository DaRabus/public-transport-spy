import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ClaimDeviceDto } from './dto/claim-device.dto';
import { PairDeviceDto } from './dto/pair-device.dto';

const uuid = 'd3b07384-d113-3660-84cf-3b999cd46903';
const pair = (pairingCode: unknown) =>
  plainToInstance(PairDeviceDto, { pairingCode, userId: 'alice' });
const claim = (pairingCode: unknown) =>
  plainToInstance(ClaimDeviceDto, { pairingCode, deviceUuid: uuid });

describe('pairing code format (display shows KV7-9P2, API stores KV79P2)', () => {
  it.each(['KV79P2', 'KV7-9P2', ' kv7 9p2 ', 'kv7-9p2'])(
    'accepts %j and stores it normalized',
    (input) => {
      for (const dto of [pair(input), claim(input)]) {
        expect(validateSync(dto)).toHaveLength(0);
        expect(dto.pairingCode).toBe('KV79P2');
      }
    }
  );

  it.each(['KV79P', 'KV79P2X', 'KV70P2', 'KV7IP2', 'KV7OP2', 'KV7-9P!', '', 123, null])(
    'rejects %j',
    (input) => {
      expect(validateSync(pair(input)).length).toBeGreaterThan(0);
      expect(validateSync(claim(input)).length).toBeGreaterThan(0);
    }
  );
});
