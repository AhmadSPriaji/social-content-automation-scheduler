import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Session } from './schemas/session.schema';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

class MockSessionModel {
  constructor(public data: any) {}
  save() {
    return Promise.resolve(this.data);
  }
  static find = jest.fn();
  static findByIdAndDelete = jest.fn();
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let mailerService: any;

  const mockUser = {
    _id: 'user123',
    email: 'test@example.com',
    passwordHash: 'hashedpassword',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findByResetToken: jest.fn(),
          },
        },
        {
          provide: getModelToken(Session.name),
          useValue: MockSessionModel,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'mockJwtToken'),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    mailerService = module.get(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('wrong@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens if login is successful', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@example.com', 'correctpassword');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBe('mockJwtToken');
    });
  });

  describe('register', () => {
    it('should hash password and create user', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.register(
        'newuser@example.com',
        'mypassword',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 10);
      expect(usersService.create).toHaveBeenCalledWith(
        'newuser@example.com',
        'hashed_pw',
      );
      expect(result).toEqual({ _id: mockUser._id, email: mockUser.email });
    });
  });

  describe('refresh', () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    const validPayload = { sub: validObjectId, email: 'test@example.com' };
    const validSession = {
      _id: 'session123',
      userId: validObjectId,
      refreshTokenHash: 'hashed_rt',
      expiresAt: new Date(Date.now() + 10000), // future
    };

    it('should throw UnauthorizedException if token is invalid or expired', async () => {
      const jwtService = require('@nestjs/jwt').JwtService.prototype;
      // mock the implementation directly since it's injected
      const mockJwtService = {
        verify: jest.fn().mockImplementation(() => {
          throw new Error('invalid');
        }),
      };
      const serviceWithMockJwt = new AuthService(
        usersService,
        mockJwtService as any,
        mailerService,
        MockSessionModel as any,
      );

      await expect(serviceWithMockJwt.refresh('bad_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if no matching session found', async () => {
      const jwtService = require('@nestjs/jwt').JwtService.prototype;
      const mockJwtService = {
        verify: jest.fn().mockReturnValue(validPayload),
      };
      MockSessionModel.find.mockResolvedValue([]); // no sessions

      const serviceWithMockJwt = new AuthService(
        usersService,
        mockJwtService as any,
        mailerService,
        MockSessionModel as any,
      );
      await expect(serviceWithMockJwt.refresh('valid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new tokens if session is valid and hash matches', async () => {
      const mockJwtService = {
        verify: jest.fn().mockReturnValue(validPayload),
        sign: jest.fn(() => 'newMockToken'),
      };
      // Provide valid hash match
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_rt');
      
      const mockSessionArray = [{ ...validSession, remove: jest.fn() }];
      MockSessionModel.find.mockResolvedValue(mockSessionArray);

      const serviceWithMockJwt = new AuthService(
        usersService,
        mockJwtService as any,
        mailerService,
        MockSessionModel as any,
      );
      const result = await serviceWithMockJwt.refresh('valid_token');

      expect(result).toHaveProperty('accessToken', 'newMockToken');
      expect(result).toHaveProperty('refreshToken', 'newMockToken');
      expect(MockSessionModel.findByIdAndDelete).toHaveBeenCalledWith(
        validSession._id,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should return success message even if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await service.forgotPassword('unknown@example.com');
      expect(result).toEqual({ message: 'If an account exists, a password reset link has been sent.' });
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should update user with reset token and send email', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      const result = await service.forgotPassword('test@example.com');
      
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser._id.toString(),
        expect.objectContaining({
          resetPasswordToken: expect.any(String),
          resetPasswordExpires: expect.any(Date),
        }),
      );
      expect(mailerService.sendMail).toHaveBeenCalled();
      expect(result).toEqual({ message: 'If an account exists, a password reset link has been sent.' });
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException if token is invalid', async () => {
      usersService.findByResetToken.mockResolvedValue(null);
      await expect(service.resetPassword('invalid_token', 'newPass123')).rejects.toThrow('Invalid or expired password reset token');
    });

    it('should update password and clear reset fields if token is valid', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      usersService.findByResetToken.mockResolvedValue({ ...mockUser, resetPasswordExpires: futureDate });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_pw');

      const result = await service.resetPassword('valid_token', 'newPass123');
      
      expect(bcrypt.hash).toHaveBeenCalledWith('newPass123', 10);
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser._id.toString(),
        expect.objectContaining({
          passwordHash: 'new_hashed_pw',
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined,
        }),
      );
      expect(result).toEqual({ message: 'Password has been reset successfully' });
    });
  });

  describe('changePassword', () => {
    it('should throw BadRequestException if old password does not match', async () => {
      // Provide findById mock
      usersService.findById = jest.fn().mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // wrong password

      await expect(service.changePassword('user123', 'wrong_old', 'new_pass')).rejects.toThrow('Incorrect old password');
    });

    it('should update password if old password matches', async () => {
      usersService.findById = jest.fn().mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true); // correct old password
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_pw');

      const result = await service.changePassword('user123', 'correct_old', 'new_pass');
      
      expect(bcrypt.hash).toHaveBeenCalledWith('new_pass', 10);
      expect(usersService.update).toHaveBeenCalledWith('user123', { passwordHash: 'new_hashed_pw' });
      expect(result).toEqual({ message: 'Password changed successfully' });
    });
  });
});
