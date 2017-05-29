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
          Value: aValue,
          Replace: true,
        });
      });
    });
  }
  return attributes;
};

function Db(sdb, accountTable, refTable) {
  this.sdb = sdb;
  this.domain = accountTable;
  if (typeof this.domain === 'undefined') {
    this.domain = 'ab-accounts';
  }
  this.refDomain = refTable;
  if (typeof this.refDomain === 'undefined') {
    this.refDomain = 'ab-refs';
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

Db.prototype.getAccountByEmail = function getAccountByEmail(email) {
  return new Promise((fulfill, reject) => {
    this.sdb.select({
      SelectExpression: `select * from \`${this.domain}\` where email =  "${email}" limit 1`,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      if (!data.Items || data.Items.length === 0) {
        return reject(new NotFound(`email ${email} unknown.`));
      }
      const rv = transform(data.Items[0].Attributes);
      rv.id = data.Items[0].Name;
      return fulfill(rv);
    });
  });
};

Db.prototype.putAccount = function putAccount(accountId, attributes) {
  return new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.domain,
      ItemName: accountId,
      Attributes: transform(attributes),
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
};

Db.prototype.setWallet = function setWallet(accountId, wallet) {
  return new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.domain,
      ItemName: accountId,
      Attributes: transform({ wallet: [wallet] }),
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
      Attributes: transform({ email: [email] }),
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

Db.prototype.getRefByAccount = function getRefByAccount(accountId) {
  return new Promise((fulfill, reject) => {
    this.sdb.select({
      SelectExpression: `select * from \`${this.refDomain}\` where account =  "${accountId}" limit 1`,
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      if (!data.Items || data.Items.length === 0) {
        return reject(new NotFound(`accountId ${accountId} unknown.`));
      }
      const rv = transform(data.Items[0].Attributes);
      rv.allowance = parseInt(rv.allowance, 10);
      rv.id = data.Items[0].Name;
      return fulfill(rv);
    });
  });
};

Db.prototype.putRef = function putRef(refCode, account, allowance) {
  return new Promise((fulfill, reject) => {
    this.sdb.putAttributes({
      DomainName: this.refDomain,
      ItemName: refCode,
      Attributes: transform({ account, allowance: allowance.toString() }),
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
      Attributes: transform({ allowance: [newAllowance.toString()] }),
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
};

module.exports = Db;
