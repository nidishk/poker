import uuid from 'node-uuid';
import { BadRequest } from './errors';

const timeout = 2; // hours <- timeout for email verification
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

function AccountManager(db, email, recaptcha, sns, topicArn) {
  this.db = db;
  this.email = email;
  this.recaptcha = recaptcha;
  this.sns = sns;
  this.topicArn = topicArn;
}

AccountManager.prototype.getAccount = function getAccount(accountId) {
  let account;
  return this.db.getAccount(accountId).then((_account) => {
    account = _account;
    account.id = accountId;
    return Promise.resolve(account);
  });
};

AccountManager.prototype.queryAccount = function queryAccount(email) {
  return this.db.getAccountByEmail(email).then(account => Promise.resolve(account));
};

AccountManager.prototype.addAccount = function addAccount(accountId,
  email, wallet, recapResponse, origin, sourceIp) {
  if (!uuidRegex.test(accountId)) {
    throw new BadRequest(`passed accountId ${accountId} not uuid v4.`);
  }
  if (!emailRegex.test(email)) {
    throw new BadRequest(`passed email ${email} has invalid format.`);
  }
  const token = uuid.v4();

  const conflict = this.db.checkAccountConflict(accountId, email);
  const captcha = this.recaptcha.verify(recapResponse, sourceIp);
  return Promise.all([conflict, captcha]).then(() => {
    const now = new Date().toString();
    return this.db.putAccount(accountId, {
      created: [now],
      wallet: [wallet],
      pendingToken: [token],
      pendingTime: [now],
      pendingEmail: [email],
    });
  }).then(() => {
    return this.email.sendVerification(email, token, origin);
  });
};

AccountManager.prototype.confirmEmail = function confirmEmail(token) {
  if (!uuidRegex.test(token)) {
    throw new BadRequest(`passed token ${token} not uuid v4.`);
  }
  let account;
  return this.db.getAccountByToken(token).then((_account) => {
    account = _account;
    const created = new Date(account.pendingTime);
    created.setHours(created.getHours() + timeout);
    if (created < new Date()) {
      throw new BadRequest('verification fulfillment timed out.');
    }
    const complete = this.db.updateEmailComplete(account.id, account.pendingEmail);
    const wallet = JSON.parse(account.wallet);
    const dispatch = this.notify(`EmailConfirmed::${wallet.address}`, {
      accountId: account.id,
      signerAddr: wallet.address,
    });
    return Promise.all([complete, dispatch]);
  }).then(() => Promise.resolve({ accountId: account.id }));
};

AccountManager.prototype.notify = function notify(subject, event) {
  return new Promise((fulfill, reject) => {
    this.sns.publish({
      Message: JSON.stringify(event),
      Subject: subject,
      TopicArn: this.topicArn,
    }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      fulfill({});
    });
  });
};

module.exports = AccountManager;
