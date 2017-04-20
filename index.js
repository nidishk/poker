import AWS from 'aws-sdk';
import Raven from 'raven';
import Db from './src/db';
import Email from './src/email';
import Recaptcha from './src/recaptcha';
import AccountManager from './src/index';

const simpledb = new AWS.SimpleDB();
const ses = new AWS.SES();

const handleError = function handleError(err, callback) {
  Raven.captureException(err, { server_name: 'account_service' }, (sendErr) => {
    if (sendErr) {
      console.log(JSON.stringify(sendErr)); // eslint-disable-line no-console
      callback(sendErr);
      return;
    }
    // this shall map to http 500
    callback(`Error: ${err.message}`);
  });
};

exports.handler = function handler(event, context, callback) {
  Raven.config(process.env.SENTRY_URL, {
    captureUnhandledRejections: true,
  }).install(() => {
    callback(null, 'This is thy sheath; there rust, and let me die.');
  });

  const recapSecret = event['stage-variables'].recaptchaSecret;
  const path = event.context['resource-path'];

  let handleRequest;
  const manager = new AccountManager(new Db(simpledb), new Email(ses), new Recaptcha(recapSecret), new AWS.SNS(), event['stage-variables'].topicArn);

  try {
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
          event.origin,
          event.context['source-ip'],
        );
      }
    } else {
      handleRequest = Promise.reject(`Not Found: unexpected path: ${path}`);
    }
  } catch (err) {
    handleError(err, callback);
    return;
  }

  handleRequest.then((data) => {
    callback(null, data);
  }).catch((err) => {
    handleError(err, callback);
  });
};

