const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');

const app = express().use(bodyParser.json());

const PORT = process.env.PORT || 1337;
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN;

app.listen(PORT, () => console.log(`webhook is listening on port ${PORT}`));

// healthcheck
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// webhook verification
app.get('/webhook', (req, res) => {
    // parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // checks if a token and mode is in the query string of the request
    if (mode && token) {
        // checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            // responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

// webhook data
app.post('/webhook', (req, res) => {
    let body = req.body;

    // checks this is an event from a page subscription
    if (body.object === 'page') {
        // iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {
            // gets the message. entry.messaging is an array, but
            // will only ever contain one message, so we get index 0
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            // get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }
        });

        // returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
});

// handles message events
function handleMessage(sender_psid, received_message) {
    // check if the message contains text
    if (received_message.text) {
        // TODO: validate token
        query_user(received_message.text, function (num_reviews) {
            const response = {
                "text": `Number of new reviews in this hour: "${num_reviews}".`
            };

            // sends the response message
            callSendAPI(sender_psid, response);
        })
    }
}

// handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
    // TODO
}

function callSendAPI(sender_psid, response) {
    // construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }

    // send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}

function date_range_now() {
    let from = new Date();
    from.setMilliseconds(0);
    from.setSeconds(0);
    from.setMinutes(0);

    // from.setHours(from.getHours() + 9);

    let to = new Date(from.getTime());
    to.setMinutes(59);

    return [from, to];
}

async function query_user(api_token, callback) {
    const [date_from, date_to] = date_range_now();

    const auth = {
        'bearer': api_token,
    };

    const url = 'https://api.wanikani.com/v2/';
    const endpoint = 'assignments';
    const query_params = `?available_after=${date_from.toISOString()}&available_before=${date_to.toISOString()}&in_review=true`;
    const full_url = url + endpoint + query_params;

    console.log(`Querying ${full_url} ...`);

    request.get(full_url, { auth }, function (error, response, body) {
        if (error) {
            console.error('error:', error);
            callback(-1);
            return;
        }

        if (!response || response.statusCode != 200) {
            console.log('statusCode:', response && response.statusCode);
            callback(-1);
            return;
        }

        const info = JSON.parse(body);
        callback(info.data.length);
    });
}
