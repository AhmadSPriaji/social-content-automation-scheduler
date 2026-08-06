import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { Session } from './schemas/session.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(Session.name) private sessionModel: Model<Session>,
  ) {}

  async register(email: string, pass: string) {
    const passwordHash = await bcrypt.hash(pass, 10);
    const user = await this.usersService.create(email, passwordHash);
    return {
      _id: user._id,
      email: user.email,
    };
  }

  async login(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: user.email, sub: user._id };
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (7 days)
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save session
    await new this.sessionModel({
      userId: user._id,
      refreshTokenHash,
      expiresAt,
    }).save();

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        ignoreExpiration: false,
      });

      // We should ideally check the session from the DB and compare hashes
      // For simplicity and standard approach, we find if any session matches the user and isn't expired
      const { Types } = require('mongoose');
      const sessions = await this.sessionModel.find({
        userId: new Types.ObjectId(payload.sub as string),
      });
      let validSession = null;
      for (const session of sessions) {
        if (session.expiresAt > new Date()) {
          const isMatch = await bcrypt.compare(
            refreshToken,
            session.refreshTokenHash,
          );
          if (isMatch) {
            validSession = session;
            break;
          }
        }
      }

      if (!validSession) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Rotate token: delete old session
      await this.sessionModel.findByIdAndDelete(validSession._id);

      const newPayload = { email: payload.email, sub: payload.sub };
      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });
      const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await new this.sessionModel({
        userId: payload.sub,
        refreshTokenHash: newRefreshTokenHash,
        expiresAt,
      }).save();

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        ignoreExpiration: true,
      });
      const { Types } = require('mongoose');
      const sessions = await this.sessionModel.find({
        userId: new Types.ObjectId(payload.sub as string),
      });

      for (const session of sessions) {
        const isMatch = await bcrypt.compare(
          refreshToken,
          session.refreshTokenHash,
        );
        if (isMatch) {
          await this.sessionModel.findByIdAndDelete(session._id);
          break;
        }
      }

      return { message: 'Logged out successfully' };
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
