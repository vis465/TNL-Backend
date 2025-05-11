const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const Event = require('../models/Event');
const Slot = require('../models/Slot');
const Booking = require('../models/Booking');
const { Parser } = require('json2csv');

// Get analytics dashboard data
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        console.log('Fetching analytics dashboard data');
        
        // Get event attendance statistaics from TruckersMP data
        const events = await Event.find();
        console.log(`Found ${events.length} events`);
        
        const eventAttendance = events.map(event => ({
            name: event.title,
            attendance: event.attendances?.confirmed || 0
        })).sort((a, b) => b.attendance - a.attendance); // Sort in descending order

        // Get booking patterns
        const allSlots = await Slot.find();
        console.log(`Found ${allSlots.length} total slots`);
        
        const bookingPatterns = [
            { name: 'Approved', value: 0 },
            { name: 'Pending', value: 0 },
            { name: 'Rejected', value: 0 }
        ];

        allSlots.forEach(slot => {
            slot.slots.forEach(s => {
                if (s.booking) {
                    const status = s.booking.status;
                    const pattern = bookingPatterns.find(p => p.name.toLowerCase() === status);
                    if (pattern) pattern.value++;
                }
            });
        });

        // Get VTC participation
        const vtcStats = {};
        
        allSlots.forEach(slot => {
            slot.slots.forEach(s => {
                if (s.booking?.status === 'approved' && s.booking.vtcName) {
                    vtcStats[s.booking.vtcName] = (vtcStats[s.booking.vtcName] || 0) + 1;
                }
            });
        });

        const vtcParticipation = Object.entries(vtcStats)
            .map(([name, value]) => ({
                name,
                value
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Limit to top 10 VTCs for better visualization

        // Get slot utilization data
        const slotUtilization = [];
        
        for (const event of events) {
            const slots = await Slot.find({ eventId: event.truckersmpId });
            let totalSlots = 0;
            let approvedSlots = 0;
            let pendingSlots = 0;
            let rejectedSlots = 0;
            let availableSlots = 0;
            
            slots.forEach(slot => {
                totalSlots += slot.slots.length;
                slot.slots.forEach(s => {
                    if (s.booking) {
                        switch (s.booking.status.toLowerCase()) {
                            case 'approved':
                                approvedSlots++;
                                break;
                            case 'pending':
                                pendingSlots++;
                                break;
                            case 'rejected':
                                rejectedSlots++;
                                break;
                        }
                    } else {
                        availableSlots++;
                    }
                });
            });
            
            if (totalSlots > 0) {
                slotUtilization.push({
                    name: event.title,
                    approved: Math.round((approvedSlots / totalSlots) * 100),
                    pending: Math.round((pendingSlots / totalSlots) * 100),
                    rejected: Math.round((rejectedSlots / totalSlots) * 100),
                    available: Math.round((availableSlots / totalSlots) * 100)
                });
            }
        }

        console.log('Analytics data prepared:', {
            eventAttendance: eventAttendance.length,
            bookingPatterns: bookingPatterns,
            vtcParticipation: vtcParticipation.length,
            slotUtilization: slotUtilization.length
        });

        res.json({
            eventAttendance,
            bookingPatterns,
            vtcParticipation,
            slotUtilization
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ message: 'Error fetching analytics data' });
    }
});

// Export approved bookings as CSV
router.get('/export', adminAuth, async (req, res) => {
    try {
        const slots = await Slot.find();
        const bookings = [];

        slots.forEach(slot => {
            slot.slots.forEach(s => {
                if (s.booking?.status === 'approved') {
                    bookings.push({
                        eventId: slot.eventId,
                        slotNumber: s.number,
                        vtcName: s.booking.vtcName,
                        contactPerson: s.booking.name,
                        playerCount: s.booking.playercount,
                        bookingDate: s.booking.createdAt
                    });
                }
            });
        });

        const fields = [
            'eventId',
            'slotNumber',
            'vtcName',
            'contactPerson',
            'playerCount',
            'bookingDate'
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(bookings);

        res.header('Content-Type', 'text/csv');
        res.attachment('approved-bookings.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ message: 'Error exporting data' });
    }
});

// Export event-wise slot booking information
router.get('/export-event-slots', adminAuth, async (req, res) => {
    try {
        const events = await Event.find();
        const eventSlots = [];

        for (const event of events) {
            const slots = await Slot.find({ eventId: event.truckersmpId });
            let totalSlots = 0;
            let approvedBookings = 0;
            let pendingBookings = 0;
            let rejectedBookings = 0;
            let availableSlots = 0;

            slots.forEach(slot => {
                totalSlots += slot.slots.length;
                slot.slots.forEach(s => {
                    if (s.booking) {
                        switch (s.booking.status.toLowerCase()) {
                            case 'approved':
                                approvedBookings++;
                                break;
                            case 'pending':
                                pendingBookings++;
                                break;
                            case 'rejected':
                                rejectedBookings++;
                                break;
                        }
                    } else {
                        availableSlots++;
                    }
                });
            });

            eventSlots.push({
                eventId: event.truckersmpId,
                eventTitle: event.title,
                totalSlots,
                approvedBookings,
                pendingBookings,
                rejectedBookings,
                availableSlots,
                truckersmpAttendance: event.attendances?.confirmed || 0
            });
        }

        const fields = [
            'eventId',
            'eventTitle',
            'totalSlots',
            'approvedBookings',
            'pendingBookings',
            'rejectedBookings',
            'availableSlots',
            'truckersmpAttendance'
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(eventSlots);

        res.header('Content-Type', 'text/csv');
        res.attachment('event-slot-bookings.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting event slot data:', error);
        res.status(500).json({ message: 'Error exporting event slot data' });
    }
});

// Export event-wise slot information
router.get('/export-event-slots/:eventId', adminAuth, async (req, res) => {
    try {
        const { eventId } = req.params;
        const event = await Event.findOne({ truckersmpId: eventId });
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const slots = await Slot.find({ eventId });
        const slotBookings = [];

        slots.forEach(slot => {
            slot.slots.forEach(s => {
                if (s.booking?.status === 'approved') {
                    slotBookings.push({
                        eventTitle: event.title,
                        slotNumber: s.number,
                        vtcName: s.booking.vtcName,
                        contactPerson: s.booking.name,
                        playerCount: s.booking.playercount,
                        bookingDate: s.booking.createdAt
                    });
                }
            });
        });

        const fields = [
            'eventTitle',
            'slotNumber',
            'vtcName',
            'contactPerson',
            'playerCount',
            'bookingDate'
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(slotBookings);

        res.header('Content-Type', 'text/csv');
        res.attachment(`${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_slot_bookings.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting event slot data:', error);
        res.status(500).json({ message: 'Error exporting event slot data' });
    }
});

// Get recent bookings (latest 10)
router.get('/recent-bookings', adminAuth, async (req, res) => {
    try {
        const slots = await Slot.find();
        const events = await Event.find();
        const eventMap = {};
        events.forEach(event => {
            eventMap[event.truckersmpId] = event.title;
        });
        let bookings = [];
        slots.forEach(slot => {
            slot.slots.forEach(s => {
                if (s.booking) {
                    bookings.push({
                        eventTitle: eventMap[slot.eventId] || 'Unknown',
                        vtcName: s.booking.vtcName,
                        slotNumber: s.number,
                        status: s.booking.status,
                        createdAt: s.booking.createdAt,
                        discordUsername: s.booking.discordUsername || ''
                    });
                }
            });
        });
        bookings = bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
        res.json({ bookings });
    } catch (error) {
        console.error('Error fetching recent bookings:', error);
        res.status(500).json({ message: 'Error fetching recent bookings' });
    }
});

module.exports = router; 