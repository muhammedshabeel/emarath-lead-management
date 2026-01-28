import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AdminOnly } from '../auth/decorators/roles.decorator';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @AdminOnly()
  @ApiOperation({ summary: 'Search audit logs' })
  async search(
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.auditService.search({ entityType, action, actorUserId, page, limit });
  }

  @Get('entity/:entityType/:entityId')
  @AdminOnly()
  @ApiOperation({ summary: 'Get audit logs for entity' })
  async getByEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.auditService.getByEntity(entityType, entityId);
  }

  @Get('recent')
  @AdminOnly()
  @ApiOperation({ summary: 'Get recent audit logs' })
  async getRecent(@Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number) {
    return this.auditService.getRecent(limit);
  }
}
