const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

client.once('ready', () => {
    console.log(`[Bot] ${client.user.tag} is online!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    const ownerId = process.env.OWNER_ID;
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    
    if (interaction.user.id !== ownerId) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        if (adminRoleId && (!member || !member.roles.cache.has(adminRoleId))) {
            return interaction.reply({ content: '❌ No permission!', ephemeral: true });
        }
    }
    
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[Bot Error] ${error}`);
        await interaction.reply({ content: '❌ Error executing command!', ephemeral: true }).catch(() => {});
    }
});

async function startBot() {
    const token = process.env.DISCORD_TOKEN;
    if (!token || token === 'your_bot_token_here') {
        console.log('[Bot] No token set. Bot will not start.');
        console.log('[Bot] Edit .env file and add DISCORD_TOKEN=your_token');
        return;
    }
    
    try {
        await client.login(token);
    } catch (err) {
        console.log(`[Bot] Login failed: ${err.message}`);
    }
}

module.exports = { startBot, client };