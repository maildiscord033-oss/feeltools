const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { resetKey } = require('../../modules/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetkey')
        .setDescription('Reset key HWID (allows new device)')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('Key to reset (FEEL-XXXX-XXXX-XXXX)')
                .setRequired(true)),
    
    async execute(interaction) {
        const keyCode = interaction.options.getString('key').toUpperCase();
        resetKey(keyCode);
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 Key Reset')
            .setColor('#ff0000')
            .setDescription(`Key \`${keyCode}\` HWID has been reset.\nNow available for a new device.`)
            .setFooter({ text: 'FEEL STORE - Key System' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};