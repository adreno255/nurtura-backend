import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto {
    @ApiProperty({
        example: 'Operation completed successfully',
        description: 'Success message',
    })
    message!: string;
}
