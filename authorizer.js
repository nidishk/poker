const AWS = require('aws-sdk');
const Db = require('./lib/db.js');
const AccountAuthorizer = require('./lib/authorizer');
AWS.config.update({region: 'eu-west-1'});

const simpledb = new AWS.SimpleDB();

var authorizer = new AccountAuthorizer(new Db(simpledb));

exports.handler = function(event, context, callback) {

  console.log('Request received:\n', JSON.stringify(event));
  console.log('Context received:\n', JSON.stringify(context));

  authorizer.validateToken(event.authorizationToken).then(function(account) {
    callback(null, generatePolicy(account.accountId + '::' + account.balance, 'allow', event.methodArn));
  }).catch(function(err) {
    if (err.indexOf('Forbidden') > -1) {
      callback(null, generatePolicy('unknown', 'deny', event.methodArn));
    } else if (err.indexOf('Unauthorized') > -1) {
      callback('Unauthorized');
    } else {
      console.log('Error: ' + err.toString());
      callback(err.toString());
    }
  });
}

var generatePolicy = function(principalId, effect, resource) {
    var authResponse = {};
    authResponse.principalId = principalId;
    if (effect && resource) {
        var policyDocument = {};
        policyDocument.Version = '2012-10-17'; // default version
        policyDocument.Statement = [];
        var statementOne = {};
        statementOne.Action = 'execute-api:Invoke'; // default action
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
    return authResponse;
}