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

    it('POST /auth/refresh - User 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', user1Cookies)
        .expect(200);
      
      expect(res.body.message).toBe('Token refreshed successfully');
      // Update cookies with new ones
      user1Cookies = res.headers['set-cookie'];
      expect(user1Cookies).toBeDefined();
    });
  });

  describe('Workspaces APIs', () => {
    it('POST /workspaces - Create Workspace by User 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/workspaces')
        .set('Cookie', user1Cookies)
        .send({ name: 'User 1 Workspace' })
        .expect(201);
      
      workspaceId = res.body._id;
      expect(workspaceId).toBeDefined();
    });

    it('POST /workspaces/:id/members - Add User 2 as VIEWER', async () => {
      await request(app.getHttpServer())
        .post(`/workspaces/${workspaceId}/members`)
        .set('Cookie', user1Cookies)
        .send({ email: 'user2@example.com', role: 'viewer' })
        .expect(201);
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

    it('GET /posts/:id/audit-logs - User 1 fetches audit logs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts/${postId}/audit-logs`)
        .set('Cookie', user1Cookies)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0); // Should have create and schedule logs
    });
  });

  describe('Mock APIs (OAuth, Analytics, Webhook)', () => {
    it('POST /workspaces/:workspaceId/integrations/mock-oauth - Connect OAuth', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workspaces/${workspaceId}/integrations/mock-oauth`)
        .set('Cookie', user1Cookies)
        .expect(201);
      
      expect(res.body.message).toBe('Successfully connected to Mock Social Provider');
      expect(res.body.token).toBeDefined();
    });

    it('GET /posts/:id/analytics - Get Mock Analytics', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts/${postId}/analytics`)
        .set('Cookie', user1Cookies)
        .expect(200);
      
      expect(res.body.views).toBeDefined();
      expect(res.body.likes).toBeDefined();
    });

    it('POST /posts/:id/webhook - Simulate Webhook', async () => {
      const res = await request(app.getHttpServer())
        .post(`/posts/${postId}/webhook`)
        .set('x-hub-signature-256', 'mock-valid-signature')
        .send({
          event: 'success',
          details: 'Post successfully published on external platform',
        })
        .expect(201); // Controller without decorator might default to 201 for POST
      
      expect(res.body.message).toBe('Webhook processed successfully');
    });
  });

  describe('Workspaces Read APIs', () => {
    it('GET /workspaces - User 1 fetches workspaces', async () => {
      const res = await request(app.getHttpServer())
        .get('/workspaces')
        .set('Cookie', user1Cookies)
        .expect(200);
      
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].name).toBe('User 1 Workspace');
    });
  });

  describe('Authentication Logout API', () => {
    it('POST /auth/logout - User 1 logs out', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', user1Cookies)
        .expect(200);
      
      expect(res.body.message).toBe('Logged out successfully');
    });
  });
});
