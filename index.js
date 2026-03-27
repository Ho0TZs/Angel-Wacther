// ===== START DEBUG =====
console.log("🚀 Bot is starting...");

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running ✅');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

require('dotenv').config();

if (!process.env.TOKEN) {
    console.log("❌ TOKEN NOT FOUND in .env file");
    process.exit(1);
}

const fs = require('fs');
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');

// ===== CREATE CLIENT =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ===== DATABASE =====
let db = { warnings: {} };
if (fs.existsSync('./db.json')) {
    db = JSON.parse(fs.readFileSync('./db.json'));
}
function saveDB() {
    fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

// ===== RULES =====
const rules = [
    "Don’t spam",
    "Don’t be toxic or rude",
    "No harassment or threats",
    "No advertising other games or servers",
    "No inappropriate language",
    "Listen to moderators and admins",
    "No impersonating staff",
    "Don’t harass other players",
    "No hacking, cheating, or exploiting",
    "Don’t glitch or escape the map",
    "Don’t be toxic",
    "Don’t be mean",
    "Play fair and respect all players",
    "Report bugs instead of abusing them"
];

// ===== READY =====
client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== WARNING SYSTEM =====
function warn(member, ruleNum, reason) {
    if (!db.warnings[member.id]) db.warnings[member.id] = 0;

    db.warnings[member.id]++;
    saveDB();

    const count = db.warnings[member.id];

    member.send({
        embeds: [
            new EmbedBuilder()
                .setColor("Orange")
                .setTitle("⚠️ Warning")
                .setDescription(`Rule ${ruleNum}: ${rules[ruleNum - 1]}\nReason: ${reason}\nWarnings: ${count}`)
        ]
    }).catch(() => {});

    if (count === 3) member.timeout(10 * 60 * 1000).catch(() => {});
    if (count === 5) member.kick().catch(() => {});
    if (count >= 7) member.ban().catch(() => {});
}

// ===== MESSAGE EVENT =====
client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;

    const msg = message.content.toLowerCase();
    const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

    // ===== !respect =====
    if (msg === "!respect") {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Blue")
                    .setDescription("{ Just because is not in the rules it doesn’t mean you can do it if we didn’t add that rule to the rule board is because we think your old enough to understand what is wrong and what is right }")
            ]
        });
    }

    // ===== RULE COMMANDS =====
    if (msg.startsWith("!r")) {
        const num = parseInt(msg.replace("!r", ""));
        if (!rules[num - 1]) return;

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Purple")
                    .setTitle(`📜 Rule ${num}`)
                    .setDescription(rules[num - 1])
            ]
        });
    }

    // ===== !leak =====
    if (msg.startsWith("!leak") && isStaff) {
        const channel = message.guild.channels.cache.find(c => c.name.includes("leaks"));
        if (!channel) return message.reply("❌ Create a channel named '👀┃leaks'");

        const text = message.content.slice(6);
        const embed = new EmbedBuilder()
            .setColor("DarkPurple")
            .setTitle("👀 Leak")
            .setDescription(text || "New leak!");

        if (message.attachments.first()) {
            embed.setImage(message.attachments.first().url);
        }

        channel.send({ embeds: [embed] });
        return message.delete().catch(() => {});
    }

    // ===== AUTO MOD =====

    // BAD WORDS
    const badWords = ["idiot", "stupid", "kill yourself"];
    if (badWords.some(w => msg.includes(w))) {
        await message.delete().catch(() => {});
        warn(message.member, 2, "Toxic language");

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor("Red")
                    .setDescription(`${message.author} broke Rule 2: ${rules[1]}`)
            ]
        });
    }

    // SPAM
    if (!message.member.lastMessageTime) message.member.lastMessageTime = 0;
    if (Date.now() - message.member.lastMessageTime < 1000) {
        await message.delete().catch(() => {});
        warn(message.member, 1, "Spam");
    }
    message.member.lastMessageTime = Date.now();

    // LINKS
    if (msg.includes("http") && !isStaff) {
        await message.delete().catch(() => {});
        warn(message.member, 4, "Advertising");
    }

    // HACK DETECTION
    if (msg.includes("free nitro") || msg.includes("discord.gift")) {
        await message.delete().catch(() => {});
        message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor("Red")
                    .setDescription(`🚨 ${message.author} might be hacked!`)
            ]
        });
    }
});

// ===== ERROR HANDLER =====
process.on('unhandledRejection', err => {
    console.error("❌ Unhandled Error:", err);
});

// ===== LOGIN =====
client.login(process.env.TOKEN)
    .then(() => console.log("🔐 Logging in..."))
    .catch(err => console.error("❌ Login failed:", err));