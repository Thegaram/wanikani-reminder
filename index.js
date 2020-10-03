const request = require('request');
const rp = require('request-promise');

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