import { IsString, IsNotEmpty } from 'class-validator';

export class SubscribeToRackDto {
    @IsString()
    @IsNotEmpty()
    rackId!: string;
}

export class UnsubscribeFromRackDto {
    @IsString()
    @IsNotEmpty()
    rackId!: string;
}
