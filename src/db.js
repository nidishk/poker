import { NotFound, Conflict } from './errors';

// transform from key/value to list and back
const transform = (data) => {
  let attributes;
  if (data && data.forEach) {
    attributes = {};
    data.forEach((aPair) => {
      if (!attributes[aPair.Name]) {
        attributes[aPair.Name] = {};
      }
      attributes[aPair.Name] = aPair.Value;
    });
  } else {
    attributes = [];
    Object.keys(data).forEach((anAttributeName) => {
      data[anAttributeName].forEach((aValue) => {
        attributes.push({
          Name: anAttributeName,
          Value: [aValue],
          Replace: true,
        });
      });
    });
  }
  return attributes;
};

function Db(sdb, accountTable, refTable, proxyTable) {
  this.sdb = sdb;
  this.domain = accountTable;
  if (typeof this.domain === 'undefined') {
    this.domain = 'ab-accounts';
  }
  this.refDomain = refTable;
  if (typeof this.refDomain === 'undefined') {
    this.refDomain = 'ab-refs';
  }
  this.proxyDomain = proxyTable;
  if (typeof this.proxyDomain === 'undefined') {
    this.proxyDomain = 'ab-proxies';
  }
}

Db.prototype.getAccount = function getAccount(accountId) {
  return new Promise((fulfill, reject) => {
    this.sdb.getAttributes({
      DomainName: this.domain,
      ItemName: accountId,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      if (!data.Attributes) {
        return reject(new NotFound(`Account with ID ${accountId} not found.`));
      }
      return fulfill(transform(data.Attributes));
    });
  });
};

Db.prototype.checkAccountConflict = function checkAccountConflict(accountId, email) {
  const idCheck = new Promise((fulfill, reject) => {
    this.sdb.getAttributes({
      DomainName: this.domain,
      ItemName: accountId,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      if (data.Attributes !== undefined) {
        return reject(new Conflict(`account with same Id ${accountId} found.`));
      }
      return fulfill();
    });
  });
  const mailCheck = new Promise((fulfill, reject) => {
    this.sdb.select({
      SelectExpression: `select * from \`${this.domain}\` where email =  "${email}" or pendingEmail =  "${email}"  limit 1`,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      if (data.Items && data.Items.length > 0) {
        return reject(new Conflict(`email ${email} taken.`));
      }
      return fulfill();
    });
  });
  return Promise.all([idCheck, mailCheck]);
};

Db.prototype.getAccountWithCondition = function getAccountWithCondition(cond) {
  return new Promise((fulfill, reject) => {
    this.sdb.select({
      SelectExpression: `select * from \`${this.domain}\` where ${cond} limit 1`,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      if (!data.Items || data.Items.length === 0) {
        return reject(new NotFound(`Account for codnition '${cond}' not found`));
      }
      const rv = transform(data.Items[0].Attributes);
      rv.id = data.Items[0].Name;
      return fulfill(rv);
    });
  });
};

Db.prototype.getAccountByEmail = function getAccountByEmail(email) {
  return this.getAccountWithCondition(`email = "${email}"`);
};

Db.prototype.getAccountBySignerAddr = function getAccountBySignerAddr(signerAddr) {
  return this.getAccountWithCondition(`signerAddr = "${signerAddr}"`);
};

Db.prototype.putAccount = function putAccount(accountId, email, referral, proxyAddr) {
  return new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.domain,
      ItemName: accountId,
      Attributes: [
        { Name: 'created', Value: new Date().toString(), Replace: true },
        { Name: 'pendingEmail', Value: email, Replace: true },
        { Name: 'referral', Value: referral, Replace: true },
        { Name: 'proxyAddr', Value: proxyAddr, Replace: true },
      ],
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
};

Db.prototype.setWallet = function setWallet(accountId, wallet, signerAddr, proxyAddr) {
  return new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.domain,
      ItemName: accountId,
      Attributes: [
        { Name: 'wallet', Value: wallet, Replace: true },
        { Name: 'signerAddr', Value: signerAddr, Replace: true },
        { Name: 'proxyAddr', Value: proxyAddr, Replace: true },
      ],
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
};

Db.prototype.updateEmailComplete = function updateEmailComplete(accountId, email) {
  const put = new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.domain,
      ItemName: accountId,
      Attributes: [
        { Name: 'email', Value: email, Replace: true },
      ],
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
  const del = new Promise((fulfill, reject) => {
    this.sdb.deleteAttributes({
      DomainName: this.domain,
      ItemName: accountId,
      Attributes: [
        { Name: 'pendingEmail' },
      ],
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
  return Promise.all([put, del]);
};

Db.prototype.getRef = function getRef(refCode) {
  return new Promise((fulfill, reject) => {
    this.sdb.getAttributes({
      DomainName: this.refDomain,
      ItemName: refCode,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      if (!data.Attributes) {
        return reject(new NotFound(`Referral with ID ${refCode} not found.`));
      }
      const rv = transform(data.Attributes);
      rv.allowance = parseInt(rv.allowance, 10);
      return fulfill(rv);
    });
  });
};

Db.prototype.getRefsByAccount = function getRefsByAccount(accountId) {
  return new Promise((fulfill, reject) => {
    this.sdb.select({
      SelectExpression: `select * from \`${this.refDomain}\` where account = "${accountId}"`,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }

      if (!data.Items || data.Items.length === 0) {
        return reject(new NotFound(`accountId ${accountId} unknown.`));
      }

      return fulfill(
        data.Items.map((item) => {
          const attributes = transform(item.Attributes);
          return {
            allowance: Number(attributes.allowance),
            id: item.Name,
          };
        }),
      );
    });
  });
};

Db.prototype.putRef = function putRef(refCode, account, allowance) {
  return new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.refDomain,
      ItemName: refCode,
      Attributes: [
        { Name: 'account', Value: account, Replace: true },
        { Name: 'allowance', Value: String(allowance), Replace: true },
      ],
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
};

Db.prototype.setRefAllowance = function setRefAllowance(refCode, newAllowance) {
  return new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.refDomain,
      ItemName: refCode,
      Attributes: [
        { Name: 'allowance', Value: String(newAllowance), Replace: true },
      ],
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
};

Db.prototype.getProxy = function getProxy() {
  return new Promise((fulfill, reject) => {
    this.sdb.select({
      SelectExpression: `select * from \`${this.proxyDomain}\` limit 50`,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      if (!data.Items || data.Items.length === 0) {
        return reject(new Error('no proxy found.'));
      }
      return fulfill(data.Items[Math.floor(Math.random() * data.Items.length)].Name);
    });
  });
};

Db.prototype.deleteProxy = function deleteProxy(proxyAddr) {
  return new Promise((fulfill, reject) => {
    this.sdb.deleteAttributes({
      DomainName: this.proxyDomain,
      ItemName: proxyAddr,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
};

Db.prototype.addProxy = function addProxy(proxyAddr) {
  return new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.proxyDomain,
      ItemName: proxyAddr,
      Attributes: [
        { Name: 'proxyAddr', Value: proxyAddr },
      ],
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
};

module.exports = Db;
