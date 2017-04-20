import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import { it, describe, afterEach } from 'mocha';
import Db from './src/db';
import Email from './src/email';
import AccountManager from './src/index';
import { BadRequest } from './src/errors';

chai.use(sinonChai);

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

const ACCOUNT_ID = '357e44ed-bd9a-4370-b6ca-8de9847d1da8';
const TEST_MAIL = 'test@mail.com';


describe('Account Manager', () => {
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

    const manager = new AccountManager(new Db(sdb), null, recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).catch((err) => {
      expect(err.message).to.contain('Conflict: ');
      expect(err.message).to.contain(ACCOUNT_ID);
      done();
    }).catch(done);
  });

  it('should fail on captcha error.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, { Attributes: [] });
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(recaptcha, 'verify').returns(Promise.reject(new BadRequest('wrong')));
    const manager = new AccountManager(new Db(sdb), null, recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).catch((err) => {
      expect(err.message).to.contain('Bad Request: ');
      done();
    }).catch(done);
  });

  it('should prevent to add existing email.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {});
    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: '123',
      Attributes: [
      { Name: 'Email', Value: TEST_MAIL },
      ] }] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).catch((err) => {
      expect(err.message).to.contain('Conflict: ');
      expect(err.message).to.contain(TEST_MAIL);
      done();
    }).catch(done);
  });

  it('should prevent to add existing pending email.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {});
    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: '123',
      Attributes: [
      { Name: 'pendingEmail', Value: TEST_MAIL },
      ] }] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).catch((err) => {
      expect(err.message).to.contain('Conflict: ');
      expect(err.message).to.contain(TEST_MAIL);
      done();
    }).catch(done);
  });

  it('should allow to add account.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {});
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const ses = { sendEmail() {} };
    sinon.stub(ses, 'sendEmail').yields(null, {});

    const manager = new AccountManager(new Db(sdb), new Email(ses), recaptcha);

    manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}).then(() => {
      expect(sdb.putAttributes).calledWith({
        Attributes: [
          { Name: 'created', Replace: true, Value: sinon.match.any },
          { Name: 'wallet', Replace: true, Value: { } },
          { Name: 'pendingToken', Replace: true, Value: sinon.match.any },
          { Name: 'pendingTime', Replace: true, Value: sinon.match.any },
          { Name: 'pendingEmail', Replace: true, Value: TEST_MAIL },
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


  it('should allow to confirm email.', (done) => {
    const token = '65e95013-ac29-4ee9-a1fa-5e712e0178a5';

    sinon.stub(sns, 'publish').yields(null, {});
    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: ACCOUNT_ID,
      Attributes: [
      { Name: 'pendingToken', Value: token },
      { Name: 'wallet', Value: '{"address": "0x1234"}' },
      { Name: 'pendingEmail', Value: TEST_MAIL },
      { Name: 'pendingTime', Value: new Date().toString() },
      ] }] });
    sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
    sinon.stub(sdb, 'deleteAttributes').yields(null, { ResponseMetadata: {} });

    const manager = new AccountManager(new Db(sdb), null, null, sns, 'topicArn');

    manager.confirmEmail(token).then((rv) => {
      expect(sdb.select).calledWith({
        SelectExpression: `select * from \`ab-accounts\` where pendingToken =  "${token}" limit 1`,
      });
      expect(sdb.putAttributes).calledWith({
        Attributes: [{ Name: 'email', Replace: true, Value: TEST_MAIL }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID,
      });
      expect(sdb.deleteAttributes).calledWith({
        Attributes: [{ Name: 'pendingEmail' }, { Name: 'pendingToken' }, { Name: 'pendingTime' }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID,
      });
      expect(sns.publish).callCount(1);
      expect(sns.publish).calledWith({
        Message: '{"accountId":"357e44ed-bd9a-4370-b6ca-8de9847d1da8","signerAddr":"0x1234"}',
        Subject: 'EmailConfirmed::0x1234',
        TopicArn: 'topicArn',
      });
      expect(rv).to.eql({ accountId: ACCOUNT_ID });
      done();
    }).catch(done);
  });

  it('should prevent confirming old email token.', (done) => {
    const token = '65e95013-ac29-4ee9-a1fa-5e712e0178a5';
    const created = new Date();
    created.setHours(created.getHours() - 3);

    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: ACCOUNT_ID,
      Attributes: [
      { Name: 'pendingToken', Value: token },
      { Name: 'pendingEmail', Value: TEST_MAIL },
      { Name: 'pendingTime', Value: created.toString() },
      ] }] });

    const manager = new AccountManager(new Db(sdb));

    manager.confirmEmail(token).catch((err) => {
      expect(err.message).to.contain('timed out.');
      done();
    }).catch(done);
  });

  it('should error on unknown email token.', (done) => {
    const token = '65e95013-ac29-4ee9-a1fa-5e712e0178a5';

    sinon.stub(sdb, 'select').yields(null, { Items: [] });

    const manager = new AccountManager(new Db(sdb));

    manager.confirmEmail(token).catch((err) => {
      expect(err.message).to.contain('Not Found:');
      done();
    }).catch(done);
  });

  it('should error on invalid email token.', () => {
    sinon.stub(sdb, 'select').yields(null, { Items: [] });
    const manager = new AccountManager(new Db(sdb));

    const token = '0:ZelQE6wpTumh-l5xLgF4pQ';
    try {
      manager.confirmEmail(token);
    } catch (err) {
      expect(err.message).to.contain('Bad Request:');
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
  });
});
