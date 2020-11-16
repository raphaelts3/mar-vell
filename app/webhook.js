const crypto = require("crypto");
const axios = require("axios");
const tmi = require("tmi.js");

const duplicatedMessageCheck = {};
/**{
 channel: string,
 joined: bool
}
 */
const channelsSubscribed = {};
var clientAuthToken = null;

// Chat client, created on sucessfull 'getClientAuthToken' call
var tmi_client = null;

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
    .catch(function (error) {
      console.error(error.response.data);
    });
}

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
        }
      });
    })
    .catch(function (error) {
      console.error(error.response.data);
    });
}

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
    tmi_client = _client;
    console.log(`Connected to chat ${addr}:${port}`);
  });
}

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

      // Get channels subscribeds
      getChannelsSubscribed();

      connectChat();
    })
    .catch(function (error) {
      console.error(error.response.data);
    });
}

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
        const _data = response.data.data[0];
        if (_data.broadcaster_name !== undefined) {
          resolve(_data.broadcaster_name);
        }
        resolve(null);
      })
      .catch(function (error) {
        resolve(null);
      });
  });
}

function broadcastBan(event) {
  Object.keys(channelsSubscribed).forEach(async (user_id) => {
    if (user_id === event.broadcaster_user_id) {
      return;
    }
    const _data = channelsSubscribed[user_id];
    if (_data.channel === null) {
      console.warn(`${user_id} channel is null`);
      return;
    }
    if (_data.joined === false) {
      await tmi_client.join(_data.channel);
      _data.joined = true;
    }
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

module.exports = {
  subscribeToBans,
  setup: function (app) {
    // Set route to handle webhook callbacks
    app.post("/webhook/callback", function (req, res) {
      console.log(req.body);
      if (req.body.challenge !== undefined) {
        res.send(req.body.challenge);
        return;
      }
      if (validateSignature(req) === false) {
        res.status(400).send({});
        return;
      }
      if (req.body.event !== undefined) {
        broadcastBan(req.body.event);
      }
      res.send();
    });

    // Get new client auth when starting the app
    getClientAuthToken();
  },
};
