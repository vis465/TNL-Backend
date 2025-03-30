require('dotenv').config();

// Set test environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/vtc-booking-test';

// Increase timeout for all tests
jest.setTimeout(10000);

// Suppress console logs during tests
console.log = jest.fn();
console.error = jest.fn();

// Clean up after all tests
afterAll(async () => {
    // Close MongoDB connection
    await mongoose.connection.close();
});
