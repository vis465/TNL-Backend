const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const Event = require('../models/Event');
const { auth, adminAuth } = require('../middleware/auth');
const https = require('https');
const Slot = require('../models/Slot');

// Configure axios to ignore SSL certificate verification and include required headers
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'TNL-Booking-System/1.0',
        'Cache-Control': 'no-cache'
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Get all events
router.get('/', async (req, res) => {
    try {
        console.log('Fetching all events from TruckersMP...');

        // Fetch events from TruckersMP API
        const { data } = await axios.get('https://api.truckersmp.com/v2/vtc/70030/events', {
            headers: { 'Accept': 'application/json' }
        });

        const truckersmpEvents = data?.response;
        if (!truckersmpEvents || !Array.isArray(truckersmpEvents)) {
            console.error('Invalid response from TruckersMP API:', data);
            throw new Error('Invalid response from TruckersMP API');
        }

        console.log(`Received ${truckersmpEvents.length} events from TruckersMP`);

        // Get all event IDs from TruckersMP response
        const truckersmpEventIds = truckersmpEvents.map(event => event.id.toString());
        
        // Find events in our database that are not in TruckersMP response
        const eventsToDelete = await Event.find({
            truckersmpId: { $nin: truckersmpEventIds }
        });

        // Delete events that no longer exist in TruckersMP
        if (eventsToDelete.length > 0) {
            console.log(`Deleting ${eventsToDelete.length} events that no longer exist in TruckersMP`);
            for (const event of eventsToDelete) {
                try {
                    // Delete associated slots first
                    await Slot.deleteMany({ eventId: event._id });
                    console.log(`Deleted slots for event ${event.truckersmpId}`);
                    
                    // Then delete the event
                    await Event.findByIdAndDelete(event._id);
                    console.log(`Deleted event ${event.truckersmpId}`);
                } catch (error) {
                    console.error(`Error deleting event ${event.truckersmpId}:`, error);
                }
            }
        }

        // Process and upsert events
        const results = await Promise.allSettled(
            truckersmpEvents.map(async (event) => {
                try {
                    if (!event.id) {
                        console.warn('Skipping event due to missing ID:', event);
                        return null;
                    }

                    const eventId = event.id.toString();
                    // console.log(`Processing event ${eventId}: ${event.name || 'Untitled'}`);

                    // Check if event exists in database
                    const existingEvent = await Event.findOne({ truckersmpId: eventId });
                    // console.log(`Event ${eventId} exists in database: ${!!existingEvent}`);

                    const eventData = {
                        truckersmpId: eventId,
                        title: event.name || 'Untitled Event',
                        description: event.description || 'No description available',
                        startDate: event.start_at ? new Date(event.start_at) : new Date(),
                        route: event.departure && event.arrive
                            ? `${event.departure.city || 'Unknown'} → ${event.arrive.city || 'Unknown'}`
                            : 'Route not specified',
                        server: event.server?.name || 'Server not specified',
                        meetingPoint: event.departure?.location || 'Meeting point not specified',
                        departurePoint: event.departure?.city || 'Departure point not specified',
                        arrivalPoint: event.arrive?.city || 'Arrival point not specified',
                        banner: event.banner || '',
                        map: event.map || '',
                        status: getEventStatus(event.start_at, event.end_at),
                        attendances: event.attendances || { confirmed: 0, vtcs: 0, confirmed_vtcs: [], confirmed_users: [] },
                        voiceLink: event.voice_link || '',
                        externalLink: event.external_link || '',
                        rule: event.rule || '',
                        dlcs: event.dlcs || [],
                        url: event.url || `https://truckersmp.com/events/${eventId}`
                    };

                    if (existingEvent) {
                        // Update existing event
                        Object.assign(existingEvent, eventData);
                        await existingEvent.save();
                        // console.log(`Updated event ${eventId} in database`);
                        return existingEvent;
                    } else {
                        // Create new event
                        const newEvent = new Event(eventData);
                        await newEvent.save();
                        console.log(`Created new event ${eventId} in database`);
                        return newEvent;
                    }
                } catch (error) {
                    console.error(`Error processing event ${event.id}:`, error);
                    return null;
                }
            })
        );

        // Filter successfully processed events
        const validEvents = results
            .filter(({ status }) => status === 'fulfilled')
            .map(({ value }) => value)
            .filter(event => event !== null);

        console.log(`Successfully processed ${validEvents.length} events out of ${truckersmpEvents.length} total events`);

        // Verify database state
        const totalEventsInDB = await Event.countDocuments();
        console.log(`Total events in database: ${totalEventsInDB}`);

        res.json({ 
            response: validEvents,
            stats: {
                totalReceived: truckersmpEvents.length,
                totalProcessed: validEvents.length,
                totalInDatabase: totalEventsInDB
            }
        });
    } catch (error) {
        console.error('Error fetching events:', error.message || error);
        res.status(500).json({ 
            message: 'Error fetching events', 
            error: error.message,
            stack: error.stack
        });
    }
});
router.get("/attending",async (req,res)=>{
    try{
    const tmpevents=await axiosInstance.get("https://api.truckersmp.com/v2/vtc/70030/events/attending");
    if(!tmpevents.data.response){
        return res.status(404).json({message:"No events found"});
    }
    
    
    res.json(tmpevents.data.response);}
    catch(error){
        console.error('Error fetching attending events:', error.message || error);
        res.status(500).json({ 
            message: 'Error fetching attending events', 
            error: error.message,
            stack: error.stack
        });
    }
})
// Get single event by ID
router.get('/:id', async (req, res) => {
    try {
        console.log("Route handler invoked");
        console.log("Request params:", req.params);
        
        const id = req.params.id;
        console.log('Fetching event with ID:', id);
        
        // First try to get from local database
        let event = await Event.findOne({ truckersmpId: id });
        let eventData={};
        if (true) {
            // If not found locally, fetch from TruckersMP
            const response = await axiosInstance.get(`https://api.truckersmp.com/v2/events/${id}`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'TNL-Booking-System/1.0',
                    'Cache-Control': 'no-cache'
                }
            });
            if (!response.data || !response.data.response) {
                return res.status(404).json({ message: 'Event not found' });
            }
            const truckersmpEvent = response.data.response;
            console.log('Received event data from TruckersMP:', truckersmpEvent);

            const startDate = truckersmpEvent.start_at ? new Date(truckersmpEvent.start_at) : new Date();
            const endDate = truckersmpEvent.end_at ? new Date(truckersmpEvent.end_at) : startDate; // Use start date as fallback
            console.log("truckersmpEvent.id",truckersmpEvent.id)
            eventData = {
                truckersmpId: truckersmpEvent.id.toString(),
                title: truckersmpEvent.name || 'Untitled Event',
                description: truckersmpEvent.description || 'No description available',
                startDate: startDate,
                endDate: endDate,
                route: truckersmpEvent.departure && truckersmpEvent.arrive ? 
                    `${truckersmpEvent.departure.city || 'Unknown'} → ${truckersmpEvent.arrive.city || 'Unknown'}` : 'Route not specified',
                server: truckersmpEvent.server ? truckersmpEvent.server.name : 'Server not specified',
                meetingPoint: truckersmpEvent.meetup_at || 'Meeting point not specified',
                departurePoint: truckersmpEvent.departure ? truckersmpEvent.departure.city : 'Departure point not specified',
                arrivalPoint: truckersmpEvent.arrive ? truckersmpEvent.arrive.city : 'Arrival point not specified',
                banner: truckersmpEvent.banner || '',
                map: truckersmpEvent.map || '',
                status: getEventStatus(truckersmpEvent.start_at, truckersmpEvent.end_at),
                attendances: truckersmpEvent.attendances || { confirmed: 0, vtcs: 0, confirmed_vtcs: [], confirmed_users: [] },
                voiceLink: truckersmpEvent.voice_link || '',
                externalLink: truckersmpEvent.external_link || '',
                rule: truckersmpEvent.rule || '',
                dlcs: truckersmpEvent.dlcs || [],
                url: truckersmpEvent.url || `https://truckersmp.com/events/${truckersmpEvent.id}`
            };

            // Create new event in local database
            
        }

        res.json(eventData);
    } catch (error) {
        console.error('Error fetching event:', error.response?.data || error.message);
        res.status(500).json({ 
            message: 'Error fetching event from TruckersMP',
            error: error.response?.data || error.message
        });
    }
});

// Helper function to determine event status
function getEventStatus(startAt, endAt) {
    const now = new Date();
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'ongoing';
    if (now > end) return 'completed';
    return 'completed';
}

// Upload slot image (admin only)
router.post('/:id/slot-image', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const event = await Event.findOne({ truckersmpId: req.params.id });
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        event.slotImage = `/uploads/${req.file.filename}`;
        await event.save();

        res.json({ message: 'Slot image uploaded successfully', image: event.slotImage });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading image', error: error.message });
    }
});

// Update event status (admin only)
router.patch('/:id/status', adminAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const event = await Event.findOne({ truckersmpId: req.params.id });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        event.status = status;
        await event.save();

        res.json({ message: 'Event status updated successfully', event });
    } catch (error) {
        res.status(500).json({ message: 'Error updating event status', error: error.message });
    }
});

// Add slots to an event (admin only)
router.post('/:id/slots', adminAuth, upload.array('images', 10), async (req, res) => {
    try {
        console.log('Adding slots to event:', req.params.id);
        const event = await Event.findOne({ truckersmpId: req.params.id });
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const { descriptions } = req.body;
        const descriptionsArray = JSON.parse(descriptions);

        if (!Array.isArray(descriptionsArray) || descriptionsArray.length !== req.files.length) {
            return res.status(400).json({ message: 'Number of descriptions must match number of images' });
        }

        const slots = await Promise.all(req.files.map(async (file, index) => {
            const slot = new Slot({
                eventId: event._id,
                slotNumber: event.slots.length + index + 1,
                image: `/uploads/${file.filename}`,
                description: descriptionsArray[index]
            });

            await slot.save();
            event.slots.push(slot._id);
            return slot;
        }));

        await event.save();

        res.status(201).json({
            message: 'Slots added successfully',
            slots
        });
    } catch (error) {
        console.error('Error adding slots:', error);
        res.status(500).json({ 
            message: 'Error adding slots', 
            error: error.message 
        });
    }
});

// Get slots for an event
router.get('/:id/slots', async (req, res) => {
    try {
        console.log('Fetching slots for event:', req.params.id);
        const event = await Event.findOne({ truckersmpId: req.params.id })
            .populate('slots');
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json(event.slots);
    } catch (error) {
        console.error('Error fetching slots:', error);
        res.status(500).json({ 
            message: 'Error fetching slots', 
            error: error.message 
        });
    }
});

// Update slot status (admin only)
router.patch('/:id/slots/:slotId/status', adminAuth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        console.log('Updating slot status:', { slotId: req.params.slotId, status, notes });

        const slot = await Slot.findById(req.params.slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        if (slot.eventId.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Slot does not belong to this event' });
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