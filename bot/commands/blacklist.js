const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { blacklist, readJSON, HWID_FILE } = require('../../modules/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage blacklisted HWIDs')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add HWID to blacklist')
                .addStringOption(option =>
                    option.setName('hwid')
                        .setDescription('HWID to blacklist')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove HWID from blacklist')
                .addStringOption(option =>
                    option.setName('hwid')
                        .setDescription('HWID to remove')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show all blacklisted HWIDs')),
    
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        
        if (sub === 'add') {
            const hwid = interaction.options.getString('hwid');
            blacklist(hwid);
            
            const embed = new EmbedBuilder()
                .setTitle('🚫 HWID Blacklisted')
                .setColor('#ff0000')
                .setDescription(`HWID added to blacklist.`)
                .addFields({ name: 'HWID', value: `\`${hwid.substring(0, 32)}...\`` })
                .setFooter({ text: 'FEEL STORE' });
            
            await interaction.reply({ embeds: [embed] });
        }
        
        if (sub === 'remove') {
            const hwid = interaction.options.getString('hwid');
            let hwids = readJSON(HWID_FILE);
            hwids = hwids.filter(h => h !== hwid);
            const { writeJSON } = require('../../modules/db');
            writeJSON(HWID_FILE, hwids);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ HWID Removed')
                .setColor('#00ff00')
                .setDescription('HWID removed from blacklist.')
                .setFooter({ text: 'FEEL STORE' });
            
            await interaction.reply({ embeds: [embed] });
        }
        
        if (sub === 'list') {
            const hwids = readJSON(HWID_FILE);
            
            if (hwids.length === 0) {
                return interaction.reply({ content: '✅ No blacklisted HWIDs.', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🚫 Blacklisted HWIDs')
                .setColor('#ff0000')
                .setDescription(hwids.map((h, i) => `${i+1}. \`${h.substring(0, 32)}...\``).join('\n'))
                .setFooter({ text: `Total: ${hwids.length} | FEEL STORE` });
            
            await interaction.reply({ embeds: [embed] });
        }
    }
};