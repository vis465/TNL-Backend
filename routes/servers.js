const express = require('express');
const router = express.Router();
const axios = require('axios');

// Get all TruckersMP servers
router.get('/', async (req, res) => {
    try {
        const response = await axios.get('https://api.truckersmp.com/v2/servers');
        
        // Filter and sort servers
        const servers = response.data.response
            .filter(server => server.online) // Only show online servers
            .sort((a, b) => {
                // Sort by game first (ETS2 before ATS)
                if (a.game !== b.game) {
                    return a.game === 'ETS2' ? -1 : 1;
                }
                // Then by display order
                return a.displayorder - b.displayorder;
            });

        res.json({ servers });
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ 
            message: 'Error fetching server information',
            error: error.message 
        });
    }
});

module.exports = router; 