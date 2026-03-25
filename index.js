require('dotenv').config();
const fs = require('fs');
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    PermissionsBitField,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');

const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// 📀 DATABASE
let db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));

function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

// 🧠 RISK SYSTEM
function getRiskScore(content) {
    let score = 0;

    if (content.includes("http")) score += 2;
    if (content.includes("free")) score += 2;
    if (content.includes("nitro")) score += 3;
    if (content.includes("@everyone")) score += 3;
    if (content.length > 200) score += 1;

    return score;
}

// ⚠️ WARNING SYSTEM
async function addWarning(member, reason, guild) {
    if (!db.users[member.id]) db.users[member.id] = { warnings: 0 };

    db.users[member.id].warnings++;
    saveDB();

    const count = db.users[member.id].warnings;

    const embed = new EmbedBuilder()
        .setTitle("⚠️ Warning")
        .addFields(
            { name: "User", value: member.user.tag },
            { name: "Reason", value: reason },
            { name: "Warnings", value: count.toString() }
        )
        .setColor("Red");

    const log = guild.channels.cache.find(c => c.name === config.logChannel);
    if (log) log.send({ embeds: [embed] });

    if (count === 3) {
        await member.timeout(60 * 60 * 1000);
    }

    if (count >= 4) {
        await member.ban({ reason: "Too many warnings" });

        db.tempBans.push({
            user: member.id,
            guild: guild.id,
            expires: Date.now() + 86400000
        });

        saveDB();
    }
}

// 🔓 AUTO UNBAN LOOP
setInterval(async () => {
    const now = Date.now();

    for (let ban of db.tempBans) {
        if (now >= ban.expires) {
            const guild = client.guilds.cache.get(ban.guild);
            if (!guild) continue;

            await guild.members.unban(ban.user).catch(() => {});
        }
    }

    db.tempBans = db.tempBans.filter(b => now < b.expires);
    saveDB();
}, 60000);

// 🚨 ANTI RAID JOIN DETECTION
client.on('guildMemberAdd', member => {
    db.joins.push(Date.now());
    db.joins = db.joins.filter(t => Date.now() - t < 10000);

    if (db.joins.length >= 5) {
        const log = member.guild.channels.cache.find(c => c.name === config.logChannel);
        if (log) log.send("🚨 RAID DETECTED - LOCKDOWN RECOMMENDED");

        lockServer(member.guild);
    }
});

// 🔒 LOCK SERVER
async function lockServer(guild) {
    guild.channels.cache.forEach(channel => {
        if (channel.permissionsFor(guild.roles.everyone)) {
            channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: false
            });
        }
    });
}

// 💬 MESSAGE PROTECTION
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    const risk = getRiskScore(content);

    // 🚨 HIGH RISK MESSAGE
    if (risk >= 5) {
        await message.delete();
        return addWarning(message.member, "High risk scam behavior", message.guild);
    }

    // ⚡ SPAM DETECTION
    if (!db.users[message.author.id]) db.users[message.author.id] = { msgs: [] };

    const msgs = db.users[message.author.id].msgs || [];
    msgs.push(Date.now());

    db.users[message.author.id].msgs = msgs.filter(t => Date.now() - t < 5000);

    if (db.users[message.author.id].msgs.length >= 5) {
        await message.member.timeout(600000);
    }

    saveDB();
});

// 🚀 SLASH COMMANDS
client.once('ready', async () => {
    console.log(`😈 ULTRA BOT ACTIVE: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('lockdown').setDescription('Lock server'),
        new SlashCommandBuilder().setName('unlock').setDescription('Unlock server')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );
});

// ⚡ COMMAND HANDLER
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const member = interaction.member;
    const isHead = member.roles.cache.some(r => r.name === config.modRoles.head);

    if (interaction.commandName === 'lockdown') {
        if (!isHead) return interaction.reply({ content: "No permission", ephemeral: true });

        await lockServer(interaction.guild);
        interaction.reply("🔒 Server locked");
    }

    if (interaction.commandName === 'unlock') {
        if (!isHead) return interaction.reply({ content: "No permission", ephemeral: true });

        interaction.guild.channels.cache.forEach(channel => {
            channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: true
            });
        });

        interaction.reply("🔓 Server unlocked");
    }
});

client.login(process.env.TOKEN);