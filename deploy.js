require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.APPLICATION_ID;

if (!token || token === 'your_bot_token_here') {
    console.log('❌ No token found in .env file!');
    console.log('Edit .env and add: DISCORD_TOKEN=your_bot_token_here');
    process.exit(1);
}

if (!clientId) {
    console.log('❌ No APPLICATION_ID found in .env file!');
    console.log('Edit .env and add: APPLICATION_ID=your_bot_application_id');
    process.exit(1);
}

const commands = [];

// Load command files
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
    console.log('❌ commands folder not found!');
    process.exit(1);
}

const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

if (commandFiles.length === 0) {
    console.log('❌ No command files found!');
    process.exit(1);
}

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        if (command && command.data) {
            commands.push(command.data.toJSON());
            console.log(`  [+] Loaded: ${command.data.name}`);
        }
    } catch (err) {
        console.log(`  [-] Error loading ${file}: ${err.message}`);
    }
}

console.log(`\n[*] Deploying ${commands.length} commands...`);

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`[*] Client ID: ${clientId}`);
        
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        
        console.log(`\n✅ Successfully deployed ${data.length} commands!`);
        console.log('Commands list:');
        data.forEach(cmd => console.log(`  - /${cmd.name}`));
        
    } catch (error) {
        console.error('\n❌ Deployment failed!');
        console.error(`Error: ${error.message}`);
        
        if (error.message.includes('401')) {
            console.log('\n-- Troubleshooting --');
            console.log('1. Check DISCORD_TOKEN in .env');
            console.log('2. Check APPLICATION_ID in .env');
            console.log('3. Make sure bot has "applications.commands" scope');
        }
    }
})();