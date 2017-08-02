import AWS from 'aws-sdk';
import Raven from 'raven';
import Web3 from 'web3';
import Db from './src/db';
import Email from './src/email';
import Recaptcha from './src/recaptcha';
import Factory from './src/factoryContract';
import AccountManager from './src/index';

const simpledb = new AWS.SimpleDB();
const ses = new AWS.SES();

const handleError = function handleError(err, callback) {
  Raven.captureException(err, { server_name: 'account_service' }, (sendErr) => {
    if (sendErr) {
      console.log(JSON.stringify(sendErr)); // eslint-disable-line no-console
      return callback(sendErr);
    }
    if (err.errName) {
      // these are known errors: 4xx
      return callback(err.message);
    }
    // everything shall map to http 500
    return callback(`Error: ${err.message}`);
  });
};

let web3Provider;

exports.handler = function handler(event, context, callback) {
  Raven.config(process.env.SENTRY_URL).install();

  let web3;
  if (!web3Provider) {
    web3 = new Web3();
    web3Provider = new web3.providers.HttpProvider(process.env.PROVIDER_URL);
  }
  web3 = new Web3(web3Provider);

  const recapSecret = process.env.RECAPTCHA_SECRET;
  const path = event.context['resource-path'];
  const method = event.context['http-method'];
  const topicArn = process.env.TOPIC_ARN;
  const sessionPriv = process.env.SESSION_PRIV;
  const accountTable = process.env.ACCOUNT_TABLE;
  const factory = new Factory(web3, process.env.FACTORY_ADDR);
  const refTable = process.env.REF_TABLE;
  const fromEmail = process.env.FROM_EMAIL;

  let handleRequest;
  const manager = new AccountManager(
    new Db(simpledb, accountTable, refTable),
    new Email(ses, fromEmail),
    new Recaptcha(recapSecret),
    new AWS.SNS(),
    topicArn,
    sessionPriv,
    factory,
  );

  try {
    if (path.indexOf('confirm') > -1) {
      handleRequest = manager.confirmEmail(event.sessionReceipt);
    } else if (path.indexOf('reset') > -1) {
      handleRequest = manager.resetRequest(
        event.email,
        event.recapResponse,
        event.origin,
        event.context['source-ip'],
      );
    } else if (path.indexOf('query') > -1) {
      handleRequest = manager.queryAccount(event.email);
    } else if (path.indexOf('wallet') > -1) {
      if (method === 'POST') {
        handleRequest = manager.setWallet(event.sessionReceipt, event.wallet);
      }
      if (method === 'PUT') {
        handleRequest = manager.resetWallet(event.sessionReceipt, event.wallet);
      }
    } else if (path.indexOf('referral') > -1) {
      handleRequest = manager.getRef(event.params.path.refCode);
    } else if (path.indexOf('account') > -1) {
      if (method === 'GET') {
        handleRequest = manager.getAccount(event.params.path.accountId);
      }
      if (method === 'POST') {
        handleRequest = manager.addAccount(
          event.params.path.accountId,
          event.email,
          event.recapResponse,
          event.origin,
          event.context['source-ip'],
          event.refCode,
        );
      }
    } else if (path.indexOf('unlock') > -1) {
      handleRequest = manager.queryUnlockReceipt(event.params.path.unlockRequest);
    }
    if (typeof handleRequest === 'undefined') {
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

