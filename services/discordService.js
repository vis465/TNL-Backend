const axios = require('axios');

class DiscordService {
    constructor() {
        this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        if (!this.webhookUrl) {
            console.warn('Discord webhook URL not configured');
            return;
        }

        this.initialized = true;
    }

    async sendBookingNotification(booking) {
        try {
            await this.initialize();
            
            if (!this.webhookUrl) {
                console.warn('Discord webhook URL not configured. Skipping notification.');
                return;
            }

            if (!this.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                console.warn('Invalid Discord webhook URL format. Skipping notification.');
                return;
            }

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
                    {
                        name: 'Discord Username',
                        value: booking.discordUsername || 'N/A',
                        inline: true
                    }
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
                name: 'Take action',
                value: `[Manage slot booking](https://events.tamilnadulogistics.in/admin)`,
                inline: true
            });

            const payload = {
                content: '<@&1335290164750319706> <@&1335289849145724928> <@&1335290367347658762> <@&1335290229321498768>',
                embeds: [embed]
            };

            console.log('Sending Discord webhook request...');
            
            try {
                const response = await axios.post(this.webhookUrl, payload, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000 // 5 second timeout
                });

                if (response.status === 204) {
                    console.log('Discord notification sent successfully');
                } else {
                    console.log('Discord notification sent with status:', response.status);
                }
            } catch (error) {
                console.error('Error sending Discord webhook:', error.message);
                // Don't throw the error, just log it and continue
            }
        } catch (error) {
            console.error('Error in sendBookingNotification:', error.message);
            // Don't throw the error, just log it and continue
        }
    }

    async sendBookingStatusUpdate(booking) {
        try {
            await this.initialize();
            
            if (!this.webhookUrl) {
                console.warn('Discord webhook URL not configured. Skipping notification.');
                return;
            }

            if (!this.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                console.warn('Invalid Discord webhook URL format. Skipping notification.');
                return;
            }

            // Set color based on status
            let statusColor;
            switch (booking.status) {
                case 'approved':
                    statusColor = 0x00ff00; // Green
                    break;
                case 'rejected':
                    statusColor = 0xff0000; // Red
                    break;
                default:
                    statusColor = 0xffa500; // Orange for pending
            }

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
                    },
                    {
                        name: 'Discord Username',
                        value: booking.discordUsername || 'N/A',
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'VTC Convoy Booking System'
                }
            };

            const payload = {
                content: '<@&1335290164750319706> <@&1335289849145724928> <@&1335290367347658762> <@&1335290229321498768>',
                embeds: [embed]
            };

            console.log('Sending Discord webhook request for status update...');
            
            try {
                const response = await axios.post(this.webhookUrl, payload, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000 // 5 second timeout
                });

                if (response.status === 204) {
                    console.log('Discord status update notification sent successfully');
                } else {
                    console.log('Discord status update notification sent with status:', response.status);
                }
            } catch (error) {
                console.error('Error sending Discord webhook:', error.message);
                // Don't throw the error, just log it and continue
            }
        } catch (error) {
            console.error('Error in sendBookingStatusUpdate:', error.message);
            // Don't throw the error, just log it and continue
        }
    }
}

module.exports = new DiscordService(); 