const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readJSON, KEYS_FILE } = require('../../modules/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listkeys')
        .setDescription('List all activation keys'),
    
    async execute(interaction) {
        const keys = readJSON(KEYS_FILE);
        
        if (keys.length === 0) {
            return interaction.reply({ content: '❌ No keys found!', ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🔑 All Activation Keys')
            .setColor('#ff0000')
            .setFooter({ text: `Total: ${keys.length} keys | FEEL STORE` })
            .setTimestamp();
        
        keys.slice(0, 25).forEach(key => {
            embed.addFields({
                name: key.code,
                value: `👤 ${key.clientName || 'Unknown'}\n✅ ${key.active ? 'Active' : 'Inactive'}\n💻 ${key.hwids.length}/${key.maxDevices}\n📅 ${key.expiresAt === 'never' ? 'Never' : new Date(key.expiresAt).toLocaleDateString()}`,
                inline: true
            });
        });
        
        if (keys.length > 25) {
            embed.setFooter({ text: `Showing 25 of ${keys.length} keys | FEEL STORE` });
        }
        
        await interaction.reply({ embeds: [embed] });
    }
};