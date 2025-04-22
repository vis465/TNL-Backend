const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    name: { type: String, required: true },
    vtcName: { type: String, required: true },
    vtcRole: String,
    vtcLink: String,
    playercount:String,
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    discordUsername: {
        type: String,
    },
    vtc: String,
    truck: String,
    trailer: String,
    notes: String,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const slotSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return v.includes('imgur.com');
            },
            message: 'Image URL must be from imgur.com'
        }
    },
    imageNumber: {
        type: Number,
        required: true
    },
    slots: [{
        number: {
            type: Number,
            required: true
        },
        isAvailable: {
            type: Boolean,
            default: true
        },
        booking: bookingSchema
    }]
}, {
    timestamps: true
});

// Remove any existing indexes
slotSchema.indexes().forEach(index => {
    slotSchema.index(index[0], { background: true, unique: false });
});

// Add a compound index for eventId and slot number
slotSchema.index({ 
    eventId: 1,
    'slots.number': 1 
}, { 
    unique: false,
    background: true
});

module.exports = mongoose.model('Slot', slotSchema);
