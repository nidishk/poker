const FACTORY_ABI = [{ constant: true, inputs: [{ name: '_proxy', type: 'address' }], name: 'getSigner', outputs: [{ name: '', type: 'address' }], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_signer', type: 'address' }, { name: '_lockAddr', type: 'address' }], name: 'create', outputs: [], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_newSigner', type: 'address' }], name: 'handleRecovery', outputs: [], payable: false, type: 'function' }, { constant: true, inputs: [{ name: '_signer', type: 'address' }], name: 'getAccount', outputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }, { name: '', type: 'bool' }], payable: false, type: 'function' }, { anonymous: false, inputs: [{ indexed: true, name: 'signer', type: 'address' }, { indexed: false, name: 'proxy', type: 'address' }], name: 'AccountCreated', type: 'event' }, { anonymous: false, inputs: [{ indexed: true, name: 'newSigner', type: 'address' }, { indexed: false, name: 'proxy', type: 'address' }, { indexed: false, name: 'oldSigner', type: 'address' }], name: 'AccountRecovered', type: 'event' }];

function FactoryContract(web3, factoryAddr) {
  this.web3 = web3;
  this.factoryAddr = factoryAddr;
}

FactoryContract.prototype.getAccount = function getAccount(signerAddr) {
  const contract = this.web3.eth.contract(FACTORY_ABI).at(this.factoryAddr);
  return new Promise((fulfill, reject) => {
    contract.getAccount.call(signerAddr, (err, val) => {
      if (err) {
        reject(err);
        return;
      }
      fulfill({
        proxy: val[0],
        owner: val[1],
        isLocked: val[2],
      });
    });
  });
};

module.exports = FactoryContract;
