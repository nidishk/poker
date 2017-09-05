import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import { it, describe, afterEach } from 'mocha';
import { Receipt } from 'poker-helper';
import Db from './src/db';
import Email from './src/email';
import AccountManager from './src/index';
import Factory from './src/factoryContract';
import ProxyContr from './src/proxyContract';
import { BadRequest } from './src/errors';

chai.use(sinonChai);

const globalRef = '00000000';
const EMPTY = '0x';
const ADDR1 = '0xe10f3d125e5f4c753a6456fc37123cf17c6900f2';
const ADDR2 = '0xc3ccb3902a164b83663947aff0284c6624f3fbf2';

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

const sqs = {
  sendMessage() {},
};

const contract = {
  forward: {
    getData() {},
    estimateGas() {},
  },
  getAccount: {
    call() {},
  },
};

const web3 = { eth: {
  contract() {},
  at() {},
} };

sinon.stub(web3.eth, 'contract').returns(web3.eth);
sinon.stub(web3.eth, 'at', address => ({ ...contract, address }));


describe('Account Manager - add account', () => {
  it('should fail adding account on invalid uuid.', async () => {
    const manager = new AccountManager(new Db({}));
    try {
      await manager.addAccount('123', TEST_MAIL, {});
    } catch (err) {
      expect(err.message).to.contain('Bad Request: ');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should reject invalid email.', async () => {
    const manager = new AccountManager(new Db({}));
    try {
      await manager.addAccount(ACCOUNT_ID, 'email@email', {});
    } catch (err) {
      expect(err.message).to.contain('email');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should fail on key conflict.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      { Name: 'account', Value: [ACCOUNT_ID] },
      ] });
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

  it('should prevent to add existing email.', async () => {
    sinon.stub(sdb, 'getAttributes').yields(null, {}).onFirstCall().yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      { Name: 'account', Value: [ACCOUNT_ID] },
      ] });
    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: '123',
      Attributes: [
      { Name: 'Email', Value: TEST_MAIL },
      ] }] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    try {
      await manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef);
    } catch (err) {
      expect(err.message).to.contain('Conflict: ');
      expect(err.message).to.contain(TEST_MAIL);
    }
  });

  it('should prevent to add existing pending email.', async () => {
    sinon.stub(sdb, 'getAttributes').yields(null, {}).onFirstCall().yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      { Name: 'account', Value: [ACCOUNT_ID] },
      ] });
    sinon.stub(sdb, 'select').yields(null, { Items: [{ Name: '123',
      Attributes: [
      { Name: 'pendingEmail', Value: TEST_MAIL },
      ] }] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    try {
      await manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef);
    } catch (err) {
      expect(err.message).to.contain('Conflict: ');
      expect(err.message).to.contain(TEST_MAIL);
    }
  });

  it('should prevent to signup when ref limit reached.', async () => {
    sinon.stub(sdb, 'getAttributes').yields(null, {}).onFirstCall().yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['0'] },
      ] });
    sinon.stub(sdb, 'select').yields(null, { Items: [] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    try {
      await manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef);
    } catch (err) {
      expect(err.message).to.contain('Teapot: ');
    }
  });

  it('should prevent to signup global ref, if deactivated.', async () => {
    sinon.stub(sdb, 'getAttributes').yields(null, {}).onFirstCall().yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      { Name: 'account', Value: ['-'] },
      ] });
    sinon.stub(sdb, 'select').yields(null, { Items: [] });
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());

    const manager = new AccountManager(new Db(sdb), null, recaptcha, null, null, SESS_PRIV);

    try {
      await manager.addAccount(ACCOUNT_ID, TEST_MAIL, {}, null, null, globalRef);
    } catch (err) {
      expect(err.message).to.contain('Bad Request: passed refCode 00000000');
    }
  });

  it('should allow to add account.', (done) => {
    sinon.stub(sdb, 'getAttributes').yields(null, {}).onFirstCall().yields(null, {
      Attributes: [
      { Name: 'allowance', Value: ['1'] },
      { Name: 'account', Value: [ACCOUNT_ID] },
      ] });
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
      { Name: 'wallet', Value: `{ "address": "${SESS_ADDR}" }` },
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

  it('should respond with success when email not found.', async () => {
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(recaptcha, 'verify').returns(Promise.resolve());
    sinon.stub(ses, 'sendEmail').yields(null, {});
    const manager = new AccountManager(new Db(sdb),
      new Email(ses), recaptcha, null, null, SESS_PRIV);

    await manager.resetRequest(TEST_MAIL, {});
  });

  it('should fail when captcha is not verified.', async () => {
    sinon.stub(sdb, 'select').yields(null, {});
    sinon.stub(recaptcha, 'verify').returns(Promise.reject('Wrong captcha'));
    sinon.stub(ses, 'sendEmail').yields(null, {});
    const manager = new AccountManager(new Db(sdb),
      new Email(ses), recaptcha, null, null, SESS_PRIV);

    try {
      await manager.resetRequest(TEST_MAIL, {});
    } catch (e) {
      expect(e).eq('Wrong captcha');
    }
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
    ] });
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

    const receipt = new Receipt().resetConf(ACCOUNT_ID, SESS_ADDR).sign(SESS_PRIV);
    const wallet = `{ "address": "${SESS_ADDR}" }`;
    manager.resetWallet(receipt, wallet).then(() => {
      expect(sdb.getAttributes).calledWith({ DomainName: 'ab-accounts', ItemName: ACCOUNT_ID });
      expect(sdb.putAttributes).calledWith({
        Attributes: [{ Name: 'wallet', Replace: true, Value: wallet }],
        DomainName: 'ab-accounts',
        ItemName: ACCOUNT_ID,
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


describe('Transaction forwarding', () => {
  it('should error on invalid receipt.', (done) => {
    const invalidReceipt = 'M4YP.q2nMwonzSBctgq6qrQP9R6t/4xWjUIp5a+QnbQyd+U0=.V2RkK7APB5zIwVA0SGFnQRhPO/gEEnLdCdGG+bYrjKo=.G93u/wARIjMAAAAOgujGz0LI0f+VlLF6P1DpShLMhg8=.AAAAAAAAAAABBBAAAAAAAAAAAAAAAAAAAAAAAAAB1MA=.ESIzRA==';

    new AccountManager().forward(invalidReceipt).catch((err) => {
      expect(err).to.contain('Bad Request: ');
      done();
    }).catch(done);
  });

  it('should handle non existing signer in factory.', async () => {
    const forwardReceipt = 'M4YP.q2nMwonzSBctgq6qrQP9R6t/4xWjUIp5a+QnbQyd+U0=.V2RkK7APB5zIwVA0SGFnQRhPO/gEEnLdCdGG+bYrjKo=.G93u/wARIjMAAAAOgujGz0LI0f+VlLF6P1DpShLMhg8=.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1MA=.ESIzRA==';
    sinon.stub(contract.getAccount, 'call').yields(null, [EMPTY, EMPTY, false]);
    const factory = new Factory(web3, '0x1255', sqs, 'url');
    const proxy = new ProxyContr(web3, '0x1255', sqs, 'url');
    const manager = new AccountManager(null, null, null, null, null, null, factory, proxy);

    try {
      await manager.forward(forwardReceipt);
    } catch (err) {
      expect(err.message).to.contain('Not Found: ');
      expect(err.message).to.contain('no proxy');
    }
  });

  it('should fail on wrong owner.', async () => {
    const forwardReceipt = 'M4YP.q2nMwonzSBctgq6qrQP9R6t/4xWjUIp5a+QnbQyd+U0=.V2RkK7APB5zIwVA0SGFnQRhPO/gEEnLdCdGG+bYrjKo=.G93u/wARIjMAAAAOgujGz0LI0f+VlLF6P1DpShLMhg8=.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1MA=.ESIzRA==';
    sinon.stub(contract.getAccount, 'call').yields(null, [ADDR1, ADDR1, true]);
    const factory = new Factory(web3, '0x1255', sqs, 'url');
    const proxy = new ProxyContr(web3, '0x1255', sqs, 'url');
    const manager = new AccountManager(null, null, null, null, null, null, factory, proxy);

    try {
      await manager.forward(forwardReceipt);
    } catch (err) {
      expect(err.message).to.contain('Bad Request: ');
      expect(err.message).to.contain('wrong owner');
    }
  });

  it('should fail on unlocked account.', async () => {
    const forwardReceipt = 'M4YP.q2nMwonzSBctgq6qrQP9R6t/4xWjUIp5a+QnbQyd+U0=.V2RkK7APB5zIwVA0SGFnQRhPO/gEEnLdCdGG+bYrjKo=.G93u/wARIjMAAAAOgujGz0LI0f+VlLF6P1DpShLMhg8=.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1MA=.ESIzRA==';
    sinon.stub(contract.getAccount, 'call').yields(null, [ADDR1, EMPTY, false]);
    const factory = new Factory(web3, '0x1255', sqs, 'url');
    const proxy = new ProxyContr(web3, '0x1255', sqs, 'url');
    const manager = new AccountManager(null, null, null, null, null, null, factory, proxy);

    try {
      await manager.forward(forwardReceipt);
    } catch (err) {
      expect(err.message).to.contain('Bad Request: ');
      expect(err.message).to.contain('unlocked');
    }
  });

  it('should handle error in tx send.', (done) => {
    const forwardReceipt = 'M4YP.q2nMwonzSBctgq6qrQP9R6t/4xWjUIp5a+QnbQyd+U0=.V2RkK7APB5zIwVA0SGFnQRhPO/gEEnLdCdGG+bYrjKo=.G93u/wARIjMAAAAOgujGz0LI0f+VlLF6P1DpShLMhg8=.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1MA=.ESIzRA==';
    sinon.stub(contract.getAccount, 'call').yields(null, [ADDR1, ADDR2, true]);
    sinon.stub(contract.forward, 'estimateGas').yields(null, 80000000);
    const factory = new Factory(web3, ADDR2, sqs, 'url');
    const proxy = new ProxyContr(web3, ADDR2, sqs, 'url');
    const manager = new AccountManager(null, null, null, null, null, null, factory, proxy);

    manager.forward(forwardReceipt).catch((err) => {
      expect(err).to.contain('Error: ');
      done();
    }).catch(done);
  });

  it('should allow to send tx.', (done) => {
    const forwardReceipt = 'M3H7.MNZGDLtAeTTotcF1RaTQC9yxTG1v872In6Gsya76od8=.KFBvWNlOMlaQ4Ig2S8d7cC4sBru9Vrg7H2vcdoCKyhM=.G8vPm8PCpXAAAAAJ+MBn16c2YEpuxSOND1mmlhVVaEI=.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=.koQ4zQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB9AAAAAAAAAAAAAAAAAA+SccfDWbn6bznUytzcR/sW8cfsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA==';
    sinon.stub(contract.getAccount, 'call').yields(null, [ADDR1, ADDR2, true]);
    sinon.stub(contract.forward, 'getData').returns('0x112233');
    sinon.stub(contract.forward, 'estimateGas').yields(null, 100000);
    sinon.stub(sqs, 'sendMessage').yields(null, {});
    const factory = new Factory(web3, ADDR2, sqs, 'url');
    const proxy = new ProxyContr(web3, ADDR2, sqs, 'url');
    const manager = new AccountManager(null, null, null, null, null, null, factory, proxy);

    manager.forward(forwardReceipt).then(() => {
      expect(sqs.sendMessage).calledWith({
        MessageBody: `{"from":"${ADDR2}","to":"${ADDR1}","gas":120000,"data":"0x112233","signerAddr":"0x03e49c71f0d66e7e9bce7532b73711fec5bc71fb"}`,
        MessageGroupId: 'someGroup',
        QueueUrl: 'url',
      }, sinon.match.any);
      done();
    }).catch(done);
  });

  afterEach(() => {
    if (contract.forward.estimateGas.restore) contract.forward.estimateGas.restore();
    if (contract.getAccount.call.restore) contract.getAccount.call.restore();
    if (sqs.sendMessage.restore) sqs.sendMessage.restore();
  });
});
