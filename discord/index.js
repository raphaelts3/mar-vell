require("dotenv").config();
const token = require("../common/token");
const Discord = require("discord.js");
const bot = new Discord.Client();

const prefix = "!";

bot.on("ready", () => {
  // When the bot is ready
  console.log("Bot Ready!");
});

const generateToken = (channel, member) => {
  // User must have the role "MarVellHelper"
  if (!member.roles.cache.some((role) => role.name === "MarVellHelper")) {
    channel.send(
      `<@${member.user.id}> here you go https://bit.ly/35Crtkf`
    );
    return;
  }
  // Return message with token
  const _token = token.generate();
  channel.send(
    `<@${member.user.id}> here you go ${process.env.BASE_URI}/auth/twitch/${_token}`
  );
};

// Handler for messages
bot.on("message", (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  // Split command and arguments
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command == "generate-tokex") {
    return generateToken(message.channel, message.member);
  }
});

bot.login(process.env.DISCORD_BOT_TOKEN); // Login bot
