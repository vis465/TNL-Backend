const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const dotenv = require('dotenv');
dotenv.config();

// Ensure JWT secret is set
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in .env file');
    process.exit(1);
}

// Register a new admin user (admin-only)
router.post('/register', adminAuth, async (req, res) => {
    try {
        const { username, password, email, vtcName } = req.body;

        // Validate required fields
        if (!username || !password || !email) {
            return res.status(400).json({ 
                message: 'Username, password, and email are required',
                details: {
                    username: !username ? 'Username is required' : null,
                    password: !password ? 'Password is required' : null,
                    email: !email ? 'Email is required' : null
                }
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: 'Invalid email format'
            });
        }

        // Check if the user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { email: email.toLowerCase() }, 
                { username: username.toLowerCase() }
            ] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                message: 'User with this email or username already exists'
            });
        }

        // Create new admin user
        const user = new User({
            username: username.toLowerCase(),
            password, // This will be hashed automatically in the User model
            email: email.toLowerCase(),
            vtcName: vtcName || null, // Admins can have null vtcName
            role: 'eventteam'
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Admin user registered successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                vtcName: user.vtcName
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: 'Error registering user',
            error: error.message 
        });
    }
});

// User login (for both public & admin)
router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt:', { username: req.body.username });

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Check if user exists
        const user = await User.findOne({ username });
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Compare passwords using bcrypt
        const isMatch =password==user.password
        console.log('Password match result:', isMatch);

        if (!isMatch) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('Login successful:', {
            username: user.username,
            role: user.role,
            vtcName: user.vtcName
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                vtcName: user.vtcName
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: 'Error logging in', 
            error: error.message 
        });
    }
});


// Get the current user profile (auth required)
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
});

module.exports = router;
