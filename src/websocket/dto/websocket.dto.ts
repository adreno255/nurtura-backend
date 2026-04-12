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

export class SubscribeToUserNotificationsDto {
    // No payload needed — user identity comes from the authenticated socket
}

export class UnsubscribeFromUserNotificationsDto {
    // No payload needed
}
