import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RackExistsDto {
    @ApiProperty({
        example: 'AA:BB:CC:DD:EE:FF',
        description: 'MAC address of the rack',
        pattern: '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$',
    })
    @IsString()
    @IsNotEmpty({ message: 'MAC address is required' })
    @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, {
        message: 'MAC address must be in format XX:XX:XX:XX:XX:XX',
    })
    macAddress!: string;
}
