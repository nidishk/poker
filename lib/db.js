

//transform from key/value to list and back
function transform(data) {
  var attributes;
  if (data && data.forEach) {
    attributes = {};
    data.forEach(function(aPair) {
      if (!attributes[aPair.Name]) { 
        attributes[aPair.Name] = {};
      }
      attributes[aPair.Name] = aPair.Value;
    });
  } else {
    attributes = [];
    Object.keys(data).forEach(function(anAttributeName) {
      data[anAttributeName].forEach(function(aValue) {
        attributes.push({
          Name  : anAttributeName,
          Value : aValue,
          Replace : true
        });
      });
    });
  }
  return attributes;
}

var Db = function(sdb) {
  this.sdb = sdb;
  this.domain = 'ab-accounts';
}


Db.prototype.getAccount = function(accountId) {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.sdb.getAttributes({
      DomainName    : self.domain,
      ItemName      : accountId
    }, function(err, data){
      if (err)
        reject('Error: '+ err);
      else if (!data.Attributes)
        reject('Not Found: Account with ID ' + accountId + ' not found.');
      else
        fulfill(transform(data.Attributes));
    });
  });
}

Db.prototype.checkAccountConflict = function(accountId, email) {
  var self = this;
  var idCheck = new Promise(function (fulfill, reject) {
    self.sdb.getAttributes({
      DomainName    : self.domain,
      ItemName      : accountId
    }, function(err, data){
      if (err)
        reject('Error: '+ err);
      else 
        fulfill({ isConflict: (data.Attributes != undefined)});
    });
  });
  var mailCheck = new Promise(function (fulfill, reject) {
    self.sdb.select({
      SelectExpression  : 'select * from `' + self.domain + '` where email =  "' + email + '" or pendingEmail =  "' + email + '"  limit 1'
    }, function(err, data){
      if (err)
        reject('Error: '+ err);
      else if (data.Items && data.Items.length > 0)
        reject('Conflict: email ' + email + ' taken.');
      else {
        fulfill({});
      }
    });
  });
  return Promise.all([idCheck, mailCheck]);
}

Db.prototype.getAccountByToken = function(token) {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.sdb.select({
      SelectExpression  : 'select * from `' + self.domain + '` where pendingToken =  "' + token + '" limit 1'
    }, function(err, data){
      if (err)
        reject('Error: '+ err);
      else if (!data.Items || data.Items.length == 0)
        reject('Not Found: token ' + token + ' unknown.');
      else {
        var rv = transform(data.Items[0].Attributes);
        rv.id = data.Items[0].Name;
        fulfill(rv);
      }
    });
  });
}

Db.prototype.getAccountByEmail = function(email) {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.sdb.select({
      SelectExpression  : 'select * from `' + self.domain + '` where email =  "' + email + '" limit 1'
    }, function(err, data){
      if (err)
        reject('Error: '+ err);
      else if (!data.Items || data.Items.length == 0)
        reject('Not Found: email ' + email + ' unknown.');
      else {
        var rv = transform(data.Items[0].Attributes);
        rv.id = data.Items[0].Name;
        fulfill(rv);
      }
    });
  });
}

Db.prototype.putAccount = function(accountId, attributes) {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.sdb.putAttributes({
      DomainName    : self.domain,
      ItemName      : accountId,
      Attributes    : transform(attributes)
    }, function(err, data) {
      if (err)
        reject('Error: ' + err);
      else
        fulfill(data);
    });
  });
}

Db.prototype.updateEmailComplete = function(accountId, email) {
  var self = this;
  var put = new Promise(function (fulfill, reject) {
    self.sdb.putAttributes({
      DomainName    : self.domain,
      ItemName      : accountId,
      Attributes    : transform({email: [email]})
    }, function(err, data) {
      if (err)
        reject('Error: ' + err);
      else
        fulfill(data);
    });
  });
  var del = new Promise(function (fulfill, reject) {
    self.sdb.deleteAttributes({
      DomainName    : self.domain,
      ItemName      : accountId,
      Attributes    : [
        { Name: 'pendingEmail' },
        { Name: 'pendingToken' },
        { Name: 'pendingTime' },
      ],
    }, function(err, data) {
      if (err)
        reject('Error: ' + err);
      else
        fulfill(data);
    });
  });
  return Promise.all([put, del]);
}

module.exports = Db;