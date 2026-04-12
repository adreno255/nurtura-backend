import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityQueryDto } from './activity-query.dto';

export enum PlantCareEventFilter {
    WATERING = 'watering',
    LIGHT = 'light',
}

export class PlantCareActivityQueryDto extends ActivityQueryDto {
    @ApiPropertyOptional({
        description:
            'Filter by event type group. "watering" returns WATERING_START and WATERING_STOP. "light" returns LIGHT_ON and LIGHT_OFF. Omit for all.',
        enum: PlantCareEventFilter,
    })
    @IsOptional()
    @IsEnum(PlantCareEventFilter)
    event?: PlantCareEventFilter;
}
