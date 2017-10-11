import AWS from 'aws-sdk';
import Raven from 'raven';
import Web3 from 'web3';
import Db from './src/db';
import Email from './src/email';
import Recaptcha from './src/recaptcha';
import ProxyContr from './src/proxyContract';
import AccountManager from './src/index';
import Logger from './src/logger';
import SlackAlert from './src/slackAlert';

const simpledb = new AWS.SimpleDB();
const ses = new AWS.SES();

const handleError = function handleError(err, logger, callback) {
  logger.exception(err).then(callback);
};

let web3Provider;

exports.handler = function handler(event, context, callback) {
  Raven.config(process.env.SENTRY_URL).install();

  const logger = new Logger(Raven, context.functionName, 'account-service');

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
  const unlockPriv = process.env.RECOVERY_PRIV;
  const proxy = new ProxyContr(web3, process.env.SENDER_ADDR, new AWS.SQS(), process.env.QUEUE_URL);
  const fromEmail = process.env.FROM_EMAIL;
  const accountTable = process.env.ACCOUNT_TABLE;
  const refTable = process.env.REF_TABLE;
  const proxyTable = process.env.PROXIES_TABLE;
  const minProxiesAlertThreshold = process.env.SLACK_ALERT_MIN_PROXIES_THRESHOLD || 3;
  const slackAlertUrl = process.env.SLACK_ALERT_URL;
  const slackAlertChannel = process.env.SLACK_ALERT_CHANNEL;

  let slackAlert;
  if (slackAlertUrl && slackAlertChannel) {
    const env = process.env.ENV ? process.env.ENV : proxyTable;
    slackAlert = new SlackAlert(slackAlertUrl, slackAlertChannel, env);
  }

  let handleRequest;
  const manager = new AccountManager(
    new Db(simpledb, accountTable, refTable, proxyTable),
    new Email(ses, fromEmail),
    new Recaptcha(recapSecret),
    new AWS.SNS(),
    topicArn,
    sessionPriv,
    proxy,
    logger,
    unlockPriv,
    slackAlert,
    minProxiesAlertThreshold,
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
        handleRequest = manager.setWallet(
          event.sessionReceipt,
          event.wallet,
          event.proxyAddr,
        );
      }
      if (method === 'PUT') {
        handleRequest = manager.resetWallet(event.sessionReceipt, event.wallet);
      }
    } else if (path.indexOf('referral') > -1) {
      handleRequest = manager.getRef(event.params.path.refCode);
    } else if (path.indexOf('refs') > -1) {
      handleRequest = manager.queryRefCodes(event.params.path.accountId);
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
      handleRequest = manager.queryUnlockReceipt(
        decodeURIComponent(event.params.path.unlockRequest),
      );
    } else if (path.indexOf('forward') > -1) {
      handleRequest = manager.forward(event.forwardReceipt, event.resetConfReceipt);
    }
    if (typeof handleRequest === 'undefined') {
      handleRequest = Promise.reject(`Not Found: unexpected path: ${path}`);
    }
  } catch (err) {
    handleError(err, logger, callback);
    return;
  }
  handleRequest.then((data) => {
    callback(null, data);
  }).catch((err) => {
    handleError(err, logger, callback);
  });
};
