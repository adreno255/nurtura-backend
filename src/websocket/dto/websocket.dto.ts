import { IsString, IsNotEmpty } from 'class-validator';

export class SubscribeToRackDto {
    @IsString()
    @IsNotEmpty()
    rackId!: string;

    @IsString()
    @IsNotEmpty()
    userId!: string;
}

export class UnsubscribeFromRackDto {
    @IsString()
    @IsNotEmpty()
    rackId!: string;
}
