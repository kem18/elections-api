
const https = require('https');
const RateLimiter = require('limiter').RateLimiter;
const limiter = new RateLimiter(25, 'second');

const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

const netvoteRequest = async (method, host, path, postObj, headers) => {
    let maxretries = 2;
    for (let count = 0; count < maxretries; count++) {
        try {
            let res = await netvoteUnsafeRequest(method, host, path, postObj, headers);
            if (res !== undefined) {
                return res;
            }
        } catch (e) {
            //squash, already logged
        }
        console.log("RETRY (sleep 1s): " + path)
        await snooze(1000)
    }
    throw new Error("failed to complete request: " + method)
}

const netvoteUnsafeRequest = (method, host, path, postObj, headers) => {
    return new Promise(async (resolve, reject) => {
        limiter.removeTokens(1, async () => {
            const postData = (postObj) ? JSON.stringify(postObj) : null;

            let reqHeaders = (postData) ? {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            } : {}

            if (headers) {
                for (key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        reqHeaders[key] = headers[key];
                    }
                }
            }

            const options = {
                hostname: host,
                port: 443,
                path: path,
                method: method,
                headers: reqHeaders
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (d) => {
                    body += d.toString();
                });
                res.on('end', () => {
                    try {
                        let resultBody = JSON.parse(body)
                        //console.log(resultBody);
                        resolve(resultBody)
                    } catch (e) {
                        if (body && body.indexOf("500 Server Error") > -1) {
                            console.error("500 error")
                        } else {
                            console.error("not json: " + body)
                        }
                        reject(e);
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });
            if (postData) {
                req.write(postData);
            }
            req.end();
        })

    }).catch((e) => {
        console.error("error occured during request")
    })
}

const netvoteGet = (host, path, headers) => {
    return netvoteRequest('GET', host, path, null, headers);
};

const netvotePost = (host, path, postObj, headers) => {
    return netvoteRequest('POST', host, path, postObj, headers);
};

module.exports = {
    netvoteGet: netvoteGet,
    netvotePost: netvotePost
}