const crypto = require("crypto");
const axios = require("axios");
const tmi = require("tmi.js");

const duplicatedMessageCheck = {};
/**{
 channel: string,
 joined: bool     => Show if we already joined in this channel chat
}
 */
const channelsSubscribed = {};
var clientAuthToken = null;

// Chat client, created on sucessfull 'getClientAuthToken' call
var tmi_client = null;

// TODO: Log it in a external place
const logRequestError = (error) => console.error(error.response.data);

// Function that can be used if we need to remove webhooks,
// good when subscribing just for test
function deleteSubscription(id) {
  const options = {
    url: "https://api.twitch.tv/helix/eventsub/subscriptions",
    method: "DELETE",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${clientAuthToken}`,
    },
    params: {
      id,
    },
  };

  axios(options)
    .then(function (response) {
      console.log(response.data);
    })
    .catch(logRequestError);
}

// Function to get all channels that the bot have already
// subscribed to fullfill the list os channels to broadcast.
function getChannelsSubscribed() {
  const options = {
    url: "https://api.twitch.tv/helix/eventsub/subscriptions",
    method: "GET",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${clientAuthToken}`,
    },
    params: {
      status: "enabled",
    },
  };

  axios(options)
    .then(function (response) {
      response.data.data.forEach(async function (value) {
        if (
          value.condition !== undefined &&
          value.condition.broadcaster_user_id !== undefined
        ) {
          const broadcaster_id = value.condition.broadcaster_user_id;
          channelsSubscribed[broadcaster_id] = {
            channel: await getChannelInformation(broadcaster_id),
            joined: false,
          };
          // TODO: Cache this information, so we don't have to call it everytime
        }
      });
    })
    .catch(logRequestError);
}

// Just connect to twitch chat with marvellbot account
function connectChat() {
  const _client = new tmi.client({
    identity: {
      username: process.env.TWITCH_USERNAME,
      password: process.env.TWITCH_PASSWORD,
    },
  });
  // Connect to client
  _client.connect().catch(console.error);
  _client.on("connected", function (addr, port) {
    // Save client to be used in other places
    tmi_client = _client;
    console.log(`Connected to chat ${addr}:${port}`);
  });
}

// Request the client_credentials to use in few requests
function getClientAuthToken() {
  const options = {
    url: "https://id.twitch.tv/oauth2/token",
    method: "POST",
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    },
  };

  axios(options)
    .then(function (response) {
      // Save client Auth Token
      clientAuthToken = response.data.access_token;
      // TODO: This can be cached or better handled
      // instead of autheticating every load

      // Get channels subscribeds to have a list of
      // channels to broadcast
      getChannelsSubscribed();

      // Connect to chat to broadcast the commands
      connectChat();
    })
    .catch(logRequestError);
}

// Function to get the channel name to connect on its chat
async function getChannelInformation(broadcaster_id) {
  return new Promise((resolve, reject) => {
    const options = {
      url: "https://api.twitch.tv/helix/channels",
      method: "GET",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${clientAuthToken}`,
      },
      params: {
        broadcaster_id,
      },
    };

    axios(options)
      .then(function (response) {
        // TODO: Return all the broadcaster names associated, instead of only the first
        resolve(response.data.data[0].broadcaster_name);
      })
      .catch(function (error) {
        logRequestError(error);
        resolve(null);
      });
  });
}

// Process a 'channel.ban' webhook received
function processBan(event) {
  // Loop through all the channels that are also using
  // Mar-Vell Bot and try to ban the user on them as well
  Object.keys(channelsSubscribed).forEach(async (user_id) => {
    // We don't need to replicate the ban on the channel that banned it
    if (user_id === event.broadcaster_user_id) {
      return;
    }
    const _data = channelsSubscribed[user_id];
    if (_data.channel === null) {
      // Something went wrong at `getChannelInformation` and we don't
      // have this user channel
      // TODO: try to get the channel information again and replicate the ban
      console.warn(`${user_id} channel is null`);
      return;
    }
    // Check if we've already connected to this user chat
    if (_data.joined === false) {
      // If not, request the join
      await tmi_client.join(_data.channel);
      _data.joined = true;
    }
    // It should be joined here, and we can propagate the ban to it
    tmi_client
      .ban(
        _data.channel,
        event.user_name,
        `Mar-Vell Bot #${event.broadcaster_user_name}`
      )
      .then(() => {
        console.log(`Ban ${event.user_name} broadcasted to ${channel}`);
      })
      .catch((err) => {
        // Probably already banned, just ignore
        console.error(err);
      });
  });
}

// This function implements "Verify a signature" procedure from
// https://dev.twitch.tv/docs/eventsub#verify-a-signature
function validateSignature(req) {
  const messageId = req.headers["twitch-eventsub-message-id"];
  // Check if it already received this message
  if (duplicatedMessageCheck[messageId] !== undefined) {
    return true;
  }
  const messageTimestamp = req.headers["twitch-eventsub-message-timestamp"];
  const message = messageId + messageTimestamp + req.rawBody;
  const hash = crypto
    .createHmac("sha256", process.env.WEBHOOK_SECRET)
    .update(message)
    .digest("hex");
  if (req.headers["twitch-eventsub-message-signature"] !== `sha256=${hash}`) {
    return false;
  }
  const lowerLimitTimestamp = new Date(
    new Date().getTime() - 1000 * 60 * 10
  ).toISOString();
  const higherLimitTimestamp = new Date(
    new Date().getTime() + 1000 * 60
  ).toISOString();
  if (
    messageTimestamp < lowerLimitTimestamp ||
    messageTimestamp > higherLimitTimestamp
  ) {
    return false;
  }
  return true;
}

async function subscribeToBans(user) {
  return new Promise((resolve, reject) => {
    // Already subscribed
    if (channelsSubscribed[user.data[0].id] !== undefined) {
      resolve();
      return;
    }
    const options = {
      url: "https://api.twitch.tv/helix/eventsub/subscriptions",
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${clientAuthToken}`,
      },
      data: {
        type: "channel.ban",
        version: "1",
        condition: {
          broadcaster_user_id: user.data[0].id,
        },
        transport: {
          method: "webhook",
          callback: `${process.env.BASE_URI}/webhook/callback`,
          secret: process.env.WEBHOOK_SECRET,
        },
      },
    };
    axios(options)
      .then(async function (response) {
        console.log(response.data);
        channelsSubscribed[user.data[0].id] = {
          channel: await getChannelInformation(user.data[0].id),
          joined: false,
        };
        resolve(response.body);
      })
      .catch(function (error) {
        reject(error.response.body);
      });
  });
}

async function subscribeToWebHooks() {
  const webhooks = [subscribeToBans()];
  return Promise.all(hooks);
}

// Function to properly setup the webhooks part on the application
function setup(app) {
  // Set route to handle webhook callbacks, this route will
  // be called everytime a registered hook is dispatched
  // on the associated accounts
  app.post("/webhook/callback", function (req, res) {
    // Twitch requires this challenge to validate the callback URL
    if (req.body.challenge !== undefined) {
      res.send(req.body.challenge);
      return;
    }
    // Validate the webhook signature
    if (validateSignature(req) === false) {
      res.status(400).send();
      return;
    }
    // Check if webhook is a ban
    if (req.body.signature.type === "channel.ban") {
      processBan(req.body.event).catch(console.error);
    }
    // Return 200 to confirm the receiving
    res.send({});
  });

  // Get new client auth when starting the app
  getClientAuthToken();
}

module.exports = {
  subscribeToWebHooks,
  setup,
};
