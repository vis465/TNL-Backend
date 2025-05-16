const axios = require('axios');

const API_BASE_URL = 'https://api.truckersmp.com/v2';

class TruckersMPService {
  // Fetch VTC members
  async getVtcMembers(vtcId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/vtc/${vtcId}/members`);
      if (response.data.error) {
        throw new Error('Failed to fetch VTC members');
      }
      return response.data.response.members || [];
    } catch (error) {
      console.error('Error fetching VTC members:', error);
      throw error;
    }
  }

  // Fetch VTC roles
  async getVtcRoles(vtcId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/vtc/${vtcId}/roles`);
      if (response.data.error) {
        throw new Error('Failed to fetch VTC roles');
      }
      return response.data.response.roles || [];
    } catch (error) {
      console.error('Error fetching VTC roles:', error);
      throw error;
    }
  }

  // Process and organize VTC data
  async getProcessedVtcData(vtcId) {
    try {
      // Fetch members and roles in parallel
      const [members, roles] = await Promise.all([
        this.getVtcMembers(vtcId),
        this.getVtcRoles(vtcId)
      ]);

      // Create a map of role IDs to role details
      const roleMap = new Map(roles.map(role => [role.id, {
        id: role.id,
        name: role.name,
        order: role.order,
        color: role.color || '#757575',
        isOwner: role.owner,
        createdAt: role.created_at,
        updatedAt: role.updated_at
      }]));

      // Process members with their roles
      const processedMembers = members.map(member => ({
        id: member.id,
        userId: member.user_id,
        username: member.username,
        steamId: member.steam_id,
        steamId64: member.steamID64,
        roles: member.roles.map(role => ({
          id: role.id,
          name: role.name,
          permissionLevel: role.permission_level,
          order: role.order,
          color: role.color,
          isManager: role.manager === 1,
          createdAt: role.created_at,
          updatedAt: role.updated_at
        })),
        primaryRole: member.role,
        isOwner: member.is_owner,
        joinDate: member.joinDate
      }));

      // Group members by their primary role
      const departments = processedMembers.reduce((acc, member) => {
        const primaryRole = member.primaryRole || 'Other';
        if (!acc[primaryRole]) {
          acc[primaryRole] = [];
        }
        acc[primaryRole].push(member);
        return acc;
      }, {});

      // Sort departments by role order (from roles data)
      const roleOrderMap = new Map(roles.map(role => [role.name, role.order]));
      const sortedDepartments = Object.entries(departments)
        .sort(([roleA], [roleB]) => {
          const orderA = roleOrderMap.get(roleA) || 999;
          const orderB = roleOrderMap.get(roleB) || 999;
          return orderA - orderB;
        })
        .reduce((acc, [key, value]) => {
          acc[key] = value.sort((a, b) => a.username.localeCompare(b.username));
          return acc;
        }, {});

      return {
        departments: sortedDepartments,
        totalMembers: members.length,
        totalRoles: roles.length,
        roles: roles.map(role => ({
          id: role.id,
          name: role.name,
          order: role.order,
          color: role.color || '#757575',
          isOwner: role.owner,
          createdAt: role.created_at,
          updatedAt: role.updated_at
        })),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error processing VTC data:', error);
      throw error;
    }
  }

  // Fetch individual member details
  async getMemberDetails(vtcId, memberId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/vtc/${vtcId}/member/${memberId}`);
      if (response.data.error) {
        throw new Error('Failed to fetch member details');
      }
      return response.data.response;
    } catch (error) {
      console.error('Error fetching member details:', error);
      throw error;
    }
  }

  // Fetch VTC information
  async getVtcInfo(vtcId) {
    try {
      const response = await axios.get(`www.api.truckersmp.com/vtc/${vtcId}`);
      if (response.data.error) {
        throw new Error('Failed to fetch VTC information');
      }
      return response.data.response;
    } catch (error) {
      console.error('Error fetching VTC information:', error);
      throw error;
    }
  }

  // Fetch multiple VTCs information
  async getPartnersInfo(vtcIds) {
    try {
      const partnerPromises = vtcIds.map(id => this.getVtcInfo(id));
      const partners = await Promise.all(partnerPromises);
      return partners.map(partner => ({
        id: partner.id,
        name: partner.name,
        logo: partner.logo,
        tag: partner.tag,
        owner: partner.owner,
        memberCount: partner.members_count,
        recruitment: partner.recruitment,
        game: partner.game,
        information: partner.information,
        rules: partner.rules,
        requirements: partner.requirements,
        website: partner.website,
        discord: partner.discord
      }));
    } catch (error) {
      console.error('Error fetching partners information:', error);
      throw error;
    }
  }
}

module.exports = new TruckersMPService(); 