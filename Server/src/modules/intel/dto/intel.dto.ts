import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class IntelSubmitDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];
}

export class IntelPreferencesDto {
  @IsOptional()
  @IsArray()
  categories?: string[];

  @IsOptional()
  @IsIn(['daily_1', 'daily_3', 'weekly', 'off'])
  pushFreq?: 'daily_1' | 'daily_3' | 'weekly' | 'off';

  @IsOptional()
  @IsString()
  @MaxLength(5)
  pushTime?: string;
}
