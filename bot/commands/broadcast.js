const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('Send announcement to all website users')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Announcement message')
                .setRequired(true)),
    
    async execute(interaction) {
        const message = interaction.options.getString('message');
        
        // Get io from app
        const io = interaction.client.io;
        if (io) {
            io.emit('broadcast', { 
                message, 
                timestamp: new Date().toISOString(),
                from: interaction.user.username
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📢 Broadcast Sent')
            .setColor('#ff0000')
            .setDescription(message)
            .addFields(
                { name: '👤 From', value: interaction.user.username, inline: true },
                { name: '📅 Time', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'FEEL STORE - Broadcast' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};