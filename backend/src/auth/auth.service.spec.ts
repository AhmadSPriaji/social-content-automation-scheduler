import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Session } from './schemas/session.schema';
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
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
      MockSessionModel.find.mockResolvedValue([validSession]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_rt');

      const serviceWithMockJwt = new AuthService(
        usersService,
        mockJwtService as any,
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
});
