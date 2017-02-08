const AWS = require('aws-sdk');
const Db = require('./lib/db');
const Email = require('./lib/email');
const Recaptcha = require('./lib/recaptcha');
const AccountManager = require('./lib/index');
AWS.config.update({region: 'eu-west-1'});

const simpledb = new AWS.SimpleDB();
const ses = new AWS.SES();

exports.handler = function(event, context, callback) {

  console.log('Request received:\n', JSON.stringify(event));
  console.log('Context received:\n', JSON.stringify(context));

  const recapSecret = event['stage-variables'].recaptchaSecret,
    path = event.context['resource-path'];

  var handleRequest,
    manager = new AccountManager(new Db(simpledb), new Email(ses), new Recaptcha(recapSecret)),
  if (path.indexOf('confirm') > -1) {
    handleRequest = manager.confirmEmail(event.token);
  } else if (path.indexOf('query') > -1) {
    handleRequest = manager.queryAccount(event.email);
  } else if (path.indexOf('account') > -1) {
    if (event.context['http-method'] === 'GET') {
      handleRequest = manager.getAccount(event.params.path.accountId);
    } else {
      handleRequest = manager.addAccount(
        event.params.path.accountId,
        event.email,
        event.wallet,
        event.recapResponse,
        event.context['source-ip']
      );
    }
  } else {
    handleRequest = Promise.reject('Not Found: unexpected path: ' + path);
  }

  handleRequest
  .then(function(data){
    callback(null, data);
  })
  .catch(function(err){
    console.log(err.stack);
    callback(err);
  });
}

