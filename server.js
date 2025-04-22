// Load environment variables first
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const bookingsRouter = require('./routes/bookings');
const slotsRouter = require('./routes/slots');
const serversRouter = require('./routes/servers');
const analyticsRouter = require('./routes/analytics');

// Import Discord bot

const app = express();

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'DISCORD_WEBHOOK_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

// Check for Discord bot token
if (!process.env.DISCORD_BOT_TOKEN) {
    console.warn('WARNING: DISCORD_BOT_TOKEN is not set. Direct messages will not work.');
    console.warn('To enable direct messages, add your Discord bot token to the .env file.');
}

app.use(cors({
    origin: '*',
    credentials: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Initialize Discord bot


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingsRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/servers', serversRouter);
app.use('/api/analytics', analyticsRouter); 

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});
app.get('/', (req, res) => {
    res.send('Hello World');
});
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app; 