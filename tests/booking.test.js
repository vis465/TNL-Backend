const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Event = require('../models/Event');
const User = require('../models/User');
const Booking = require('../models/Booking');

describe('Booking API Tests', () => {
    let testUser;
    let testEvent;
    let authToken;

    beforeAll(async () => {
        // Create test user
        testUser = await User.create({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            role: 'member'
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

  

    describe('POST /api/bookings', () => {
        it('should create a new booking', async () => {
            const bookingData = {
                eventId: testEvent._id,
                slotNumber: 1,
                truckModel: 'Test Truck',
                truckColor: 'Red',
                truckPlate: 'TEST123'
            };

            const response = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${authToken}`)
                .send(bookingData)
                .expect(201);

            expect(response.body.eventId).toBe(testEvent._id.toString());
            expect(response.body.userId).toBe(testUser._id.toString());
            expect(response.body.slotNumber).toBe(bookingData.slotNumber);
        });

        it('should return 400 for invalid slot number', async () => {
            const bookingData = {
                eventId: testEvent._id,
                slotNumber: 11, // Exceeds maxSlots
                truckModel: 'Test Truck',
                truckColor: 'Red',
                truckPlate: 'TEST123'
            };

            await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${authToken}`)
                .send(bookingData)
                .expect(400);
        });

        it('should return 401 when not authenticated', async () => {
            const bookingData = {
                eventId: testEvent._id,
                slotNumber: 1,
                truckModel: 'Test Truck',
                truckColor: 'Red',
                truckPlate: 'TEST123'
            };

            await request(app)
                .post('/api/bookings')
                .send(bookingData)
                .expect(401);
        });
    });

    describe('GET /api/bookings', () => {
        it('should get all bookings for the user', async () => {
            const response = await request(app)
                .get('/api/bookings')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBeTruthy();
        });
    });

    describe('GET /api/bookings/:id', () => {
        let testBooking;

        beforeEach(async () => {
            // Create a test booking
            testBooking = await Booking.create({
                eventId: testEvent._id,
                userId: testUser._id,
                slotNumber: 1,
                truckModel: 'Test Truck',
                truckColor: 'Red',
                truckPlate: 'TEST123'
            });
        });

        it('should get a single booking by id', async () => {
            const response = await request(app)
                .get(`/api/bookings/${testBooking._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body._id).toBe(testBooking._id.toString());
        });

        it('should return 404 for non-existent booking', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await request(app)
                .get(`/api/bookings/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });

    describe('DELETE /api/bookings/:id', () => {
        let testBooking;

        beforeEach(async () => {
            // Create a test booking
            testBooking = await Booking.create({
                eventId: testEvent._id,
                userId: testUser._id,
                slotNumber: 1,
                truckModel: 'Test Truck',
                truckColor: 'Red',
                truckPlate: 'TEST123'
            });
        });

        it('should delete a booking', async () => {
            await request(app)
                .delete(`/api/bookings/${testBooking._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Verify booking is deleted
            const deletedBooking = await Booking.findById(testBooking._id);
            expect(deletedBooking).toBeNull();
        });

        it('should return 404 for non-existent booking', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await request(app)
                .delete(`/api/bookings/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });
}); 