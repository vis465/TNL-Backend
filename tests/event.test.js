const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Event = require('../models/Event');
const User = require('../models/User');

describe('Event API Tests', () => {
    let testUser;
    let testEvent;
    let authToken;

    beforeAll(async () => {
        // Create test user
        testUser = await User.create({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            role: 'admin'
        });

        // Create test event
        testEvent = await Event.create({
            title: 'Test Event',
            description: 'Test Description',
            startDate: new Date(),
            endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            location: 'Test Location',
            maxSlots: 10,
            createdBy: testUser._id,
            arrivalPoint: 'Test Arrival Point',
            departurePoint: 'Test Departure Point',
            meetingPoint: 'Test Meeting Point',
            server: 'Test Server',
            route: 'Test Route',
            truckersmpId: '12345'
        });

        // Get auth token
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });
        authToken = loginResponse.body.token;
    });

    // afterAll(async () => {
    //     // Clean up test data
    //     await Event.deleteMany({});
    //     await User.deleteMany({});
    //     await mongoose.connection.close();
    // });

    describe('GET /api/events', () => {
        it('should get all events', async () => {
            const response = await request(app)
                .get('/api/events')
                .expect(200);

            expect(Array.isArray(response.body)).toBeTruthy();
            expect(response.body.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/events/:id', () => {
        it('should get a single event by id', async () => {
            const response = await request(app)
                .get(`/api/events/${testEvent._id}`)
                .expect(200);

            expect(response.body._id).toBe(testEvent._id.toString());
        });

        it('should return 404 for non-existent event', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await request(app)
                .get(`/api/events/${fakeId}`)
                .expect(404);
        });
    });

    describe('POST /api/events', () => {
        it('should create a new event', async () => {
            const newEvent = {
                title: 'New Test Event',
                description: 'New Test Description',
                startDate: new Date(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                location: 'New Test Location',
                maxSlots: 5,
                arrivalPoint: 'New Test Arrival Point',
                departurePoint: 'New Test Departure Point',
                meetingPoint: 'New Test Meeting Point',
                server: 'New Test Server',
                route: 'New Test Route',
                truckersmpId: '54321'
            };

            const response = await request(app)
                .post('/api/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newEvent)
                .expect(201);

            expect(response.body.title).toBe(newEvent.title);
            expect(response.body.createdBy).toBe(testUser._id.toString());
        });

        it('should return 401 when not authenticated', async () => {
            const newEvent = {
                title: 'New Test Event',
                description: 'New Test Description',
                startDate: new Date(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                location: 'New Test Location',
                maxSlots: 5,
                arrivalPoint: 'New Test Arrival Point',
                departurePoint: 'New Test Departure Point',
                meetingPoint: 'New Test Meeting Point',
                server: 'New Test Server',
                route: 'New Test Route',
                truckersmpId: '54321'
            };

            await request(app)
                .post('/api/events')
                .send(newEvent)
                .expect(401);
        });
    });

    describe('PUT /api/events/:id', () => {
        it('should update an event', async () => {
            const updateData = {
                title: 'Updated Test Event',
                description: 'Updated Test Description'
            };

            const response = await request(app)
                .put(`/api/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.title).toBe(updateData.title);
            expect(response.body.description).toBe(updateData.description);
        });

        it('should return 404 for non-existent event', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const updateData = {
                title: 'Updated Test Event',
                description: 'Updated Test Description'
            };

            await request(app)
                .put(`/api/events/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(404);
        });
    });

    describe('DELETE /api/events/:id', () => {
        it('should delete an event', async () => {
            await request(app)
                .delete(`/api/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Verify event is deleted
            const deletedEvent = await Event.findById(testEvent._id);
            expect(deletedEvent).toBeNull();
        });

        it('should return 404 for non-existent event', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await request(app)
                .delete(`/api/events/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });
}); 