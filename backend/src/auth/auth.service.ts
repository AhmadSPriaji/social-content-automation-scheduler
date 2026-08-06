import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';
import { UsersService } from '../users/users.service';
import { Session } from './schemas/session.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailerService: MailerService,
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

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return {
        message: 'If an account exists, a password reset link has been sent.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date();
    resetPasswordExpires.setHours(resetPasswordExpires.getHours() + 1); // 1 hour expiration

    await this.usersService.update(user._id.toString(), {
      resetPasswordToken: resetToken,
      resetPasswordExpires,
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please click the link to reset your password: ${resetLink}`,
      html: `<p>You requested a password reset. Please click the link below to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    });

    console.log('\n=============================================');
    console.log(`[MOCK EMAIL SENT] Password reset link for ${user.email}:`);
    console.log(resetLink);
    console.log('=============================================\n');

    return {
      message: 'If an account exists, a password reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);

    if (
      !user ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(user._id.toString(), {
      passwordHash,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });

    return { message: 'Password has been reset successfully' };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Incorrect old password');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(userId, { passwordHash });

    return { message: 'Password changed successfully' };
  }
}
