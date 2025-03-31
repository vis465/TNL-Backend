const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

describe('Auth API Tests', () => {
    let testUser;

    beforeAll(async () => {
        // Create test user
        testUser = await User.create({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            role: 'member'
        });
    });

    // afterAll(async () => {
    //     // Clean up test data
    //     await User.deleteMany({});
    //     await mongoose.connection.close();
    // });

    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const newUser = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            expect(response.body.user.username).toBe(newUser.username);
            expect(response.body.user.email).toBe(newUser.email);
            expect(response.body.token).toBeDefined();
        });

        it('should return 400 for existing email', async () => {
            const existingUser = {
                username: 'existinguser',
                email: 'test@example.com', // Already exists
                password: 'password123'
            };

            await request(app)
                .post('/api/auth/register')
                .send(existingUser)
                .expect(400);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body.token).toBeDefined();
            expect(response.body.user.email).toBe(loginData.email);
        });

        it('should return 401 for invalid credentials', async () => {
            const invalidData = {
                email: 'test@example.com',
                password: 'wrongpassword'
            };

            await request(app)
                .post('/api/auth/login')
                .send(invalidData)
                .expect(401);
        });
    });

    describe('GET /api/auth/me', () => {
        let authToken;

        beforeEach(async () => {
            // Get auth token
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });
            authToken = loginResponse.body.token;
        });

        it('should get current user profile', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.email).toBe('test@example.com');
            expect(response.body.username).toBe('testuser');
        });

        it('should return 401 without token', async () => {
            await request(app)
                .get('/api/auth/me')
                .expect(401);
        });
    });
}); 