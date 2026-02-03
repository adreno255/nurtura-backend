import { IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRackDto {
    @ApiPropertyOptional({
        example: 'Kitchen Farm',
        description: 'Name of the rack',
        maxLength: 200,
    })
    @IsString()
    @IsOptional()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({
        example: 'nurtura/rack/kitchen',
        description: 'Custom MQTT topic for this rack',
        maxLength: 255,
    })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    mqttTopic?: string;

    @ApiPropertyOptional({
        example: 'Updated rack for growing tomatoes',
        description: 'Description of the rack',
        maxLength: 1000,
    })
    @IsString()
    @IsOptional()
    @MaxLength(1000)
    description?: string;
}
