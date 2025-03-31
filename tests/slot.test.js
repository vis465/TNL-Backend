const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Event = require('../models/Event');
const User = require('../models/User');
const Slot = require('../models/Slot');

describe('Slot API Tests', () => {
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
            endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
    //     await Slot.deleteMany({});
    //     await Event.deleteMany({});
    //     await User.deleteMany({});
    //     await mongoose.connection.close();
    // });

    describe('GET /api/slots/event/:eventId', () => {
        it('should get all slots for an event', async () => {
            const response = await request(app)
                .get(`/api/slots/event/${testEvent._id}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBeTruthy();
            expect(response.body.length).toBe(testEvent.maxSlots);
        });

        it('should return 404 for non-existent event', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await request(app)
                .get(`/api/slots/event/${fakeId}`)
                .expect(404);
        });
    });

    describe('PUT /api/slots/:id/status', () => {
        let testSlot;

        beforeEach(async () => {
            // Create a test slot
            testSlot = await Slot.create({
                eventId: testEvent._id,
                slotNumber: 1,
                status: 'available'
            });
        });

        it('should update slot status', async () => {
            const response = await request(app)
                .put(`/api/slots/${testSlot._id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'booked' })
                .expect(200);

            expect(response.body.status).toBe('booked');
        });

        it('should return 400 for invalid status', async () => {
            await request(app)
                .put(`/api/slots/${testSlot._id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'invalid' })
                .expect(400);
        });

        it('should return 404 for non-existent slot', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await request(app)
                .put(`/api/slots/${fakeId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'booked' })
                .expect(404);
        });
    });

    describe('PUT /api/slots/:id/assign', () => {
        let testSlot;
        let testUser2;

        beforeEach(async () => {
            // Create a test slot
            testSlot = await Slot.create({
                eventId: testEvent._id,
                slotNumber: 1,
                status: 'available'
            });

            // Create another test user
            testUser2 = await User.create({
                username: 'testuser2',
                email: 'test2@example.com',
                password: 'password123',
                role: 'member'
            });
        });

        it('should assign a slot to a user', async () => {
            const response = await request(app)
                .put(`/api/slots/${testSlot._id}/assign`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId: testUser2._id })
                .expect(200);

            expect(response.body.assignedTo).toBe(testUser2._id.toString());
            expect(response.body.status).toBe('booked');
        });

        it('should return 400 for already booked slot', async () => {
            // First assign the slot
            await Slot.findByIdAndUpdate(testSlot._id, {
                status: 'booked',
                assignedTo: testUser2._id
            });

            // Try to assign it again
            await request(app)
                .put(`/api/slots/${testSlot._id}/assign`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId: testUser2._id })
                .expect(400);
        });

        it('should return 404 for non-existent slot', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await request(app)
                .put(`/api/slots/${fakeId}/assign`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId: testUser2._id })
                .expect(404);
        });
    });
}); 