import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Staff, StaffRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: StaffRole;
  staffId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  country?: string;
  clerkUserId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Validate user from JWT payload
  async validateUser(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.staffId },
    });

    if (!staff || !staff.active) {
      return null;
    }

    return {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      country: staff.country || undefined,
      clerkUserId: staff.clerkUserId || undefined,
    };
  }

  // Create JWT token for staff member
  async createToken(staff: Staff): Promise<string> {
    const payload: JwtPayload = {
      sub: staff.id,
      email: staff.email,
      role: staff.role,
      staffId: staff.id,
    };
    return this.jwtService.sign(payload);
  }

  // Login with email (for development/testing)
  async login(email: string): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const staff = await this.prisma.staff.findUnique({
      where: { email },
    });

    if (!staff || !staff.active) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    const accessToken = await this.createToken(staff);

    return {
      accessToken,
      user: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        country: staff.country || undefined,
        clerkUserId: staff.clerkUserId || undefined,
      },
    };
  }

  // Sync user from Clerk
  async syncClerkUser(clerkUserId: string, email: string, name: string): Promise<AuthenticatedUser> {
    let staff = await this.prisma.staff.findUnique({
      where: { clerkUserId },
    });

    if (!staff) {
      // Check if staff exists by email
      staff = await this.prisma.staff.findUnique({
        where: { email },
      });

      if (staff) {
        // Link existing staff to Clerk user
        staff = await this.prisma.staff.update({
          where: { id: staff.id },
          data: { clerkUserId },
        });
      }
    }

    if (!staff || !staff.active) {
      throw new UnauthorizedException('User not authorized. Please contact admin.');
    }

    return {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      country: staff.country || undefined,
      clerkUserId: staff.clerkUserId || undefined,
    };
  }

  // Get current user profile
  async getProfile(staffId: string): Promise<AuthenticatedUser> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      country: staff.country || undefined,
      clerkUserId: staff.clerkUserId || undefined,
    };
  }
}
