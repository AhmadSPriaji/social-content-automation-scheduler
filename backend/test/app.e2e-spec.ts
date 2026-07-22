import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import cookieParser from 'cookie-parser';

describe('End-to-End Test (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  
  let user1Cookies: string[];
  let user2Cookies: string[];
  
  let workspaceId: string;
  let postId: string;
  
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Override MONGO_URI to use a test database
    process.env.MONGO_URI = 'mongodb://localhost:27017/social_db_test';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    
    await app.init();
    
    connection = await moduleFixture.get(getConnectionToken());
    
    // Drop the database to start clean
    await connection.db?.dropDatabase();
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (app) await app.close();
  });

  describe('Authentication APIs', () => {
    it('POST /auth/register - User 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user1@example.com', password: 'Password123' })
        .expect(201);
      
      expect(res.body).toHaveProperty('_id');
      expect(res.body.email).toBe('user1@example.com');
      user1Id = res.body._id;
    });

    it('POST /auth/register - User 2', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user2@example.com', password: 'Password123' })
        .expect(201);
      
      user2Id = res.body._id;
    });

    it('POST /auth/login - User 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user1@example.com', password: 'Password123' });
      
      console.log('Login Response:', res.status, res.body);
      
      expect(res.status).toBe(200);
      user1Cookies = res.headers['set-cookie'];
      expect(user1Cookies).toBeDefined();
    });

    it('POST /auth/login - User 2', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user2@example.com', password: 'Password123' })
        .expect(200);
      
      user2Cookies = res.headers['set-cookie'];
      expect(user2Cookies).toBeDefined();
    });
  });

  describe('Workspaces Seeding (Direct DB)', () => {
    it('Seed Workspace for User 1', async () => {
      const db = connection.db;
      if (!db) throw new Error('DB not initialized');
      
      const Types = require('mongoose').Types;
      const workspace = {
        name: 'User 1 Workspace',
        members: [{ userId: new Types.ObjectId(user1Id), role: 'owner' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const result = await db.collection('workspaces').insertOne(workspace);
      workspaceId = result.insertedId.toString();
      expect(workspaceId).toBeDefined();
    });

    it('Seed Workspace Member (User 2 as VIEWER)', async () => {
      const db = connection.db;
      if (!db) throw new Error('DB not initialized');
      const Types = require('mongoose').Types;
      
      await db.collection('workspaces').updateOne(
        { _id: new Types.ObjectId(workspaceId) },
        { $push: { members: { userId: new Types.ObjectId(user2Id), role: 'viewer' } } as any }
      );
    });
  });

  describe('Posts APIs (Creation & Fetching)', () => {
    it('POST /posts - User 1 creates a post', async () => {
      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Cookie', user1Cookies)
        .send({
          workspaceId: workspaceId,
          content: 'Hello this is my first scheduled post!',
          mediaUrls: [],
        })
        .expect(201);
      
      postId = res.body._id;
      expect(postId).toBeDefined();
      expect(res.body.status).toBe('draft');
    });

    it('GET /posts?workspaceId=... - User 1 fetches posts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts?workspaceId=${workspaceId}`)
        .set('Cookie', user1Cookies)
        .expect(200);
      
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });
  });

  describe('RBAC/ABAC Security Tests', () => {
    it('PUT /posts/:id - User 2 (VIEWER) tries to edit User 1 post (Should Fail)', async () => {
      await request(app.getHttpServer())
        .put(`/posts/${postId}`)
        .set('Cookie', user2Cookies)
        .send({ content: 'Hacked content' })
        .expect(403);
    });
  });

  describe('Posts APIs (Scheduling)', () => {
    it('POST /posts/:id/schedule - User 1 schedules the post', async () => {
      // First update the post with a scheduledAt date
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 5);

      await request(app.getHttpServer())
        .put(`/posts/${postId}`)
        .set('Cookie', user1Cookies)
        .send({ scheduledAt: futureDate.toISOString() })
        .expect(200);

      // Then schedule it
      const res = await request(app.getHttpServer())
        .post(`/posts/${postId}/schedule`)
        .set('Cookie', user1Cookies)
        .expect(201);
      
      expect(res.body.message).toBe('Post successfully scheduled');
    });
  });
});
