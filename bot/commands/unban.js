const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('فك حظر مستخدم')
        .addStringOption(o => o.setName('key').setDescription('مفتاح العميل').setRequired(true)),
    
    async execute(interaction) {
        const key = interaction.options.getString('key').toUpperCase();
        
        // إرسال رسالة للعميل أن الباند انفك
        // أو إرسال رابط فك الباند
        const unbanLink = `${process.env.BASE_URL || 'http://localhost:3000'}?unban=${key}`;
        
        const embed = new EmbedBuilder()
            .setTitle('🔓 رابط فك الحظر')
            .setColor('#00ff00')
            .setDescription(`رابط فك الحظر للعميل:\n${unbanLink}\n\nعلى العميل فتح هذا الرابط لفك الحظر عن جهازه.`)
            .setFooter({ text: 'FEEL STORE' });
        
        await interaction.reply({ embeds: [embed] });
    }
};
