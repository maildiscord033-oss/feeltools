const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { removeKey } = require('../../modules/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removekey')
        .setDescription('Remove an activation key')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('Key to remove (FEEL-XXXX-XXXX-XXXX)')
                .setRequired(true)),
    
    async execute(interaction) {
        const keyCode = interaction.options.getString('key').toUpperCase();
        removeKey(keyCode);
        
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Key Removed')
            .setColor('#ff0000')
            .setDescription(`Key \`${keyCode}\` has been removed successfully.`)
            .setFooter({ text: 'FEEL STORE - Key System' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};