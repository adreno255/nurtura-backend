import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckEmailAvailabilityDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address to check availability',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    email!: string;
}
