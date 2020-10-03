const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');

const app = express().use(bodyParser.json());

const PORT = process.env.PORT || 1337;
app.listen(PORT, () => console.log(`webhook is listening on port ${PORT}`));

const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
console.log(`VERIFY TOKEN = ${VERIFY_TOKEN}`);

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
        });

        // returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
});

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

async function query_user(api_token) {
    const [date_from, date_to] = date_range_now();

    const auth = {
        'bearer': api_token,
    };

    const url = 'https://api.wanikani.com/v2/';
    const endpoint = 'assignments';
    const query_params = `?available_after=${date_from.toISOString()}&available_before=${date_to.toISOString()}&in_review=true`;
    const full_url = url + endpoint + query_params;

    console.log(`Querying ${full_url} ...`);

    // console.log(`date_from = ${date_from}; date_to = ${date_to}`);
    // console.log(`https://api.wanikani.com/v2/assignments?`);

    request.get(full_url, { auth }, function (error, response, body) {
        console.error('error:', error);
        console.log('statusCode:', response && response.statusCode);

        const info = JSON.parse(body);
        console.log(info.data.length);
    });
}

async function main() {
    query_user('535d5e08-12e9-450b-98e1-152ab2685e8c');
}

main()