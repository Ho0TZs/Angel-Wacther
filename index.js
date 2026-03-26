require('dotenv').config();
const fs = require('fs');
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Load config
const config = require('./config.json');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// 🌐 Keep alive for Render
const app = express();
app.get('/', (req, res) => res.send('GOD MODE ACTIVE'));
app.listen(process.env.PORT || 3000, () => console.log('Web server running'));

// 📀 Database
let db = { users: {}, tempBans: [], joins: [] };
try { db = JSON.parse(fs.readFileSync('./database.json')); } catch {}

// Save database
function saveDB() { fs.writeFileSync('./database.json', JSON.stringify(db, null, 2)); }

// 🎨 Embed helper
function createEmbed(title, description, color = "#5865F2", guild) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setThumbnail(guild?.iconURL())
        .setTimestamp()
        .setFooter({ text: "GOD MODE v2 • Protection System" });
}

// 📜 Rules
const rules = {
    1: "Don’t spam",
    2: "Don’t be toxic or rude",
    3: "No harassment or threats",
    4: "No advertising other games or servers",
    5: "No inappropriate language",
    6: "Listen to moderators and admins",
    7: "No impersonating staff",
    8: "Don’t harass other players",
    9: "No hacking, cheating, or exploiting",
    10: "Don’t glitch or escape the map",
    11: "Don’t be toxic",
    12: "Don’t be mean",
    13: "Play fair and respect all players",
    14: "Report bugs instead of abusing them"
};

// 🔑 Role helpers
function hasRole(member, role) {
    return member.roles.cache.some(r => r.name === role);
}
const isTrial = m => hasRole(m, config.modRoles.trial);
const isMod = m => hasRole(m, config.modRoles.mod);
const isHead = m => hasRole(m, config.modRoles.head);

// ⚠️ Add warning
function addWarning(member, reason) {
    if (!db.users[member.id]) db.users[member.id] = { warnings: 0, msgs: [] };
    db.users[member.id].warnings++;
    const count = db.users[member.id].warnings;
    saveDB();

    const log = member.guild.channels.cache.find(c => c.name === config.logChannel);
    const embed = createEmbed(
        "⚠️ Warning",
        `👤 ${member.user.tag}\n📄 ${reason}\n🔢 Warnings: ${count}`,
        "Red",
        member.guild
    );
    if (log) log.send({ embeds: [embed] });

    if (count >= config.maxWarnings) {
        member.timeout(10 * 60 * 1000).catch(() => {});
    }
}

// 🔒 Lock / Unlock server
function lockServer(guild) {
    guild.channels.cache.forEach(c => {
        c.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {});
    });
}
function unlockServer(guild) {
    guild.channels.cache.forEach(c => {
        c.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }).catch(() => {});
    });
}

// 🚨 On member join
client.on('guildMemberAdd', member => {
    db.joins.push(Date.now());
    db.joins = db.joins.filter(t => Date.now() - t < 10000);

    const welcome = member.guild.channels.cache.find(c => c.name === config.welcomeChannel);
    if (welcome) {
        welcome.send({ embeds: [createEmbed("👋 Welcome!", `Welcome ${member}!\nUse \`!rules\` to view rules.`, "Green", member.guild)] });
    }

    if (db.joins.length >= 6) lockServer(member.guild);
    saveDB();
});

// 💬 Message handler
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    console.log("Message received:", message.content); // Debug log

    const raw = message.content;
    const content = raw.toLowerCase();

    if (!db.users[message.author.id]) db.users[message.author.id] = { warnings: 0, msgs: [] };

    // Spam detection
    const msgs = db.users[message.author.id].msgs;
    msgs.push(Date.now());
    db.users[message.author.id].msgs = msgs.filter(t => Date.now() - t < 4000);

    if (db.users[message.author.id].msgs.length >= 6) {
        await message.delete().catch(() => {});
        addWarning(message.member, "Rule 1: Don’t spam");
        return message.channel.send({ embeds: [createEmbed("📜 Rule Violation", `🚫 ${message.author}\nYou broke **Rule 1: Don’t spam**`, "Red", message.guild)] });
    }

    // Bad words
    if (config.badWords.some(w => content.includes(w))) {
        await message.delete().catch(() => {});
        addWarning(message.member, "Rule 2: Toxic language");
        return message.channel.send({ embeds: [createEmbed("📜 Rule Violation", `🚫 ${message.author}\nYou broke **Rule 2: Don’t be toxic or rude**`, "Red", message.guild)] });
    }

    // Advertising
    if ((content.includes("discord.gg") || content.includes("http")) && !isMod(message.member)) {
        await message.delete().catch(() => {});
        addWarning(message.member, "Rule 4: Advertising");
        return message.channel.send({ embeds: [createEmbed("📜 Rule Violation", `🚫 ${message.author}\nYou broke **Rule 4: No advertising**`, "Red", message.guild)] });
    }

    // Command handling
    if (!raw.startsWith(config.prefix)) return;

    const args = raw.slice(config.prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // Single rule
    if (cmd.startsWith("r")) {
        const num = parseInt(cmd.replace("r", ""));
        if (!rules[num]) return;
        return message.channel.send({ embeds: [createEmbed(`📜 Rule #${num}`, rules[num], "#00BFFF", message.guild)] });
    }

    // All rules
    if (cmd === "rules") {
        const text = Object.entries(rules).map(([n, t]) => `**${n}.** ${t}`).join("\n");
        return message.channel.send({ embeds: [createEmbed("📜 Server Rules", text, "Purple", message.guild)] });
    }

    // Respect
    if (cmd === "respect") {
        return message.channel.send({ embeds: [createEmbed("🤝 Respect Notice", `Just because it's not in the rules doesn’t mean you can do it.\n\nIf something isn't listed, it's because we expect you to understand what is right and wrong.\n\n⚠️ Use common sense and respect everyone.`, "Orange", message.guild)] });
    }

    // Purge
    if (cmd === "purge" && isMod(message.member)) {
        const amount = parseInt(args[0]);
        if (!amount) return;
        await message.channel.bulkDelete(amount);
        return message.channel.send({ embeds: [createEmbed("🧹 Purged", `Deleted ${amount} messages`, "Grey", message.guild)] });
    }

    // Warn
    if (cmd === "warn" && isTrial(message.member)) {
        const user = message.mentions.members.first();
        if (!user) return;
        addWarning(user, "Manual warning");
        return message.channel.send({ embeds: [createEmbed("⚠️ Warned", `${user.user.tag}`, "Red", message.guild)] });
    }

    // Mute
    if (cmd === "mute" && isMod(message.member)) {
        const user = message.mentions.members.first();
        if (!user) return;
        await user.timeout(600000);
        return message.channel.send({ embeds: [createEmbed("🔇 Muted", `${user.user.tag}`, "DarkOrange", message.guild)] });
    }

    // Kick
    if (cmd === "kick" && isMod(message.member)) {
        const user = message.mentions.members.first();
        if (!user) return;
        await user.kick();
        return message.channel.send({ embeds: [createEmbed("👢 Kicked", `${user.user.tag}`, "DarkRed", message.guild)] });
    }

    // Ban
    if (cmd === "ban" && isHead(message.member)) {
        const user = message.mentions.members.first();
        if (!user) return;
        await user.ban();
        return message.channel.send({ embeds: [createEmbed("🔨 Banned", `${user.user.tag}`, "Red", message.guild)] });
    }

    // Lock / Unlock
    if (cmd === "lockdown" && isHead(message.member)) {
        lockServer(message.guild);
        return message.channel.send({ embeds: [createEmbed("🔒 Server Locked", "All channels locked", "Red", message.guild)] });
    }
    if (cmd === "unlock" && isHead(message.member)) {
        unlockServer(message.guild);
        return message.channel.send({ embeds: [createEmbed("🔓 Server Unlocked", "All channels unlocked", "Green", message.guild)] });
    }
});

// ⏳ Auto unban
setInterval(async () => {
    const now = Date.now();
    for (const ban of db.tempBans) {
        if (now >= ban.expires) {
            const guild = client.guilds.cache.get(ban.guild);
            if (!guild) continue;
            await guild.members.unban(ban.user).catch(() => {});
        }
    }
    db.tempBans = db.tempBans.filter(b => now < b.expires);
    saveDB();
}, 60000);

// 🚀 Ready
client.once('ready', () => {
    console.log(`😈 GOD MODE ONLINE: ${client.user.tag}`);
});

// Login
client.login(process.env.TOKEN);