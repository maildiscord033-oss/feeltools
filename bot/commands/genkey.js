const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createKey } = require('../../modules/db');

const TOOLS = [
    { name: 'Webhook Sender', value: 'webhook', emoji: '📨' },
    { name: 'Embed Builder', value: 'embed', emoji: '🎨' },
    { name: 'Webhook Spammer', value: 'spam', emoji: '💣' },
    { name: 'Profile Changer', value: 'profile', emoji: '👤' },
    { name: 'Multi Webhooks', value: 'multi', emoji: '📡' },
    { name: 'Scheduler', value: 'scheduler', emoji: '⏰' },
    { name: 'Message Deleter', value: 'deleter', emoji: '🗑️' },
    { name: 'Server Cloner', value: 'server-cloner', emoji: '📋' },
    { name: 'Server Booster', value: 'booster', emoji: '🚀' },
    { name: 'Nitro Generator', value: 'nitro-gen', emoji: '🎁' },
    { name: 'Nitro Pro Generator', value: 'nitro-pro', emoji: '💎' },
    { name: 'Nitro 3-Month Promo', value: 'nitro-promo', emoji: '👑' },
    { name: 'Token Login', value: 'token-login', emoji: '🔐' },
    { name: 'Bot Token Login', value: 'bot-login', emoji: '🤖' },
    { name: 'Username Sniper', value: 'username-sniper', emoji: '🎯' },
    { name: 'All Tools', value: 'all', emoji: '⭐' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('genkey')
        .setDescription('Generate a new activation key with tools')
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Key duration')
                .setRequired(true)
                .addChoices(
                    { name: '1 Day', value: 'day' },
                    { name: '1 Week', value: 'week' },
                    { name: '1 Month', value: 'month' },
                    { name: 'Permanent', value: 'permanent' }
                ))
        .addIntegerOption(option =>
            option.setName('devices')
                .setDescription('Max devices allowed')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10))
        .addStringOption(option =>
            option.setName('client')
                .setDescription('Client name')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('tools')
                .setDescription('Tools to grant (comma separated. Use "all" for everything)')
                .setRequired(false)
                .setAutocomplete(true)),
    
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        const choices = TOOLS.map(t => ({ name: `${t.emoji} ${t.name}`, value: t.value }));
        const filtered = choices.filter(c => c.name.toLowerCase().includes(focused.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25));
    },
    
    async execute(interaction) {
        const duration = interaction.options.getString('duration');
        const maxDevices = interaction.options.getInteger('devices') || 1;
        const clientName = interaction.options.getString('client') || 'Unknown';
        const toolsInput = interaction.options.getString('tools') || 'all';
        
        let grantedTools;
        if (toolsInput === 'all') {
            grantedTools = TOOLS.map(t => t.value);
        } else {
            grantedTools = toolsInput.split(',').map(t => t.trim().toLowerCase());
        }
        
        const key = createKey(duration, maxDevices, clientName, grantedTools);
        
        const toolsList = grantedTools === 'all' ? 'All Tools ⭐' : 
            grantedTools.map(t => TOOLS.find(tool => tool.value === t)?.emoji + ' ' + (TOOLS.find(tool => tool.value === t)?.name || t)).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('🔑 Key Generated')
            .setColor('#ff0000')
            .addFields(
                { name: '🔑 Key', value: `\`${key.code}\``, inline: false },
                { name: '⏰ Duration', value: duration, inline: true },
                { name: '💻 Max Devices', value: `${maxDevices}`, inline: true },
                { name: '👤 Client', value: clientName, inline: true },
                { name: '📅 Expires', value: key.expiresAt === 'never' ? 'Never' : `<t:${Math.floor(new Date(key.expiresAt).getTime() / 1000)}:R>`, inline: true },
                { name: '🛠️ Tools Granted', value: toolsList.substring(0, 1024), inline: false }
            )
            .setFooter({ text: 'FEEL STORE - Key System' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};