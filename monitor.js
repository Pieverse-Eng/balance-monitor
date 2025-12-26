const axios = require('axios');
const { Telegraf } = require('telegraf');
require('dotenv').config();

class BalanceMonitor {
  constructor() {
    this.apiUrl = 'https://facilitator.pieverse.io';
    this.previousBalances = {};
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.setupBot();
  }

  setupBot() {
    this.bot.start((ctx) => {
      ctx.reply('Balance Monitor Bot started!');
    });

    this.bot.command('status', async (ctx) => {
      const balances = await this.getCurrentBalances();
      ctx.reply(`Current balances:\n${JSON.stringify(balances, null, 2)}`);
    });
  }

  async getCurrentBalances() {
    try {
      const response = await axios.get(this.apiUrl);
      return response.data.facilitators;
    } catch (error) {
      console.error('Error fetching balances:', error.message);
      throw error;
    }
  }

  async checkAndAlert() {
    try {
      const balances = await this.getCurrentBalances();
      
      for (const [network, data] of Object.entries(balances)) {
        const currentBalance = data.balance;
        const previousBalance = this.previousBalances[network];
        
        if (previousBalance !== undefined && previousBalance !== currentBalance) {
          await this.sendAlert(network, previousBalance, currentBalance);
        }
        
        this.previousBalances[network] = currentBalance;
      }
      
      console.log('Balance check completed at', new Date().toISOString());
    } catch (error) {
      console.error('Error in balance check:', error.message);
    }
  }

  async sendAlert(network, oldBalance, newBalance) {
    const message = `🚨 Balance Change Alert\n\nNetwork: ${network}\nOld Balance: ${oldBalance}\nNew Balance: ${newBalance}\nTime: ${new Date().toISOString()}`;
    
    try {
      await this.bot.telegram.sendMessage(this.chatId, message);
      console.log(`Alert sent for ${network}`);
    } catch (error) {
      console.error('Error sending alert:', error.message);
    }
  }

  startMonitoring(intervalMinutes = 5) {
    console.log(`Starting balance monitoring (checking every ${intervalMinutes} minutes)`);
    
    this.checkAndAlert();
    setInterval(() => {
      this.checkAndAlert();
    }, intervalMinutes * 60 * 1000);

    this.bot.launch();
  }
}

const monitor = new BalanceMonitor();
monitor.startMonitoring(5);

process.on('SIGINT', () => {
  monitor.bot.stop();
  process.exit(0);
});