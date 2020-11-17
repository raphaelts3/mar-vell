require("dotenv").config();
const token = require("../common/token");
const Eris = require("eris");

const bot = new Eris.CommandClient(
  process.env.DISCORD_BOT_TOKEN,
  {},
  {
    description:
      "A bot to generate a link to authorize Mar-Vell bot in your channel.",
    owner: "raphaelts3",
    prefix: "!",
  }
);

bot.on("ready", () => {
  // When the bot is ready
  console.log("Bot Ready!"); // Log "Ready!"
});

const echoCommand = bot.registerCommand(
  "generate-token",
  (msg, args) => {
    // Make an echo command
    console.log(msg, args);
    // Check if user has "Porteiro" role at "Mar-Vell Bot Discord"
    if (!msg.member.roles.some((role) => role === "778319142281019412")) {
      return `<@${msg.member.user.id}> here you go https://bit.ly/35Crtkf`;
    }
    // Return message with token
    const _token = token.generate();
    return `<@${msg.member.user.id}> here you go ${process.env.BASE_URI}/auth/twitch/${_token}`;
  },
  {
    description: "Generate token for Mar-Vell Bot",
    fullDescription:
      "The bot will generate a link to authorize Mar-Vell bot in your channel.",
    usage: "",
  }
);

bot.connect(); // Get the bot to connect to Discord
