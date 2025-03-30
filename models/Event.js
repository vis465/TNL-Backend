const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    truckersmpId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    
    route: {
        type: String,
        required: true
    },
    server: {
        type: String,
        required: true
    },
    meetingPoint: {
        type: String,
        required: true
    },
    departurePoint: {
        type: String,
        required: true
    },
    arrivalPoint: {
        type: String,
        required: true
    },
    banner: {
        type: String
    },
    map: {
        type: String
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    attendances: {
        type: Object
    },
    voiceLink: {
        type: String
    },
    externalLink: {
        type: String
    },
    rule: {
        type: String
    },
    dlcs: {
        type: [String]
    },
    url: {
        type: String
    },
    slots: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Slot'
    }]
}, {
    timestamps: true
});

// Drop any existing indexes before creating new ones

// Update the updatedAt timestamp before saving
eventSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Event', eventSchema); 