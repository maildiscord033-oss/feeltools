const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getStats } = require('../../modules/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View system statistics'),
    
    async execute(interaction) {
        const stats = getStats();
        
        const embed = new EmbedBuilder()
            .setTitle('📊 FEEL STORE Statistics')
            .setColor('#ff0000')
            .addFields(
                { name: '🔑 Total Keys', value: `${stats.totalKeys}`, inline: true },
                { name: '✅ Active Keys', value: `${stats.activeKeys}`, inline: true },
                { name: '⏰ Expired Keys', value: `${stats.expiredKeys}`, inline: true },
                { name: '💻 Total Devices', value: `${stats.totalDevices}`, inline: true },
                { name: '🚫 Blacklisted', value: `${stats.blacklisted}`, inline: true },
                { name: '⏱️ Uptime', value: `${Math.floor(process.uptime())}s`, inline: true }
            )
            .setFooter({ text: 'FEEL STORE - Statistics' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};