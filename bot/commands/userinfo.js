const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readJSON, KEYS_FILE } = require('../../modules/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get user info from key')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('Key (FEEL-XXXX-XXXX-XXXX)')
                .setRequired(true)),
    
    async execute(interaction) {
        const keyCode = interaction.options.getString('key').toUpperCase();
        const keys = readJSON(KEYS_FILE);
        const key = keys.find(k => k.code === keyCode);
        
        if (!key) {
            return interaction.reply({ content: '❌ Key not found!', ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('👤 User Information')
            .setColor('#ff0000')
            .addFields(
                { name: '🔑 Key', value: `\`${key.code}\``, inline: false },
                { name: '👤 Client', value: key.clientName || 'Unknown', inline: true },
                { name: '📅 Created', value: new Date(key.createdAt).toLocaleDateString(), inline: true },
                { name: '⏰ Expires', value: key.expiresAt === 'never' ? 'Never' : new Date(key.expiresAt).toLocaleDateString(), inline: true },
                { name: '💻 Devices', value: `${key.hwids.length}/${key.maxDevices}`, inline: true },
                { name: '✅ Active', value: key.active ? 'Yes' : 'No', inline: true },
                { name: '🔒 HWIDs', value: key.hwids.length > 0 ? key.hwids.map(h => `\`${h.substring(0, 16)}...\``).join('\n') : 'None', inline: false }
            )
            .setFooter({ text: 'FEEL STORE - User Info' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};