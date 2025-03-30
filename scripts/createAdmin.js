require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Ensure the correct path

// MongoDB connection string with fallback
const MONGODB_URI = process.env.MONGODB_URI;

// Admin user details
const adminUser = {
    username: 'admin',
    password: 'Admin@123', // Will be hashed before saving
    name: 'Admin User',
    role: 'admin',
    email: 'admin@tnl.com',
    vtcName: 'TNL Admin'
};

async function createAdminUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Check if admin user already exists
        const existingAdmin = await User.findOne({ username: adminUser.username });
        if (existingAdmin) {
            console.log('⚠️ Admin user already exists. Deleting...');
            await User.deleteOne({ username: adminUser.username });
        }

        // Hash the password
       
        // Create new admin user
        const newAdmin = new User({
            ...adminUser
        });

        // Save the admin user
        await newAdmin.save();
        console.log('🎉 Admin user created successfully!');
        console.log('🔹 Email:', adminUser.email);
        console.log('🔹 Role:', adminUser.role);

        // Close the connection
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    }
}

// Run the function
createAdminUser();
