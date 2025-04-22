const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

class DiscordBot {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initializing = false;
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializing) return;
    
    this.initializing = true;
    
    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages
        ]
      });

      this.client.on('ready', () => {
        console.log(`Discord bot logged in as ${this.client.user.tag}`);
      });

      // Set a timeout for the login attempt
      const loginPromise = this.client.login(process.env.DISCORD_BOT_TOKEN);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Discord login timeout')), 10000);
      });
      
      await Promise.race([loginPromise, timeoutPromise]);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Discord bot:', error.message);
      // Don't throw the error, just log it and continue
    } finally {
      this.initializing = false;
    }
  }

  async sendDirectMessage(discordUsername, message) {
    try {
      await this.initialize();
      
      if (!this.client || !this.initialized) {
        console.warn('Discord bot not initialized. Skipping direct message.');
        return false;
      }
      
      // Remove the discriminator if present (username#1234 -> username)
      const username = discordUsername.split('#')[0];
      
      // Find the user in the guild
      const guild = this.client.guilds.cache.first();
      if (!guild) {
        console.error('No guild found');
        return false;
      }

      const member = await guild.members.fetch();
      const user = member.find(m => m.user.username.toLowerCase() === username.toLowerCase());

      if (!user) {
        console.error(`User ${username} not found in the guild`);
        return false;
      }

      // Send the message
      await user.send(message);
      return true;
    } catch (error) {
      console.error('Error sending Discord message:', error.message);
      return false;
    }
  }

  async sendBookingNotification(discordUsername, eventTitle, slotNumber, status) {
    try {
      const message = status === 'approved' 
        ? `🎉 Your booking for slot ${slotNumber} in event "${eventTitle}" has been approved!`
        : `❌ Your booking for slot ${slotNumber} in event "${eventTitle}" has been rejected.`;

      return await this.sendDirectMessage(discordUsername, message);
    } catch (error) {
      console.error('Error in sendBookingNotification:', error.message);
      return false;
    }
  }
}

module.exports = new DiscordBot(); 