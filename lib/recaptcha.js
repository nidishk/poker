var httpinvoke = require('httpinvoke');
var querystring = require('querystring');

const recaptchaUrl = 'https://www.google.com//recaptcha/api/siteverify';
const contentType = 'application/x-www-form-urlencoded';

function Recaptcha (secret) {
  this.secret = secret;
}

Recaptcha.prototype.verify = function(recapResponse, sourceIp) {
  var self = this;
  return new Promise(function (fulfill, reject) {
    var options = {
      input: querystring.stringify({
          response: recapResponse,
          secret: self.secret,
          remoteip: sourceIp
        }),
      headers: {
        'Content-Type': contentType
      },
      converters: {
        'text json': JSON.parse,
        'json text': JSON.stringify
      },
      outputType: 'json'
    }
    return httpinvoke(recaptchaUrl, 'POST', options).then(function(res) {
      if (res.body.success) {
        fulfill();
      } else {
        reject('Bad Request: ' + res.body);
      }
    }, function(err) {
      reject('Bad Request: ' + );
    });
  });
}

module.exports = Recaptcha;
