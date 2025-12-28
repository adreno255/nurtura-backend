import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmailQueryDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address to query',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    email!: string;
}
