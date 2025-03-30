const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const { auth, adminAuth } = require('../middleware/auth');
const Slot = require('../models/Slot');

// Get all bookings (admin only)
router.get('/', adminAuth, async (req, res) => {
    try {
        console.log('Fetching all bookings...');
        
        const slots = await Slot.find({
            'bookings.0': { $exists: true }
        })
        .populate({
            path: 'eventId',
            select: 'title server startDate' // Select the fields we need from Event
        })
        .sort({ createdAt: -1 });

        // Flatten and transform the response to match frontend needs
        const bookings = slots.flatMap(slot => {
            return slot.bookings.map(booking => ({
                _id: booking._id,
                eventTitle: slot.eventId?.title || 'Unknown Event',
                server: slot.eventId?.server,
                startDate: slot.eventId?.startDate,
                // Slot details
                slotNumber: slot.imageNumber,
                imageUrl: slot.imageUrl,
                // Requester details
                name: booking.name,
                // VTC details
                vtcName: booking.vtcName,
                vtcRole: booking.vtcRole,
                vtcLink: booking.vtcLink,
                // Status
                status: booking.status,
                createdAt: booking.createdAt
            }));
        });

        console.log('Processed bookings:', JSON.stringify(bookings, null, 2));
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ 
            message: 'Error fetching bookings', 
            error: error.message 
        });
    }
});

// Create new booking request
router.post('/', async (req, res) => {
    try {
        const slot = await Slot.findById(req.body.slotId);
        console.log(slot);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        const booking = {
            name: req.body.vtcName,
            status: 'pending'
        };

        slot.bookings.push(booking);
        slot.availableSlots -= 1;
        await slot.save();

        res.status(201).json(slot);
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ message: 'Error creating booking' });
    }
});

// Get all bookings for an event
router.get('/event/:eventId', async (req, res) => {
    try {
        console.log('Fetching bookings for event:', req.params.eventId);
        const event = await Event.findOne({ truckersmpId: req.params.eventId });
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const bookings = await Booking.find({ event: event._id })
            .populate('requestedBy', 'username vtcName')
            .populate('approvedBy', 'username')
            .sort({ createdAt: -1 });

        console.log(`Found ${bookings.length} bookings for event`);
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching event bookings:', error);
        res.status(500).json({ 
            message: 'Error fetching bookings', 
            error: error.message 
        });
    }
});

// Get user's bookings
router.get('/my-bookings', auth, async (req, res) => {
    try {
        console.log('Fetching bookings for user:', req.user._id);
        const slots = await Slot.find({
            'booking.contactPerson.email': req.user.email
        })
        .populate('eventId')
        .sort({ createdAt: -1 });

        console.log(`Found ${slots.length} bookings for user`);
        res.json(slots);
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ 
            message: 'Error fetching bookings', 
            error: error.message 
        });
    }
});

// Update booking status (admin only)
router.patch('/:id/status', adminAuth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        console.log('Updating booking status:', { id: req.params.id, status, notes });

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            console.log('Booking not found:', req.params.id);
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.status = status;
        booking.notes = notes || booking.notes;
        booking.approvedBy = req.user._id;
        await booking.save();

        console.log('Booking status updated successfully');
        res.json({
            message: 'Booking status updated successfully',
            booking
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ 
            message: 'Error updating booking status', 
            error: error.message 
        });
    }
});

// Cancel booking
router.patch('/:slotId/cancel', auth, async (req, res) => {
    try {
        console.log('Attempting to cancel booking:', req.params.slotId);
        const slot = await Slot.findById(req.params.slotId);

        if (!slot) {
            console.log('Slot not found:', req.params.slotId);
            return res.status(404).json({ message: 'Slot not found' });
        }

        // Only allow cancellation by the booking user or admin
        if (slot.booking.contactPerson.email !== req.user.email && req.user.role !== 'admin') {
            console.log('Unauthorized cancellation attempt');
            return res.status(403).json({ message: 'Not authorized to cancel this booking' });
        }

        slot.status = 'available';
        slot.booking = null;
        await slot.save();

        console.log('Booking cancelled successfully');
        res.json({
            message: 'Booking cancelled successfully',
            slot
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ 
            message: 'Error cancelling booking', 
            error: error.message 
        });
    }
});

// Get all bookings
router.get('/', async (req, res) => {
  try {
    console.log('Fetching all bookings...');
    // Find all slots that have bookings
    const slots = await Slot.find({
      'bookings.0': { $exists: true }
    }).lean();

    // Get all unique event IDs
    const eventIds = [...new Set(slots.map(slot => slot.eventId))];
    
    // Fetch all related events in one query
    const events = await Event.find({
      truckersmpId: { $in: eventIds }
    }).lean();

    // Create a map of events for quick lookup
    const eventMap = events.reduce((acc, event) => {
      acc[event.truckersmpId] = event;
      return acc;
    }, {});

    // Transform slots and bookings into the format needed for the dashboard
    const bookings = slots.flatMap(slot => {
      const event = eventMap[slot.eventId];
      return slot.bookings.map(booking => ({
        _id: booking._id,
        eventId: slot.eventId,
        event: {
          title: event?.title || 'Unknown Event',
          startDate: event?.startDate,
          server: event?.server
        },
        slotNumber: slot.imageNumber,
        imageUrl: slot.imageUrl,
        name: booking.name,
        vtcName: booking.vtcName,
        vtcRole: booking.vtcRole,
        vtcLink: booking.vtcLink,
        status: booking.status
      }));
    });

    console.log('Processed bookings:', bookings);
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

// Update booking status
router.patch('/:bookingId/status', adminAuth, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;
        
        console.log('Attempting to update booking:', { bookingId, status });

        // Find the slot containing the booking
        const slot = await Slot.findOne({
            'bookings._id': bookingId
        });

        if (!slot) {
            console.log('No slot found with booking ID:', bookingId);
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Find the specific booking in the bookings array
        const booking = slot.bookings.find(b => b._id.toString() === bookingId);
        
        if (!booking) {
            console.log('Booking not found in slot:', bookingId);
            return res.status(404).json({ message: 'Booking not found' });
        }

        console.log('Found booking:', booking);

        // Update the booking status
        booking.status = status;

        // If rejecting a pending booking, increment available slots
        if (status === 'rejected' && booking.status === 'pending') {
            slot.availableSlots += 1;
        }

        await slot.save();
        console.log('Successfully updated booking status');

        res.json({ 
            message: 'Booking status updated successfully',
            booking: {
                _id: booking._id,
                status: booking.status,
                name: booking.name,
                vtcName: booking.vtcName
            }
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ 
            message: 'Error updating booking status',
            error: error.message 
        });
    }
});

module.exports = router; 