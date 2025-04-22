const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { auth, adminAuth } = require('../middleware/auth');
const Slot = require('../models/Slot');
const mongoose = require('mongoose');
const discordService = require('../services/discordService');
const discordBot = require('../services/discordBot');

// Get slots for an event
router.get('/event/:eventId', async (req, res) => {
    try {
        const slots = await Slot.find({ eventId: req.params.eventId });
        console.log(`Found ${slots.length} slots for event ${req.params.eventId}`);
        res.json({ slots });
    } catch (error) {
        console.error('Error fetching slots:', error);
        res.status(500).json({ message: 'Error fetching slots' });
    }
});

// Get slot details
router.get('/:eventId/:slotNumber', async (req, res) => {
    try {
        const { eventId, slotNumber } = req.params;

        const booking = await Booking.findOne({
            event: eventId,
            slotNumber,
            status: { $in: ['pending', 'approved'] }
        }).populate('requestedBy', 'username vtcName');

        if (!booking) {
            return res.json({
                status: 'available',
                slotNumber
            });
        }

        res.json({
            status: 'booked',
            slotNumber,
            booking: {
                vtcName: booking.vtcName,
                status: booking.status,
                contactPerson: booking.contactPerson,
                requestedBy: booking.requestedBy
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching slot details', error: error.message });
    }
});

// Update slot image (admin only)
router.post('/:eventId/image', adminAuth, async (req, res) => {
    try {
        const { imageUrl } = req.body;
        const event = await Event.findById(req.params.eventId);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        event.slotImage = imageUrl;
        await event.save();

        res.json({
            message: 'Slot image updated successfully',
            event
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating slot image', error: error.message });
    }
});

// Create new slots for an event
router.post('/event/:eventId', async (req, res) => {
    try {
        console.log('Creating slots for event:', req.params.eventId);
        console.log('Request body:', req.body);

        const event = await Event.findOne({ truckersmpId: req.params.eventId });
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Validate request body
        if (!req.body.slots || !Array.isArray(req.body.slots)) {
            return res.status(400).json({ message: 'Invalid request format. Expected slots array.' });
        }

        // Get all existing slot numbers for this event
        const existingSlots = await Slot.find({ eventId: event.truckersmpId });
        const existingSlotNumbers = existingSlots.reduce((acc, slot) => {
            return [...acc, ...slot.slots.map(s => s.number)];
        }, []);

        // Validate and collect all new slot numbers
        let allNewSlotNumbers = [];
        for (const slotData of req.body.slots) {
            if (!slotData.imageUrl?.includes('imgur.com')) {
                return res.status(400).json({ message: 'Invalid image URL. Must be from imgur.com' });
            }
            if (!slotData.slots || !Array.isArray(slotData.slots)) {
                return res.status(400).json({ message: 'Invalid slot format. Each slot must have a slots array.' });
            }
            // Extract slot numbers from the slots array
            const slotNumbers = slotData.slots.map(s => s.number);
            allNewSlotNumbers = [...allNewSlotNumbers, ...slotNumbers];
        }

        // Check for duplicates within each individual slot image only
        for (const slotData of req.body.slots) {
            const slotNumbers = slotData.slots.map(s => s.number);
            const duplicatesInSlot = slotNumbers.filter((num, index) => 
                slotNumbers.indexOf(num) !== index
            );

            if (duplicatesInSlot.length > 0) {
                const duplicates = [...new Set(duplicatesInSlot)];
                return res.status(400).json({ 
                    message: `Duplicate slot numbers found within a single slot image: ${duplicates.join(', ')}` 
                });
            }
        }

        // Create new slots
        const createdSlots = [];
        
        // Check if we're adding new slots or updating existing ones
        if (req.body.isUpdate && req.body.slotId) {
            // Update existing slot
            const existingSlot = await Slot.findById(req.body.slotId);
            if (!existingSlot) {
                return res.status(404).json({ message: 'Slot not found' });
            }
            
            // Update the slot with new data
            existingSlot.imageUrl = req.body.slots[0].imageUrl;
            existingSlot.slots = req.body.slots[0].slots.map(s => ({
                number: parseInt(s.number),
                isAvailable: true
            }));
            
            const savedSlot = await existingSlot.save();
            createdSlots.push(savedSlot);
        } else {
            // Add new slots
            for (const [index, slotData] of req.body.slots.entries()) {
                // Check if this slot image already exists
                const existingSlot = existingSlots.find(slot => 
                    slot.imageUrl === slotData.imageUrl
                );
                
                if (existingSlot) {
                    // Skip this slot as it already exists
                    console.log(`Skipping duplicate slot image: ${slotData.imageUrl}`);
                    continue;
                }
                
                const slot = new Slot({
                    eventId: event.truckersmpId,
                    imageUrl: slotData.imageUrl,
                    imageNumber: existingSlots.length + createdSlots.length + 1,
                    slots: slotData.slots.map(s => ({
                        number: parseInt(s.number),
                        isAvailable: true
                    }))
                });

                const savedSlot = await slot.save();
                createdSlots.push(savedSlot);
            }
        }

        console.log('Created slots:', createdSlots);
        res.status(201).json({ 
            message: 'Slots created successfully',
            slots: createdSlots 
        });
    } catch (error) {
        console.error('Error creating slots:', error);
        res.status(500).json({ 
            message: 'Error creating slots',
            error: error.message 
        });
    }
});

// Request a slot
router.post('/:slotId/request', async (req, res) => {
    console.log('Requesting slot:', req.body);
    try {
        const { name, vtcName, vtcRole, vtcLink, slotNumber, playercount, discordUsername } = req.body;
        console.log('Requesting slot:', { slotId: req.params.slotId, slotNumber, name, vtcName, playercount, discordUsername });

        // Validate required fields
        if (!name || !vtcName || !slotNumber || !playercount || !discordUsername) {
            return res.status(400).json({ 
                message: 'Missing required fields',
                details: {
                    name: !name,
                    vtcName: !vtcName,
                    slotNumber: !slotNumber,
                    playercount: !playercount,
                    discordUsername: !discordUsername
                }
            });
        }

        const slot = await Slot.findById(req.params.slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        // Find the specific slot number
        const slotIndex = slot.slots.findIndex(s => s.number === parseInt(slotNumber));
        if (slotIndex === -1) {
            return res.status(404).json({ message: 'Slot number not found' });
        }

        // Check if slot is available
        if (!slot.slots[slotIndex].isAvailable) {
            return res.status(400).json({ message: 'This slot is already booked' });
        }

        // Get event details for notification
        const event = await Event.findOne({ truckersmpId: slot.eventId });
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Create booking with all required fields
        const booking = {
            name,
            vtcName,
            vtcRole,
            vtcLink,
            playercount,
            discordUsername,
            status: 'pending',
            createdAt: new Date()
        };

        // Update slot with booking
        slot.slots[slotIndex].isAvailable = false;
        slot.slots[slotIndex].booking = booking;

        await slot.save();
        console.log('Slot request created:', slot.slots[slotIndex]);

        // Send Discord notification
        console.log('Sending Discord notification for new booking...');
        try {
            await discordService.sendBookingNotification({
                eventTitle: event.title,
                slotNumber: slot.slots[slotIndex].number,
                vtcName: booking.vtcName,
                vtcLink: booking.vtcLink,
                name: booking.name,
                vtcRole: booking.vtcRole,
                status: booking.status,
                discordUsername: booking.discordUsername
            });
            console.log('Discord notification sent successfully');
        } catch (error) {
            console.error('Error sending Discord notification:', error.message);
            // Continue with the response even if Discord notification fails
        }

        res.json({
            message: 'Slot request submitted successfully',
            booking: slot.slots[slotIndex].booking
        });
    } catch (error) {
        console.error('Error requesting slot:', error);
        res.status(500).json({ message: 'Error requesting slot', error: error.message });
    }
});

// Get all bookings
router.get('/bookings', async (req, res) => {
    try {
        const slots = await Slot.find();
        const bookings = [];
        
        // Get all unique event IDs
        const eventIds = [...new Set(slots.map(slot => slot.eventId))];
        
        // Fetch all events in one query
        const events = await Event.find({ truckersmpId: { $in: eventIds } });
        
        // Create a map for quick lookup
        const eventMap = {};
        events.forEach(event => {
            eventMap[event.truckersmpId] = event;
        });

        slots.forEach(slot => {
            slot.slots.forEach(s => {
                if (s.booking) {
                    // Get event details from the map
                    const event = eventMap[slot.eventId];
                    
                    bookings.push({
                        _id: s._id, // Use the slot's _id
                        slotId: slot._id,
                        eventId: slot.eventId,
                        eventTitle: event ? event.title : 'Unknown Event',
                        imageUrl: slot.imageUrl,
                        imageNumber: slot.imageNumber,
                        slotNumber: s.number,
                        name: s.booking.name,
                        vtcName: s.booking.vtcName,
                        vtcRole: s.booking.vtcRole,
                        vtcLink: s.booking.vtcLink,
                        status: s.booking.status,
                        createdAt: s.booking.createdAt
                    });
                }
            });
        });

        console.log(`Found ${bookings.length} bookings`);
        res.json({ bookings });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ message: 'Error fetching bookings' });
    }
});

// Update booking status
router.patch('/:slotId/bookings/:slotNumber', async (req, res) => {
    try {
        const { status } = req.body;
        const { slotId, slotNumber } = req.params;

        console.log('Updating booking status:', { slotId, slotNumber, status });

        const slot = await Slot.findById(slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        // Find the specific slot
        const slotIndex = slot.slots.findIndex(s => s.number === parseInt(slotNumber));
        if (slotIndex === -1 || !slot.slots[slotIndex].booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Update the booking status
        slot.slots[slotIndex].booking.status = status;

        // If rejected, make the slot available again
        if (status === 'rejected') {
            slot.slots[slotIndex].isAvailable = true;
            slot.slots[slotIndex].booking = null;
        }

        await slot.save();
        console.log('Updated booking status:', slot.slots[slotIndex]);

        res.json({
            message: 'Booking status updated successfully',
            status
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ message: 'Error updating booking status' });
    }
});

// Update a slot
router.patch('/event/:eventId/slot/:slotId', async (req, res) => {
    try {
        const slot = await Slot.findById(req.params.slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        if (slot.eventId !== req.params.eventId) {
            return res.status(403).json({ message: 'Slot does not belong to this event' });
        }

        // Only allow updating certain fields
        const allowedUpdates = ['imageUrl', 'totalSlots'];
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                slot[key] = req.body[key];
                if (key === 'totalSlots') {
                    slot.slots.forEach(s => s.isAvailable = false);
                    slot.slots.forEach(s => s.booking = null);
                }
            }
        });

        await slot.save();
        res.json({ message: 'Slot updated successfully', slot });
    } catch (error) {
        console.error('Error updating slot:', error);
        res.status(500).json({ message: 'Error updating slot' });
    }
});

// Delete a slot
router.delete('/event/:eventId/slot/:slotId', async (req, res) => {
    try {
        const slot = await Slot.findById(req.params.slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        if (slot.slots && slot.slots.length > 0) {
            return res.status(400).json({ message: 'Cannot delete slot with active bookings' });
        }

        await Slot.findByIdAndDelete(req.params.slotId);
        res.json({ message: 'Slot deleted successfully' });
    } catch (error) {
        console.error('Error deleting slot:', error);
        res.status(500).json({ message: 'Error deleting slot' });
    }
});

// Create new slot request
router.post('/request', auth, async (req, res) => {
    try {
        const { eventId, slotNumber, vtcName, vtcLink, name, vtcRole } = req.body;

        // Find the slot
        const slot = await Slot.findOne({ eventId, 'slots.number': slotNumber });
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        // Find the specific slot in the slots array
        const slotIndex = slot.slots.findIndex(s => s.number === slotNumber);
        if (slotIndex === -1) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        // Check if slot is already booked
        if (slot.slots[slotIndex].booking) {
            return res.status(400).json({ message: 'Slot is already booked' });
        }

        // Get event details for notification
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Create booking
        const booking = {
            name: vtcName,
            vtcName: vtcName,
            vtcRole: vtcRole,
            vtcLink: vtcLink,
            status: 'pending',
            createdAt: new Date()
        };

        // Update slot with booking
        slot.slots[slotIndex].booking = booking;
        slot.slots[slotIndex].isAvailable = false;
        await slot.save();

        console.log('Slot request created:', slot.slots[slotIndex]);

        // Send Discord notification
        console.log('Sending Discord notification for new booking...');
       
        console.log('Discord notification sent successfully');

        res.json({
            message: 'Slot request submitted successfully',
            booking: slot.slots[slotIndex].booking
        });
    } catch (error) {
        console.error('Error creating slot request:', error);
        res.status(500).json({ message: 'Error creating slot request', error: error.message });
    }
});

// Update slot request status (admin only)
router.patch('/request/:id/status', adminAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const slotId = req.params.id;

        // Find the slot containing the booking
        const slot = await Slot.findOne({
            'slots.booking._id': slotId
        });

        if (!slot) {
            return res.status(404).json({ message: 'Slot request not found' });
        }

        // Find the specific slot and booking
        const slotIndex = slot.slots.findIndex(s => s.booking && s.booking._id.toString() === slotId);
        if (slotIndex === -1) {
            return res.status(404).json({ message: 'Slot request not found' });
        }

        // Get event details for notification
        const event = await Event.findById(slot.eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Update booking status
        slot.slots[slotIndex].booking.status = status;
        await slot.save();

        console.log('Slot request status updated, sending Discord notification...');
        
        // Send Discord notification for status update
        await discordService.sendBookingStatusUpdate({
            eventTitle: event.title,
            slotNumber: slot.slots[slotIndex].number,
            vtcName: slot.slots[slotIndex].booking.vtcName,
            vtcLink: slot.slots[slotIndex].booking.vtcLink,
            name: slot.slots[slotIndex].booking.name,
            vtcRole: slot.slots[slotIndex].booking.vtcRole,
            status: status
        });
        console.log('Discord status update notification sent successfully');

        res.json({
            message: 'Slot request status updated successfully',
            booking: slot.slots[slotIndex].booking
        });
    } catch (error) {
        console.error('Error updating slot request status:', error);
        res.status(500).json({ message: 'Error updating slot request status', error: error.message });
    }
});

// Delete slot image (admin only)
router.delete('/:eventId/slot/:slotId', adminAuth, async (req, res) => {
    try {
        const { eventId, slotId } = req.params;
        
        // Validate slotId is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(slotId)) {
            return res.status(400).json({ message: 'Invalid slot ID format' });
        }
        
        const slot = await Slot.findById(slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        if (slot.eventId !== eventId) {
            return res.status(403).json({ message: 'Slot does not belong to this event' });
        }

        // Check if there are any approved bookings
        const hasApprovedBookings = slot.slots.some(s => s.booking?.status === 'approved');
        if (hasApprovedBookings) {
            return res.status(400).json({ message: 'Cannot delete slot with approved bookings' });
        }

        await Slot.findByIdAndDelete(slotId);
        res.json({ message: 'Slot image deleted successfully' });
    } catch (error) {
        console.error('Error deleting slot image:', error);
        res.status(500).json({ message: 'Error deleting slot image' });
    }
});

// Delete approved slot request (admin only)
router.delete('/:slotId/bookings/:slotNumber', adminAuth, async (req, res) => {
    try {
        const { slotId, slotNumber } = req.params;
        
        // Validate slotId is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(slotId)) {
            return res.status(400).json({ message: 'Invalid slot ID format' });
        }
        
        const slot = await Slot.findById(slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        const slotIndex = slot.slots.findIndex(s => s.number === parseInt(slotNumber));
        if (slotIndex === -1) {
            return res.status(404).json({ message: 'Slot number not found' });
        }

        const booking = slot.slots[slotIndex].booking;
        if (!booking || booking.status !== 'approved') {
            return res.status(400).json({ message: 'No approved booking found for this slot' });
        }

        // Clear the booking and make the slot available again
        slot.slots[slotIndex].booking = null;
        slot.slots[slotIndex].isAvailable = true;
        await slot.save();

        res.json({ message: 'Approved booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting approved booking:', error);
        res.status(500).json({ message: 'Error deleting approved booking' });
    }
});

// Update slot status (admin only)
router.patch('/:eventId/slot/:slotId/status', adminAuth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    console.log('Updating slot status:', { slotId: req.params.slotId, status, notes });

    const slot = await Slot.findById(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    if (slot.eventId.toString() !== req.params.eventId) {
      return res.status(400).json({ message: 'Slot does not belong to this event' });
    }

    // Get event details for the notification
    const event = await Event.findOne({ truckersmpId: req.params.eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    slot.booking.status = status;
    slot.booking.notes = notes || slot.booking.notes;
    slot.booking.approvedBy = req.user._id;
    
    if (status === 'approved') {
      slot.status = 'booked';
    } else if (status === 'rejected') {
      slot.status = 'available';
      slot.booking = null;
    }

    await slot.save();

    // Send Discord notification if the booking exists and has a Discord username
    if (slot.booking && slot.booking.discordUsername) {
      try {
        await discordBot.sendBookingNotification(
          slot.booking.discordUsername,
          event.title,
          slot.slotNumber,
          status
        );
        console.log('Discord notification sent successfully');
      } catch (error) {
        console.error('Error sending Discord notification:', error.message);
        // Continue with the response even if Discord notification fails
      }
    }

    res.json({
      message: 'Slot status updated successfully',
      slot
    });
  } catch (error) {
    console.error('Error updating slot status:', error);
    res.status(500).json({ 
      message: 'Error updating slot status', 
      error: error.message 
    });
  }
});

module.exports = router; 