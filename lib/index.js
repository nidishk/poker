const uuid = require('node-uuid');

const timeout = 2; //hours <- timeout for email verification
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

var AccountManager = function(db, email, recaptcha) {
  this.db = db;
  this.email = email;
  this.recaptcha = recaptcha;
}


AccountManager.prototype.getAccount = function(accountId) {
  var self = this;
  return this.db.getAccount(accountId).then(function(account) {
    account.id = accountId;
    return Promise.resolve(account);
  });
}

AccountManager.prototype.queryAccount = function(email) {
  var self = this;
  return this.db.getAccountByEmail(email).then(function(account) {
    return Promise.resolve(account);
  });
}

AccountManager.prototype.addAccount = function(accountId, email, wallet, recapResponse, sourceIp) {
  if (!uuidRegex.test(accountId)) {
      return Promise.reject('Bad Request: passed accountId ' + accountId + ' not uuid v4.');
  }
  if (!emailRegex.test(email))
      return Promise.reject('Bad Request: passed email ' + email + ' has invalid format.');
  var self = this;
  var token = uuid.v4();

  var conflict = this.db.checkAccountConflict(accountId, email);
  var captcha = this.recaptcha.verify(recapResponse, sourceIp);
  return Promise.all([conflict, captcha]).then(function(rsp) {
    self.email.sendVerification(email, token);
    var now = new Date().toString();
    return self.db.putAccount(accountId, {
      created: [now],
      wallet: [wallet],
      pendingToken: [token],
      pendingTime: [now],
      pendingEmail: [email],
    });
  })
}

AccountManager.prototype.confirmEmail = function(token) {
  if (!uuidRegex.test(token)) {
      return Promise.reject('Bad Request: passed token ' + token + ' not uuid v4.');
  }
  var self = this, account;
  return this.db.getAccountByToken(token).then(function(_account){
    account = _account;
    var created = new Date(account.pendingTime);
    created.setHours(created.getHours() + timeout);
    if (created < new Date()) {
      return Promise.reject('Bad Request: verification fulfillment timed out.');
    }
    return self.db.updateEmailComplete(account.id, account.pendingEmail);
  }).then(function(){
    return Promise.resolve({accountId: account.id});
  });
}

module.exports = AccountManager;