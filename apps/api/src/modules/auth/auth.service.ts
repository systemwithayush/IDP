import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../prisma.js';
import { env } from '../../config/env.js';
import { auditService } from '../audit/audit.service.js';
import { Role } from '@prisma/client';

export interface TokenPayload {
  id: string;
  email: string;
  role: Role;
  teamId: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  teamId: string;
  role?: Role;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export class AuthService {
  private readonly BCRYPT_ROUNDS = 10;

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateTokens(user: TokenPayload) {
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  }

  verifyRefreshToken(token: string): { id: string } {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
  }

  async register(data: RegisterDTO) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      const err = new Error('User with this email already exists');
      (err as any).status = 409;
      (err as any).code = 'EMAIL_ALREADY_EXISTS';
      throw err;
    }

    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
    });

    if (!team) {
      const err = new Error('Specified team does not exist');
      (err as any).status = 404;
      (err as any).code = 'TEAM_NOT_FOUND';
      throw err;
    }

    const passwordHash = await this.hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        teamId: data.teamId,
        role: data.role || Role.developer,
      },
    });

    // Record audit log
    await auditService.logAction({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role, teamId: user.teamId },
    });

    const tokens = this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async login(data: LoginDTO) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      const err = new Error('Invalid email or password');
      (err as any).status = 401;
      (err as any).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const validPassword = await this.comparePassword(data.password, user.passwordHash);
    if (!validPassword) {
      const err = new Error('Invalid email or password');
      (err as any).status = 401;
      (err as any).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Record audit log
    await auditService.logAction({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    const tokens = this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.verifyRefreshToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (!user) {
        const err = new Error('User not found');
        (err as any).status = 401;
        (err as any).code = 'USER_NOT_FOUND';
        throw err;
      }

      return this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
      });
    } catch (e: any) {
      const err = new Error('Invalid or expired refresh token');
      (err as any).status = 401;
      (err as any).code = 'INVALID_REFRESH_TOKEN';
      throw err;
    }
  }
}

export const authService = new AuthService();
