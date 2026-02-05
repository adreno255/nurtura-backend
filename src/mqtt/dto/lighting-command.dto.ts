import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

/**
 * DTO for lighting command
 * Topic: nurtura/rack/{macAddress}/commands/lighting
 */
export class LightingCommandDto {
    @ApiProperty({
        example: 'on',
        description: 'Action to perform on grow light',
        enum: ['on', 'off'],
    })
    @IsNotEmpty({ message: 'Action is required' })
    @IsIn(['on', 'off'], { message: 'Action must be either "on" or "off"' })
    action!: 'on' | 'off';
}
