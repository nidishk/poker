import httpinvoke from 'httpinvoke';
import querystring from 'querystring';
import { BadRequest } from './errors';

const recaptchaUrl = 'https://www.google.com//recaptcha/api/siteverify';
const contentType = 'application/x-www-form-urlencoded';

function Recaptcha(secret) {
  this.secret = secret;
}

Recaptcha.prototype.verify = function verify(recapResponse, sourceIp) {
  return new Promise((fulfill) => {
    const options = {
      input: querystring.stringify({
        response: recapResponse,
        secret: this.secret,
        remoteip: sourceIp,
      }),
      headers: {
        'Content-Type': contentType,
      },
      converters: {
        'text json': JSON.parse,
        'json text': JSON.stringify,
      },
      outputType: 'json',
    };
    return httpinvoke(recaptchaUrl, 'POST', options).then((res) => {
      if (!res.body.success) {
        throw new BadRequest(res.body);
      }
      fulfill();
    }, (err) => {
      throw new BadRequest(err);
    });
  });
};

module.exports = Recaptcha;
