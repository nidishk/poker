import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import { it, describe, afterEach } from 'mocha';
import { Receipt } from 'poker-helper';
import Db from './src/db';
import Email from './src/email';
import AccountManager from './src/index';
import { BadRequest } from './src/errors';


chai.use(sinonChai);

const globalRef = '00000000';

const sdb = {
  getAttributes() {},
  putAttributes() {},
  deleteAttributes() {},
  select() {},
};

const sns = {
  publish() {},
};

const recaptcha = {
  verify() {},
};

const ses = {
  sendEmail() {},
};

const ACCOUNT_ID = '357e44ed-bd9a-4370-b6ca-8de9847d1da8';
const TEST_MAIL = 'test@mail.com';
const SESS_ADDR = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
const SESS_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';


describe('Account Manager - add account ', () => {
  it('should fail adding account on invalid uuid.', () => {
    const manager = new AccountManager(new Db({}));
    try {
      manager.addAccount('123', TEST_MAIL, {});
    } catch (err) {
      expect(err.message).to.contain('Bad Request: ');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should reject invalid email.', () => {
    const manager = new AccountManager(new Db({}));
    try {
      manager.addAccount(ACCOUNT_ID, 'email@email', {});
    } catch (err) {
      expect(err.message).to.contain('email');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should fail on key conflict.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [] });
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef).catch((err) => {
      expect(err.message).to.contain('Conflict: ');
      expect(err.message).to.contain(ACCOUNT_ID);
      done();
    }).catch(done);
  });

  it('should fail on captcha error.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [] });
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(recaptcha, 'verify').returns(Promise.reject(new BadRequest('wrong')));
    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef).catch((err) => {
      expect(err.message).to.contain('Bad Request: ');
      done();
    }).catch(done);
  });

  it('should prevent to add existing email.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      ] }).onFirstCall().yields(null, {});
    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: '123',
      Attributes: [
      { Name: 'Email', Value: TEST_MAIL },
      ] }] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef).catch((err) => {
      expect(err.message).to.contain('Conflict: ');
      expect(err.message).to.contain(TEST_MAIL);
      done();
    }).catch(done);
  });

  it('should prevent to add existing pending email.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      ] }).onFirstCall().yields(null, {});
    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: '123',
      Attributes: [
      { Name: 'pendingEmail', Value: TEST_MAIL },
      ] }] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef).catch((err) => {
      expect(err.message).to.contain('Conflict: ');
      expect(err.message).to.contain(TEST_MAIL);
      done();
    }).catch(done);
  });

  it('should prevent to signup when ref limit reached.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['0'] },
      ] }).onFirstCall().yields(null, {});
    sinon.stub(sdb, 'select').yields(null, { Items: [] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef).catch((err) => {
      expect(err.message).to.contain('Teapot: ');
      done();
    }).catch(done);
  });

  it('should prevent to signup global ref, if deactivated.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      { Name: 'account', Value: ['-'] },
      ] }).onFirstCall().yields(null, {});
    sinon.stub(sdb, 'select').yields(null, { Items: [] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef).catch((err) => {
      expect(err.message).to.contain('Bad Request: passed refCode 00000000');
      done();
    }).catch(done);
  });

  it('should allow to add account.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      { Name: 'account', Value: [ACCOUNT_ID] },
      ] }).onFirstCall().yields(null, {});
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());
    sinon.stub(ses, 'sendEmail').yields(null, {});
    const manager = new AccountManager(new Db(sdb),
      new Email(ses), recaptcha, null, null, SESS_PRIV);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef).then(() => {
      expect(sdb.putAttributes).calledWith({
        Attributes: [
          { Name: 'created', Replace: true, Value: sinon.match.any },
          { Name: 'pendingEmail', Replace: true, Value: TEST_MAIL },
          { Name: 'referral', Replace: true, Value: [ACCOUNT_ID] },
        ],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID,
      });
      expect(ses.sendEmail).calledWith(sinon.match({
        Destination: { ToAddresses: [TEST_MAIL] },
        Message: { Subject: { Data: 'Acebusters Email Verification Request' } },
        Source: 'noreply@acebusters.com',
      }));
      done();
    }).catch(done);
  });

  afterEach(() => {
    if (sdb.getAttributes.restore) sdb.getAttributes.restore();
    if (sdb.putAttributes.restore) sdb.putAttributes.restore();
    if (sdb.deleteAttributes.restore) sdb.deleteAttributes.restore();
    if (sdb.select.restore) sdb.select.restore();
    if (recaptcha.verify.restore) recaptcha.verify.restore();
    if (sns.publish.restore) sns.publish.restore();
    if (ses.sendEmail.restore) ses.sendEmail.restore();
  });
});

describe('Account Manager - reset request ', () => {
  it('should allow to request wallet reset.', (done) => {
    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: ACCOUNT_ID,
      Attributes: [
      { Name: 'email', Value: TEST_MAIL },
      { Name: 'wallet', Value: '{}' },
      ] }] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());
    sinon.stub(ses, 'sendEmail').yields(null, {});
    const manager = new AccountManager(new Db(sdb),
      new Email(ses), recaptcha, null, null, SESS_PRIV);

    manager.resetRequest(TEST_MAIL, {}).then(() => {
      expect(ses.sendEmail).calledWith(sinon.match({
        Destination: { ToAddresses: [TEST_MAIL] },
        Message: { Subject: { Data: 'Acebusters Password Recovery Request' } },
        Source: 'noreply@acebusters.com',
      }));
      done();
    }).catch(done);
  });

  afterEach(() => {
    if (sdb.getAttributes.restore) sdb.getAttributes.restore();
    if (sdb.putAttributes.restore) sdb.putAttributes.restore();
    if (sdb.deleteAttributes.restore) sdb.deleteAttributes.restore();
    if (sdb.select.restore) sdb.select.restore();
    if (recaptcha.verify.restore) recaptcha.verify.restore();
    if (sns.publish.restore) sns.publish.restore();
    if (ses.sendEmail.restore) ses.sendEmail.restore();
  });
});

describe('Account Manager - set Wallet ', () => {
  it('should allow to set Wallet.', (done) => {
    sinon.stub(sns, 'publish').yields(null, {});
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [
      { Name: 'id', Value: ACCOUNT_ID },
      { Name: 'email', Value: 'test@mail.com' },
    ]});
    sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
    const manager = new AccountManager(new Db(sdb), null, null, sns, 'topicArn', SESS_PRIV);

    const receipt = new Receipt().createConf(ACCOUNT_ID).sign(SESS_PRIV);
    const wallet = `{ "address": "${SESS_ADDR}" }`;
    manager.setWallet(receipt, wallet).then(() => {
      expect(sdb.getAttributes).calledWith({ DomainName: 'ab-accounts', ItemName: ACCOUNT_ID });
      expect(sdb.putAttributes).calledWith({
        Attributes: [{ Name: 'wallet', Replace: true, Value: wallet }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID,
      });
      expect(sdb.putAttributes).calledWith({
        Attributes: [
          { Name: 'account', Replace: true, Value: ACCOUNT_ID },
          { Name: 'allowance', Replace: true, Value: '3' },
        ],
        DomainName: 'ab-refs',
        ItemName: sinon.match.any,
      });
      expect(sns.publish).callCount(1);
      expect(sns.publish).calledWith({
        Message: `{"accountId":"${ACCOUNT_ID}","email":"test@mail.com","signerAddr":"${SESS_ADDR}"}`,
        Subject: `WalletCreated::${SESS_ADDR}`,
        TopicArn: 'topicArn',
      });
      done();
    }).catch(done);
  });

  afterEach(() => {
    if (sdb.getAttributes.restore) sdb.getAttributes.restore();
    if (sdb.putAttributes.restore) sdb.putAttributes.restore();
    if (sdb.deleteAttributes.restore) sdb.deleteAttributes.restore();
    if (sdb.select.restore) sdb.select.restore();
    if (recaptcha.verify.restore) recaptcha.verify.restore();
    if (sns.publish.restore) sns.publish.restore();
    if (ses.sendEmail.restore) ses.sendEmail.restore();
  });
});

describe('Account Manager - reset Wallet ', () => {
  it('should prevent reset with create session.', () => {
    const manager = new AccountManager(null, null, null, null, null, SESS_PRIV);

    const receipt = new Receipt().createConf(ACCOUNT_ID).sign(SESS_PRIV);
    try {
      manager.resetWallet(receipt, {});
    } catch (err) {
      expect(err.message).to.contain('Forbidden: Wallet operation forbidden with session type');
    }
  });

  it('should allow to reset Wallet.', (done) => {
    sinon.stub(sns, 'publish').yields(null, {});
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [
      { Name: 'wallet', Value: '{"address": "0x1234"}' },
    ] });
    sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
    const manager = new AccountManager(new Db(sdb), null, null, sns, 'topicArn', SESS_PRIV);

    const receipt = new Receipt().resetConf(ACCOUNT_ID).sign(SESS_PRIV);
    const wallet = `{ "address": "${SESS_ADDR}" }`;
    manager.resetWallet(receipt, wallet).then(() => {
      expect(sdb.getAttributes).calledWith({ DomainName: 'ab-accounts', ItemName: ACCOUNT_ID });
      expect(sdb.putAttributes).calledWith({
        Attributes: [{ Name: 'wallet', Replace: true, Value: wallet }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID,
      });
      expect(sns.publish).callCount(1);
      expect(sns.publish).calledWith({
        Message: `{"accountId":"${ACCOUNT_ID}","oldSignerAddr":"0x1234","newSignerAddr":"${SESS_ADDR}"}`,
        Subject: `WalletReset::${SESS_ADDR}`,
        TopicArn: 'topicArn',
      });
      done();
    }).catch(done);
  });

  afterEach(() => {
    if (sdb.getAttributes.restore) sdb.getAttributes.restore();
    if (sdb.putAttributes.restore) sdb.putAttributes.restore();
    if (sdb.deleteAttributes.restore) sdb.deleteAttributes.restore();
    if (sdb.select.restore) sdb.select.restore();
    if (recaptcha.verify.restore) recaptcha.verify.restore();
    if (sns.publish.restore) sns.publish.restore();
    if (ses.sendEmail.restore) ses.sendEmail.restore();
  });
});

describe('Account Manager - congfirm email ', () => {
  it('should allow to confirm email.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [
      { Name: 'pendingEmail', Value: TEST_MAIL },
    ] });
    sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
    sinon.stub(sdb, 'deleteAttributes').yields(null, { ResponseMetadata: {} });
    const manager = new AccountManager(new Db(sdb), null, null, sns, 'topicArn', SESS_PRIV);

    const receipt = new Receipt().createConf(ACCOUNT_ID).sign(SESS_PRIV);
    manager.confirmEmail(receipt).then(() => {
      expect(sdb.getAttributes).calledWith({ DomainName: 'ab-accounts', ItemName: ACCOUNT_ID });
      expect(sdb.putAttributes).calledWith({
        Attributes: [{ Name: 'email', Replace: true, Value: TEST_MAIL }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID,
      });
      expect(sdb.deleteAttributes).calledWith({
        Attributes: [{ Name: 'pendingEmail' }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID,
      });
      done();
    }).catch(done);
  });

  it('should prevent confirming old email token.', () => {
    const before3Hours = (Date.now() / 1000) - (60 * 60 * 3);
    const manager = new AccountManager(null, null, null, null, null, SESS_PRIV);

    const receipt = new Receipt().createConf(ACCOUNT_ID, before3Hours).sign(SESS_PRIV);
    try {
      manager.confirmEmail(receipt);
    } catch (err) {
      expect(err.message).to.contain('Unauthorized: session expired since');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should error on unknown email token.', (done) => {
    const token = '65e95013-ac29-4ee9-a1fa-5e712e0178a5';
    sinon.stub(sdb, 'getAttributes').yields(null, { Items: [] });
    const manager = new AccountManager(new Db(sdb), null, null, null, null, SESS_PRIV);

    const receipt = new Receipt().createConf(token).sign(SESS_PRIV);
    manager.confirmEmail(receipt).catch((err) => {
      expect(err.message).to.contain('Not Found:');
      done();
    }).catch(done);
  });

  it('should error on invalid email token.', () => {
    const manager = new AccountManager();

    const token = '0:ZelQE6wpTumh-l5xLgF4pQ';
    try {
      manager.confirmEmail(token);
    } catch (err) {
      expect(err.message).to.contain('Unauthorized: invalid session');
      return;
    }
    throw new Error('should have thrown');
  });

  afterEach(() => {
    if (sdb.getAttributes.restore) sdb.getAttributes.restore();
    if (sdb.putAttributes.restore) sdb.putAttributes.restore();
    if (sdb.deleteAttributes.restore) sdb.deleteAttributes.restore();
    if (sdb.select.restore) sdb.select.restore();
    if (recaptcha.verify.restore) recaptcha.verify.restore();
    if (sns.publish.restore) sns.publish.restore();
    if (ses.sendEmail.restore) ses.sendEmail.restore();
  });
});

describe('Account Manager - referrals ', () => {
  it('should return 420 when global limit reached.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [
      { Name: 'allowance', Value: '0' },
      { Name: 'account', Value: ACCOUNT_ID },
    ] });
    const manager = new AccountManager(new Db(sdb));

    manager.getRef('11223344').catch((err) => {
      expect(err.message).to.contain('Enhance Your Calm: ');
      done();
    }).catch(done);
  });

  it('should return 404 when ref code unknown.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {});
    const manager = new AccountManager(new Db(sdb));

    manager.getRef('11223344').catch((err) => {
      expect(err.message).to.contain('Not Found: ');
      done();
    }).catch(done);
  });

  it('should return 400 when ref code invalid.', () => {
    sinon.stub(sdb, 'getAttributes').yields(null, {});
    const manager = new AccountManager(new Db(sdb));
    try {
      manager.getRef('----');
    } catch (err) {
      expect(err.message).to.contain('Bad Request: ');
      return;
    }
    throw new Error('should have thrown');
  });


  it('should return 418 when account limit reached.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [
      { Name: 'allowance', Value: '1' },
      { Name: 'account', Value: ACCOUNT_ID },
    ] }).onFirstCall().yields(null, { Attributes: [
      { Name: 'allowance', Value: '0' },
      { Name: 'account', Value: ACCOUNT_ID },
    ] });
    const manager = new AccountManager(new Db(sdb));

    manager.getRef('11223344').catch((err) => {
      expect(err.message).to.contain('Teapot: ');
      done();
    }).catch(done);
  });

  it('should allow to check referral code.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [
      { Name: 'allowance', Value: '1' },
      { Name: 'account', Value: ACCOUNT_ID },
    ] });

    const manager = new AccountManager(new Db(sdb));

    manager.getRef('11223344').then((rsp) => {
      expect(rsp.defaultRef).to.eql(ACCOUNT_ID);
      done();
    }).catch(done);
  });

  it('should allow to check global referral code.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {})
    .onFirstCall().yields(null, { Attributes: [
      { Name: 'allowance', Value: '1' },
      { Name: 'account', Value: ACCOUNT_ID },
    ] });

    const manager = new AccountManager(new Db(sdb));

    manager.getRef('00000000').then((rsp) => {
      expect(rsp.defaultRef).to.eql(ACCOUNT_ID);
      done();
    }).catch(done);
  });

  it('should allow to check global referral code when invites closed.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {})
    .onFirstCall().yields(null, { Attributes: [
      { Name: 'allowance', Value: '1' },
      { Name: 'account', Value: '-' },
    ] });

    const manager = new AccountManager(new Db(sdb));

    manager.getRef('00000000').then((rsp) => {
      expect(rsp).to.eql({});
      done();
    }).catch(done);
  });

  afterEach(() => {
    if (sdb.getAttributes.restore) sdb.getAttributes.restore();
    if (sdb.putAttributes.restore) sdb.putAttributes.restore();
    if (sdb.select.restore) sdb.select.restore();
  });
});
