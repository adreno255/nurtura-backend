import { IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SensorsCommandDto {
    @ApiProperty({
        example: 'on',
        description: 'Action to perform on sensors',
        enum: ['on', 'off'],
    })
    @IsNotEmpty({ message: 'Action is required' })
    @IsIn(['on', 'off'], { message: 'Action must be either "on" or "off"' })
    action!: 'on' | 'off';
}
