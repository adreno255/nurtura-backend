import { IsString, IsNotEmpty, Matches, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRackDto {
    @ApiProperty({
        example: 'Living Room Farm',
        description: 'Name of the rack',
        maxLength: 200,
    })
    @IsString()
    @IsNotEmpty({ message: 'Rack name is required' })
    @MaxLength(200)
    name!: string;

    @ApiProperty({
        example: 'AA:BB:CC:DD:EE:FF',
        description: 'MAC address of the ESP32 device (format: XX:XX:XX:XX:XX:XX)',
        pattern: '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$',
    })
    @IsString()
    @IsNotEmpty({ message: 'MAC address is required' })
    @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, {
        message: 'MAC address must be in format XX:XX:XX:XX:XX:XX',
    })
    macAddress!: string;

    @ApiPropertyOptional({
        example: 'nurtura/rack/living-room',
        description: 'Custom MQTT topic for this rack',
        maxLength: 255,
    })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    mqttTopic?: string;

    @ApiPropertyOptional({
        example: 'Rack for growing herbs and leafy greens',
        description: 'Description of the rack',
        maxLength: 1000,
    })
    @IsString()
    @IsOptional()
    @MaxLength(1000)
    description?: string;
}
