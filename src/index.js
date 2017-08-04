import poly from 'buffer-v6-polyfill'; // eslint-disable-line no-unused-vars
import { Receipt, Type } from 'poker-helper';
import ethUtil from 'ethereumjs-util';
import { BadRequest, Unauthorized, Forbidden, Conflict, EnhanceYourCalm, Teapot } from './errors';

const timeout = 2; // hours <- timeout for email verification
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const refRegex = /^[0-9a-f]{8}$/i;
const emailRegex = /^(([^<>()[\]\\.,;:\s@']+(\.[^<>()[\]\\.,;:\s@']+)*)|('.+'))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

/**
 * Checks if the given string is a checksummed address
 *
 * @method isChecksumAddress
 * @param {String} address the given HEX adress
 * @return {Boolean}
*/
function isChecksumAddress(addr) {
  // Check each case
  const address = addr.replace('0x', '');
  const addressHash = ethUtil.sha3(address.toLowerCase());
  for (let i = 0; i < 40; i += 1) {
    // the nth letter should be uppercase if the nth digit of casemap is 1
    if ((parseInt(addressHash[i], 16) > 7
      && address[i].toUpperCase() !== address[i])
      || (parseInt(addressHash[i], 16) <= 7
        && address[i].toLowerCase() !== address[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if the given string is an address
 *
 * @method isAddress
 * @param {String} address the given HEX adress
 * @return {Boolean}
*/
function isAddress(address) {
  if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
    // check if it has the basic requirements of an address
    return false;
  } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
    // If it's all small caps or all all caps, return true
    return true;
  }
  // Otherwise check each case
  return isChecksumAddress(address);
}

function checkSession(sessionReceipt, sessionAddr, type) {
  // check session
  let session;
  try {
    session = Receipt.parse(sessionReceipt);
  } catch (err) {
    throw new Unauthorized(`invalid session: ${err.message}.`);
  }
  if (session.signer !== sessionAddr) {
    throw new Unauthorized(`invalid session signer: ${session.signer}.`);
  }
  const before2Hours = (Date.now() / 1000) - (60 * 60 * timeout);
  if (session.created < before2Hours) {
    throw new Unauthorized(`session expired since ${before2Hours - session.created} seconds.`);
  }
  if (session.type !== type) {
    throw new Forbidden(`Wallet operation forbidden with session type ${session.type}.`);
  }
  return session;
}

function checkWallet(walletStr) {
  let wallet;
  try {
    wallet = JSON.parse(walletStr);
  } catch (err) {
    throw new BadRequest(`invalid wallet json: ${err.message}.`);
  }
  if (!isAddress(wallet.address)) {
    throw new BadRequest(`invalid address ${wallet.address} in wallet.`);
  }
  return wallet;
}

function AccountManager(db, email, recaptcha, sns, topicArn, sessionPriv, factory) {
  this.db = db;
  this.email = email;
  this.recaptcha = recaptcha;
  this.sns = sns;
  this.factory = factory;
  this.topicArn = topicArn;
  if (sessionPriv) {
    this.sessionPriv = sessionPriv;
    const priv = new Buffer(sessionPriv.replace('0x', ''), 'hex');
    this.sessionAddr = `0x${ethUtil.privateToAddress(priv).toString('hex')}`;
  }
}

AccountManager.prototype.getAccount = function getAccount(accountId) {
  let account;
  return this.db.getAccount(accountId).then((_account) => {
    account = _account;
    account.id = accountId;
    return Promise.resolve(account);
  });
};

AccountManager.prototype.getRef = function getRef(refCode) {
  const globalRef = '00000000';
  // todo: check ref format
  if (!refRegex.test(refCode)) {
    // http 400
    throw new BadRequest(`passed refCode ${refCode} not valid.`);
  }
  let refProm;
  if (globalRef === refCode) {
    // if request has global refCode, avoid db request
    refProm = Promise.resolve({ allowance: 1 });
  } else {
    refProm = this.db.getRef(refCode);
  }
  const globProm = this.db.getRef(globalRef);
  return Promise.all([refProm, globProm]).then((rsp) => {
    const referral = rsp[0];
    const glob = rsp[1];
    if (glob.allowance < 1) {
      // 420 - global signup limit reached
      throw new EnhanceYourCalm('global limit reached');
    }
    if (referral.allowance < 1) {
      // 418 - invite limit for this code reached
      throw new Teapot('account invite limit reached');
    }
    if (uuidRegex.test(glob.account)) {
      // 200 - return global ref code
      // this will allow users without ref code to sign up
      return Promise.resolve({ defaultRef: glob.account });
    }
    // 200 - do not provide default ref code
    // users without ref code will not be able to sign up
    return Promise.resolve({});
  });
};

AccountManager.prototype.queryAccount = function queryAccount(email) {
  return this.db.getAccountByEmail(email).then(
    account => account.wallet,
    () => JSON.stringify({
      address: `0x${ethUtil.sha3(`${email}${'addressawobeqw4cq'}`).slice(0, 20).toString('hex')}`,
      Crypto: {
        cipher: 'aes-128-ctr',
        cipherparams: {
          iv: ethUtil.sha3(`${email}${'cipherparamsivaic4w6b'}`).slice(0, 16).toString('hex'),
        },
        ciphertext: ethUtil.sha3(`${email}${'ciphertextaoc84noq354'}`).slice(0, 32).toString('hex'),
        kdf: 'scrypt',
        kdfparams: {
          dklen: 32,
          n: 65536,
          r: 1,
          p: 8,
          salt: ethUtil.sha3(`${email}${'kdfparamssalta7c465oa754'}`).slice(0, 32).toString('hex'),
        },
        mac: ethUtil.sha3(`${email}${'maco8wb47q5496q38745'}`).slice(0, 32).toString('hex'),
      },
      version: 3,
    }),
  );
};

AccountManager.prototype.queryUnlockReceipt = async function queryUnlockReceipt(unlockRequest) {
  try {
    const unlockRequestReceipt = Receipt.parse(unlockRequest);
    const secsFromCreated = Math.floor(Date.now() / 1000) - unlockRequestReceipt.created;
    const account = await this.factory.getAccount(unlockRequestReceipt.signer);

    if (secsFromCreated > 600) {
      throw new BadRequest('Receipt is outdated');
    }

    if (account.proxy !== '0x') {
      const receipt = new Receipt(account.proxy)
                      .unlock(unlockRequestReceipt.newOwner)
                      .sign('0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4');
      return receipt;
    }

    throw new BadRequest(`Proxy for ${unlockRequestReceipt.signer} doesn't exist`);
  } catch (e) {
    throw e;
  }
};

AccountManager.prototype.addAccount = function addAccount(accountId,
  email, recapResponse, origin, sourceIp, refCode) {
  if (!uuidRegex.test(accountId)) {
    throw new BadRequest(`passed accountId ${accountId} not uuid v4.`);
  }
  if (!emailRegex.test(email)) {
    throw new BadRequest(`passed email ${email} has invalid format.`);
  }
  if (!refRegex.test(refCode)) {
    throw new BadRequest(`passed refCode ${refCode} has invalid format.`);
  }
  const receipt = new Receipt().createConf(accountId).sign(this.sessionPriv);

  const conflictProm = this.db.checkAccountConflict(accountId, email);
  const captchaProm = this.recaptcha.verify(recapResponse, sourceIp);
  const refProm = this.db.getRef(refCode);
  return Promise.all([conflictProm, captchaProm, refProm]).then((rsp) => {
    const referral = rsp[2];
    if (referral.allowance < 1) {
      // 418 - invite limit for this code reached
      throw new Teapot('referral invite limit reached.');
    }

    if (!uuidRegex.test(referral.account)) {
      throw new BadRequest(`passed refCode ${refCode} can not be used for signup.`);
    }
    const now = new Date().toString();
    const putAccProm = this.db.putAccount(accountId, {
      created: [now],
      pendingEmail: [email],
      referral: [referral.account],
    });
    const refAllowProm = this.db.setRefAllowance(refCode, referral.allowance - 1);
    return Promise.all([putAccProm, refAllowProm]);
  }).then(() => this.email.sendConfirm(email, receipt, origin));
};

AccountManager.prototype.resetRequest = function resetRequest(email,
  recapResponse, origin, sourceIp) {
  const accountProm = this.db.getAccountByEmail(email);
  const captchaProm = this.recaptcha.verify(recapResponse, sourceIp);
  return Promise.all([accountProm, captchaProm]).then(([account]) => {
    const wallet = JSON.parse(account.wallet);
    const receipt = new Receipt().resetConf(account.id, wallet.address).sign(this.sessionPriv);
    return this.email.sendReset(email, receipt, origin);
  });
};

AccountManager.prototype.setWallet = function setWallet(sessionReceipt, walletStr) {
  // check session
  const session = checkSession(sessionReceipt, this.sessionAddr, Type.CREATE_CONF);
  // check data
  const wallet = checkWallet(walletStr);
  let account;
  // check pending wallet exists
  return this.db.getAccount(session.accountId).then((accountRsp) => {
    account = accountRsp;
    if (account.wallet) {
      throw new Conflict('wallet already set.');
    }
    // set new wallet
    const walletProm = this.db.setWallet(session.accountId, walletStr);
    // create ref code
    const refCode = Math.floor(Math.random() * 4294967295).toString(16);
    const refProm = this.db.putRef(refCode, session.accountId, 3);
    return Promise.all([walletProm, refProm]);
  }).then(() =>
    // notify worker to create contracts
    this.notify(`WalletCreated::${wallet.address}`, {
      accountId: account.id,
      email: account.email,
      signerAddr: wallet.address,
    }),
  );
};

AccountManager.prototype.resetWallet = function resetWallet(sessionReceipt, walletStr) {
  // check session
  const session = checkSession(sessionReceipt, this.sessionAddr, Type.RESET_CONF);
  // check data
  const wallet = checkWallet(walletStr);
  // check existing wallet
  let existing;
  return this.db.getAccount(session.accountId).then((account) => {
    if (!account.wallet) {
      throw new Conflict('no existing wallet found.');
    }
    existing = JSON.parse(account.wallet);
    if (!isAddress(wallet.address)) {
      throw new BadRequest(`invalid address ${wallet.address} in wallet.`);
    }
    if (existing.address === wallet.address) {
      throw new Conflict('can not reset wallet with same address.');
    }
    // reset wallet
    return this.db.setWallet(session.accountId, walletStr);
  });
};

AccountManager.prototype.confirmEmail = function confirmEmail(sessionReceipt) {
  // check session
  const session = checkSession(sessionReceipt, this.sessionAddr, Type.CREATE_CONF);
  // handle email
  return this.db.getAccount(session.accountId).then((account) => {
    if (account.email) {
      throw new BadRequest('email already set.');
    }
    return this.db.updateEmailComplete(session.accountId, account.pendingEmail);
  });
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
