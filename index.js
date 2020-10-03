const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');
const rp = require('request-promise');

const app = express().use(bodyParser.json());

const PORT = process.env.PORT || 1337;
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN;

app.listen(PORT, () => console.log(`webhook is listening on port ${PORT}`));

// healthcheck
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// simple test API
app.get('/test-wk-query', async (req, res) => {
    const token = req && req.query && req.query.token;

    try {
        const review_count = await query_reviews(token);
        const msg = `New reviews in this hour: ${review_count}`;
        res.status(200).send(msg);
    }
    catch (e) {
        console.log(e);
        res.status(400).send(e.toString());
    }
});

// messenger verification webhook
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

// messenger data webhook
app.post('/webhook', async (req, res) => {
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
            }
        });

        // returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
});

// handles message events
async function handleMessage(sender_psid, received_message) {
    // check if the message contains text
    if (!received_message.text) {
        callSendAPI(sender_psid, 'Sorry, I can only process simple text messages.');
    }

    // query WaniKani API
    try {
        const token = received_message.text;
        const review_count = await query_reviews(token);
        callSendAPI(sender_psid, `New reviews in this hour: ${review_count}`);
    }
    catch (e) {
        console.log(e);
        callSendAPI(sender_psid, e.toString());
    }
}

function callSendAPI(sender_psid, response) {
    // construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": {
            text: response,
        }
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

    let to = new Date(from.getTime());
    to.setMinutes(59);

    return [from, to];
}

async function query_reviews(wk_api_token) {
    // validate token
    if (!wk_api_token) {
        throw new Error('No token provided');
    }

    if (!wk_api_token.match(/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/)) {
        throw new Error('That does not look like a valid WaniKani secret API token (v2)');
    }

    // compose query
    const [date_from, date_to] = date_range_now();

    var options = {
        method: 'GET',
        uri: 'https://api.wanikani.com/v2/assignments',
        auth: { bearer: wk_api_token, },
        qs: {
            available_after: date_from.toISOString(),
            available_before: date_to.toISOString(),
            in_review: true,
        },
        json: true,
    };

    try {
        // query API
        const info = await rp(options);

        // check response format
        if (!info || !info.data) {
            const error = `Unexpected response format! Got: ${info}`;
            console.err(error);
            throw new Error(error);
        }

        return info.data.length;
    }
    catch (e) {
        // wrong token
        if (e.statusCode == 401) {
            throw new Error('Unable to connect to WaniKani API: Unauthorized');
        }

        // other error
        const error = `Unexpected error: ${e.message}`;
        console.err(error);
        throw new Error(error);
    }
}
