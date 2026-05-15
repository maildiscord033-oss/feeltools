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
client.prefixCommands = new Collection();

// Load Slash commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsPath, file));
            if (command && command.data) {
                client.commands.set(command.data.name, command);
                console.log(`[Bot] Slash: ${command.data.name}`);
            }
            if (command && command.name && command.run) {
                client.prefixCommands.set(command.name, command);
                console.log(`[Bot] Prefix: ${command.name}`);
            }
        } catch (err) {
            console.log(`[Bot] Failed: ${file}: ${err.message}`);
        }
    }
}

client.once('ready', () => {
    console.log(`[Bot] ${client.user.tag} online! | ${client.guilds.cache.size} servers`);
    client.user.setPresence({ activities: [{ name: 'Feel Store', type: 1, url: 'https://twitch.tv/feelstore' }], status: 'online' });
});

// Slash Commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    const ownerId = process.env.OWNER_ID;
    if (ownerId && interaction.user.id !== ownerId) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (adminRoleId && (!member || !member.roles.cache.has(adminRoleId))) {
            return interaction.reply({ content: '❌ No permission!', ephemeral: true });
        }
    }
    
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[Bot Error] ${interaction.commandName}: ${error.message}`);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error!', ephemeral: true }).catch(() => {});
        }
    }
});

// Prefix Commands (!)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith('!')) return;
    
    const args = message.content.slice(1).trim().split(/ +/);
    const cmdName = args.shift()?.toLowerCase();
    
    const cmd = client.prefixCommands.get(cmdName);
    if (!cmd) return;
    
    const owners = (process.env.OWNER_ID || "").split(",").filter(Boolean);
    const isOwner = owners.some(o => String(o).trim() === String(message.author.id).trim());
    
    if (cmd.owner && !isOwner) {
        return message.reply("❌ Owner only!").catch(() => {});
    }
    
    try {
        await cmd.run(client, message, args);
    } catch(e) {
        console.error(`[Prefix Error] ${cmdName}: ${e.message}`);
        message.reply("❌ Error!").catch(() => {});
    }
});

async function startBot(ioInstance) {
    if (ioInstance) {
        client.io = ioInstance;
        console.log('[Bot] Connected to WebSocket');
    }
    
    const token = process.env.DISCORD_TOKEN;
    
    if (!token) {
        console.log('[Bot] ⚠️ No DISCORD_TOKEN');
        return;
    }
    
    try {
        console.log('[Bot] Logging in...');
        await client.login(token);
    } catch (err) {
        console.log(`[Bot] ❌ Login failed: ${err.message}`);
    }
}

module.exports = { startBot, client };
