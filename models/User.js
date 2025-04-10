const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Plain text (⚠️ Not Secure)
    role: { type: String, default: 'admin' },
    vtcName: String,
});

const User = mongoose.model('User', userSchema);
module.exports = User;
