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

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    
    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsPath, file));
            if (command && command.data) {
                client.commands.set(command.data.name, command);
                console.log(`[Bot] Loaded command: ${command.data.name}`);
            }
        } catch (err) {
            console.log(`[Bot] Failed to load ${file}: ${err.message}`);
        }
    }
}

client.once('ready', () => {
    console.log(`[Bot] ${client.user.tag} is online!`);
    console.log(`[Bot] Serving ${client.guilds.cache.size} servers`);

    client.user.setPresence({
        activities: [
            {
                name: 'Feel Store',
                type: 1, // Streaming
                url: 'https://twitch.tv/feelstore'
            }
        ],
        status: 'online'
    });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    const ownerId = process.env.OWNER_ID;
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    
    // Check permissions
    if (ownerId && interaction.user.id !== ownerId) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        if (adminRoleId && (!member || !member.roles.cache.has(adminRoleId))) {
            return interaction.reply({ 
                content: '❌ You do not have permission to use this command!', 
                ephemeral: true 
            });
        }
    }
    
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[Bot Error] ${interaction.commandName}: ${error.message}`);
        
        const reply = { 
            content: '❌ An error occurred while executing this command!', 
            ephemeral: true 
        };
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(reply).catch(() => {});
        }
    }
});

async function startBot(ioInstance) {
    // Store io instance for broadcast
    if (ioInstance) {
        client.io = ioInstance;
        console.log('[Bot] Connected to WebSocket for broadcasts');
    }
    
    const token = process.env.DISCORD_TOKEN;
    
    if (!token || token === 'MTUwNDA2MTI2NDAzMTM4Nzc0Mg.G8PAMS.71_BLkEDdgDnioB3UfS-qqZlxHNQ0k8OU5M6rQ') {
        console.log('[Bot] ⚠️ No DISCORD_TOKEN found in environment variables');
        console.log('[Bot] Add DISCORD_TOKEN to your Railway Variables');
        return;
    }
    
    try {
        console.log('[Bot] Logging in...');
        await client.login(token);
    } catch (err) {
        console.log(`[Bot] ❌ Login failed: ${err.message}`);
        
        if (err.message.includes('invalid')) {
            console.log('[Bot] The token is invalid. Check your DISCORD_TOKEN.');
        } else if (err.message.includes('401')) {
            console.log('[Bot] Unauthorized. Reset your bot token in Discord Developer Portal.');
        }
    }
}

module.exports = { startBot, client };
