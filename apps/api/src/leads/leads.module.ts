import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadConversionService } from './lead-conversion.service';
import { LeadAssignmentService } from './lead-assignment.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadConversionService, LeadAssignmentService],
  exports: [LeadsService, LeadConversionService, LeadAssignmentService],
})
export class LeadsModule {}
