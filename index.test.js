var expect = require('chai').expect;
var sinon = require('sinon');
require('chai').use(require('sinon-chai'));
const Contract = require('./lib/blockchain');
const AccountManager = require('./lib/index');
const Db = require('./lib/db');
const Email = require('./lib/email');

var sdb = {
  getAttributes: function(){},
  putAttributes: function(){},
  deleteAttributes: function(){},
  select: function(){}
};

var contract = {
  create: {
    sendTransaction: function(){}, 
  },
}

var provider = {
  getFactory: function(){},
  getAddress: function(){},
}

var recaptcha = {
  verify: function(){}
}

const ACCOUNT_ID = '357e44ed-bd9a-4370-b6ca-8de9847d1da8';
const TEST_MAIL = 'test@mail.com';


describe('Account Manager', function() {

  beforeEach(function () {
    sinon.stub(provider, 'getFactory').returns(contract);
  });



  it('should fail adding account on invalid uuid.', function(done) {
    var manager = new AccountManager(new Db({}));

    manager.addAccount('123', TEST_MAIL, {}).catch(function(err) {
      expect(err).to.contain('Bad Request: ');
      done();
    }).catch(done);
  });

  it('should reject invalid email.', function(done) {
    var manager = new AccountManager(new Db({}));

    manager.addAccount(ACCOUNT_ID, 'email@email', {}).catch(function(err) {
      expect(err).to.contain('Bad Request: ');
      done();
    }).catch(done);
  });

  it('should fail on key conflict.', function(done) {

    sinon.stub(sdb, 'getAttributes').yields(null, {Attributes: []});
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    var manager = new AccountManager(new Db(sdb), null, recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).catch(function(err) {
      expect(err).to.contain('Conflict: ');
      expect(err).to.contain(ACCOUNT_ID);
      done();
    }).catch(done);
  });

  it('should fail on captcha error.', function(done) {
    sinon.stub(sdb, 'getAttributes').yields(null, {Attributes: []});
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(recaptcha, 'verify').returns(Promise.reject('Bad Request: wrong'));

    var manager = new AccountManager(new Db(sdb), null, recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).catch(function(err) {
      expect(err).to.contain('Bad Request: ');
      done();
    }).catch(done);
  });

  it('should prevent to add existing email.', function(done) {

    sinon.stub(sdb, 'getAttributes').yields(null, {});
    sinon.stub(sdb, 'select').yields(null, {Items: [ { Name: '123', Attributes: [
      { Name: 'Email', Value: TEST_MAIL },
    ]}]});
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    var manager = new AccountManager(new Db(sdb), null, recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).catch(function(err) {
      expect(err).to.contain('Conflict: ');
      expect(err).to.contain(TEST_MAIL);
      done();
    }).catch(done);
  });

  it('should prevent to add existing pending email.', function(done) {

    sinon.stub(sdb, 'getAttributes').yields(null, {});
    sinon.stub(sdb, 'select').yields(null, {Items: [ { Name: '123', Attributes: [
      { Name: 'pendingEmail', Value: TEST_MAIL },
    ]}]});
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    var manager = new AccountManager(new Db(sdb), null, recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).catch(function(err) {
      expect(err).to.contain('Conflict: ');
      expect(err).to.contain(TEST_MAIL);
      done();
    }).catch(done);
  });

  it('should allow to add account.', function(done) {

    sinon.stub(sdb, 'getAttributes').yields(null, {});
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(sdb, 'putAttributes').yields(null, {ResponseMetadata: {}});
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    var ses = { sendEmail: function(){} };
    sinon.stub(ses, 'sendEmail').yields(null, {});

    var manager = new AccountManager(new Db(sdb), new Email(ses), recaptcha);
    
    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).then(function(rv) {
      expect(sdb.putAttributes).calledWith({
        Attributes: [
          { Name: "created", Replace: true, Value: sinon.match.any },
          { Name: "wallet", Replace: true, Value: {  } },
          { Name: "pendingToken", Replace: true, Value: sinon.match.any },
          { Name: "pendingTime", Replace: true, Value: sinon.match.any },
          { Name: "pendingEmail", Replace: true, Value: TEST_MAIL },
        ],
        DomainName: "ab-accounts",
        ItemName: ACCOUNT_ID
      });
      expect(ses.sendEmail).calledWith(sinon.match({
        Destination: { ToAddresses: [TEST_MAIL] },
        Message: { Subject: { Data: 'Acebusters Email Verification Request' }},
        Source: 'noreply@acebusters.com'
      }));
      done();
    }).catch(done);
  });



  it('should allow to confirm email.', function(done) {
    var token = '65e95013-ac29-4ee9-a1fa-5e712e0178a5';

    sinon.stub(contract.create, 'sendTransaction').yields(null, '0x1234');
    sinon.stub(sdb, 'select').yields(null, {Items: [ { Name: ACCOUNT_ID, Attributes: [
      { Name: 'pendingToken', Value: token },
      { Name: 'pendingEmail', Value: TEST_MAIL },
      { Name: 'pendingTime', Value: new Date().toString()},
    ]}]});
    sinon.stub(sdb, 'putAttributes').yields(null, {ResponseMetadata: {}});
    sinon.stub(sdb, 'deleteAttributes').yields(null, {ResponseMetadata: {}});

    var manager = new AccountManager(new Db(sdb), null, null, new Contract(provider));

    manager.confirmEmail(token).then(function(rv) {
      expect(sdb.select).calledWith({
        SelectExpression: 'select * from `ab-accounts` where pendingToken =  "' + token + '" limit 1'
      });
      expect(sdb.putAttributes).calledWith({
        Attributes: [ { Name: 'email', Replace: true, Value: TEST_MAIL }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID
      });
      expect(sdb.deleteAttributes).calledWith({
        Attributes: [ { Name: 'pendingEmail' }, { Name: 'pendingToken' }, { Name: 'pendingTime' }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID
      });
      expect(rv).to.eql({ accountId: ACCOUNT_ID, txHash: '0x1234' });
      done()
    }).catch(done);
  });

  it('should prevent confirming old email token.', function(done) {
    var token = '65e95013-ac29-4ee9-a1fa-5e712e0178a5';
    var created = new Date();
    created.setHours(created.getHours() - 3);

    sinon.stub(sdb, 'select').yields(null, {Items: [ { Name: ACCOUNT_ID, Attributes: [
      { Name: 'pendingToken', Value: token },
      { Name: 'pendingEmail', Value: TEST_MAIL },
      { Name: 'pendingTime', Value: created.toString() },
    ]}]});

    var manager = new AccountManager(new Db(sdb));

    manager.confirmEmail(token).catch(function(err) {
      expect(err).to.contain('timed out.');
      done();
    }).catch(done);
  });

  it('should error on unknown email token.', function(done) {
    var token = '65e95013-ac29-4ee9-a1fa-5e712e0178a5';

    sinon.stub(sdb, 'select').yields(null, {Items: []});

    var manager = new AccountManager(new Db(sdb));

    manager.confirmEmail(token).catch(function(err) {
      expect(err).to.contain('Not Found:');
      done();
    }).catch(done);
  });

  it('should error on invalid email token.', function(done) {
    var token = '0:ZelQE6wpTumh-l5xLgF4pQ';

    sinon.stub(sdb, 'select').yields(null, {Items: []});

    var manager = new AccountManager(new Db(sdb));

    manager.confirmEmail(token).catch(function(err) {
      expect(err).to.contain('Bad Request:');
      done();
    }).catch(done);
  });

  afterEach(function () {
    if (sdb.getAttributes.restore) sdb.getAttributes.restore();
    if (sdb.putAttributes.restore) sdb.putAttributes.restore();
    if (sdb.deleteAttributes.restore) sdb.deleteAttributes.restore();
    if (sdb.select.restore) sdb.select.restore();
    if (recaptcha.verify.restore) recaptcha.verify.restore(); 
    if (contract.create.sendTransaction.restore) contract.create.sendTransaction.restore();
    if (provider.getFactory.restore) provider.getFactory.restore();
  });
});
