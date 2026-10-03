import { ApiProperty } from '@nestjs/swagger';

export class DeviceHelloResponseDto {
  @ApiProperty({
    description:
      'Absolute URL of the pairing page; the device appends ?code=XXXXXX for its QR code',
    example: 'https://app.example.com/pair'
  })
  pairBaseUrl!: string;
}
