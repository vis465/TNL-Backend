const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    event: {
        type: String,
        ref: 'Event',
        required: true
    },
    slotNumber: {
        type: String,
        required: true
    },
    vtcName: {
        type: String,
        required: true
    },
    contactPerson: {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        discord: {
            type: String,
            required: true
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
bookingSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Compound index to ensure unique slot bookings per event
bookingSchema.index({ event: 1, slotNumber: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema); 