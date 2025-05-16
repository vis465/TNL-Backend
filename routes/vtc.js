const express = require('express');
const router = express.Router();
const truckersmpService = require('../services/truckersmpService');

// Get processed VTC data
router.get('/:vtcId', async (req, res) => {
  try {
    console.log('Received request for VTC ID:', req.params.vtcId);
    const { vtcId } = req.params;
    const data = await truckersmpService.getProcessedVtcData(vtcId);
    console.log('Processed VTC data:', data);
    res.json(data);
  } catch (error) {
    console.error('Error in VTC data endpoint:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch VTC data'
    });
  }
});

// Get VTC members
router.get('/:vtcId/members', async (req, res) => {
  try {
    const { vtcId } = req.params;
    const data = await truckersmpService.getVtcMembers(vtcId);
    res.json(data);
  } catch (error) {
    console.error('Error in VTC members endpoint:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch VTC members'
    });
  }
});

// Get VTC roles
router.get('/:vtcId/roles', async (req, res) => {
  try {
    const { vtcId } = req.params;
    const data = await truckersmpService.getVtcRoles(vtcId);
    res.json(data);
  } catch (error) {
    console.error('Error in VTC roles endpoint:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch VTC roles'
    });
  }
});

// Get individual member details
router.get('/:vtcId/member/:memberId', async (req, res) => {
  try {
    const { vtcId, memberId } = req.params;
    const data = await truckersmpService.getMemberDetails(vtcId, memberId);
    res.json(data);
  } catch (error) {
    console.error('Error in member details endpoint:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch member details'
    });
  }
});

// Get partners information
router.get('/partners', async (req, res) => {
  try {
    const partnerIds = [19885, 64218, 76045, 79072, 75200]; // Indian Truckers, Indian Carriers, Indian Group, Lumo Haul, Aura
    const data = await truckersmpService.getPartnersInfo(partnerIds);
    console.log(data)
    res.json(data);
  } catch (error) {
    // console.error('Error in partners endpoint:', error);cls
    
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch partners information'
    });
  }
});

module.exports = router; 