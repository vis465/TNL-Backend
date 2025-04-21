const axios = require('axios');

class DiscordService {
    constructor() {
        this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        console.log('DiscordService initialized with webhook URL:', this.webhookUrl ? 'Configured' : 'Not configured');
        if (this.webhookUrl) {
            console.log('Webhook URL format:', this.webhookUrl.startsWith('https://discord.com/api/webhooks/') ? 'Valid' : 'Invalid');
        }
    }

    async sendBookingNotification(booking) {
        if (!this.webhookUrl) {
            console.error('Discord webhook URL not configured. Please check your environment variables.');
            return;
        }

        if (!this.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
            console.error('Invalid Discord webhook URL format. URL should start with https://discord.com/api/webhooks/');
            return;
        }

        try {
            console.log('Preparing Discord notification for booking:', JSON.stringify(booking, null, 2));
            
            const embed = {
                title: `🎮 Slot Booking Request from ${booking.vtcName} for ${booking.eventTitle}`,
                color: 0x00ff00, // Green color
                fields: [
                    {
                        name: 'Event',
                        value: booking.eventTitle || 'N/A',
                        inline: true
                    },
                    {
                        name: 'Slot Number',
                        value: `#${booking.slotNumber}`,
                        inline: true
                    },
                    {
                        name: 'VTC Name',
                        value: booking.vtcName || 'N/A',
                        inline: true
                    },
                    {
                        name: 'Contact Person',
                        value: booking.name || 'N/A',
                        inline: true
                    },
                    {
                        name: 'VTC Role',
                        value: booking.vtcRole || 'N/A',
                        inline: true
                    },
                    {
                        name: 'Status',
                        value: booking.status || 'Pending',
                        inline: true
                    },
                    
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'VTC Convoy Booking System'
                }
            };

            // Add VTC Profile link if available
            if (booking.vtcLink) {
                embed.fields.push({
                    name: 'VTC Profile',
                    value: `[View on TruckersMP](${booking.vtcLink})`,
                    inline: false
                });
            }
            embed.fields.push({
                name: 'Take action ',
                value: `[Manage slot booking](https://events.tamilnadulogistics.in/admin)`,
                inline: true
            })

            const payload = {
                content: '<@&1335290164750319706> <@&1335289849145724928> <@&1335290367347658762> <@&1335290229321498768>',
                embeds: [embed]
            };

            console.log('Sending Discord webhook request...');
           
            const response = await axios.post(this.webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

           

            if (response.status === 204) {
                console.log('Discord notification sent successfully');
            } else {
                console.log('Discord notification sent with status:', response.status);
            }
        } catch (error) {
            console.error('Error sending Discord notification:', error.message);
            if (error.response) {
                console.error('Discord API response:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
            }
            if (error.request) {
                console.error('Request details:', {
                    method: error.request.method,
                    path: error.request.path,
                    headers: error.request.headers
                });
            }
            throw error;
        }
    }

    async sendBookingStatusUpdate(booking) {
        if (!this.webhookUrl) {
            console.error('Discord webhook URL not configured. Please check your environment variables.');
            return;
        }

        if (!this.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
            console.error('Invalid Discord webhook URL format. URL should start with https://discord.com/api/webhooks/');
            return;
        }

        try {
            console.log('Preparing Discord status update for booking:', JSON.stringify(booking, null, 2));
            
            const statusColor = booking.status === 'approved' ? 0x00ff00 : // Green
                              booking.status === 'rejected' ? 0xff0000 : // Red
                              0xffa500; // Orange for pending

            const embed = {
                title: '🔄 Booking Status Update',
                color: statusColor,
                fields: [
                    {
                        name: 'Event',
                        value: booking.eventTitle || 'N/A',
                        inline: true
                    },
                    {
                        name: 'Slot Number',
                        value: `#${booking.slotNumber}`,
                        inline: true
                    },
                    {
                        name: 'VTC Name',
                        value: booking.vtcName || 'N/A',
                        inline: true
                    },
                    {
                        name: 'New Status',
                        value: booking.status.charAt(0).toUpperCase() + booking.status.slice(1),
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'VTC Convoy Booking System'
                }
            };

            const payload = {
                embeds: [embed]
            };

            console.log('Sending Discord webhook request...');
            console.log('Webhook URL:', this.webhookUrl);
            console.log('Payload:', JSON.stringify(payload, null, 2));

            const response = await axios.post(this.webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('Discord API Response:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data
            });

            if (response.status === 204) {
                console.log('Discord status update notification sent successfully');
            } else {
                console.log('Discord status update notification sent with status:', response.status);
            }
        } catch (error) {
            console.error('Error sending Discord status update notification:', error.message);
            if (error.response) {
                console.error('Discord API response:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
            }
            if (error.request) {
                console.error('Request details:', {
                    method: error.request.method,
                    path: error.request.path,
                    headers: error.request.headers
                });
            }
            throw error;
        }
    }
}

module.exports = new DiscordService(); 