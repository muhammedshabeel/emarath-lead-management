import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { AdminOnly } from '../auth/decorators/roles.decorator';
import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

class CreateEmSeriesBodyDto {
  @IsString() country: string;
  @IsString() prefix: string;
  @IsNumber() @Min(1) @IsOptional() nextCounter?: number;
  @IsBoolean() @IsOptional() active?: boolean;
}

class UpdateEmSeriesBodyDto {
  @IsString() @IsOptional() prefix?: string;
  @IsNumber() @Min(1) @IsOptional() nextCounter?: number;
  @IsBoolean() @IsOptional() active?: boolean;
}

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ============ EM SERIES ============

  @Get('em-series')
  @AdminOnly()
  @ApiOperation({ summary: 'List all EM series settings' })
  async getEmSeries() {
    return this.settingsService.getEmSeries();
  }

  @Get('em-series/:country')
  @AdminOnly()
  @ApiOperation({ summary: 'Get EM series by country' })
  async getEmSeriesByCountry(@Param('country') country: string) {
    return this.settingsService.getEmSeriesByCountry(country);
  }

  @Post('em-series')
  @AdminOnly()
  @ApiOperation({ summary: 'Create EM series' })
  async createEmSeries(@Body() dto: CreateEmSeriesBodyDto) {
    return this.settingsService.createEmSeries(dto);
  }

  @Put('em-series/:country')
  @AdminOnly()
  @ApiOperation({ summary: 'Update EM series' })
  async updateEmSeries(@Param('country') country: string, @Body() dto: UpdateEmSeriesBodyDto) {
    return this.settingsService.updateEmSeries(country, dto);
  }

  @Delete('em-series/:country')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete EM series' })
  async deleteEmSeries(@Param('country') country: string) {
    return this.settingsService.deleteEmSeries(country);
  }

  // ============ DASHBOARD ============

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats() {
    return this.settingsService.getDashboardStats();
  }
}
