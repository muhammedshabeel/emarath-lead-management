import { SetMetadata } from '@nestjs/common';
import { StaffRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

// Convenience decorators
export const AdminOnly = () => Roles(StaffRole.ADMIN);
export const AgentOrAdmin = () => Roles(StaffRole.AGENT, StaffRole.ADMIN);
export const CSOnly = () => Roles(StaffRole.CS, StaffRole.ADMIN);
export const DeliveryOnly = () => Roles(StaffRole.DELIVERY, StaffRole.ADMIN);
