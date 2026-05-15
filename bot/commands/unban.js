module.exports = {
    name: "unban",
    owner: true,
    run: async (client, message, args) => {
        const key = args[0];
        if (!key) return message.reply("❌ اكتب المفتاح!");
        
        const unbanLink = `${process.env.BASE_URL || 'https://feel.up.railway.app/'}?unban=${key.toUpperCase()}`;
        
        const { MessageEmbed } = require("discord.js");
        const embed = new MessageEmbed()
            .setTitle('🔓 رابط فك الحظر')
            .setColor('#00ff00')
            .setDescription(`رابط فك الحظر للعميل:\n${unbanLink}\n\nعلى العميل فتح هذا الرابط لفك الحظر عن جهازه.`)
            .setFooter('FEEL STORE');
        
        await message.reply({ embeds: [embed] });
    }
};
