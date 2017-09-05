import Contract from './contract';
import { NotFound, BadRequest } from './errors';

const FACTORY_ABI = [{ constant: true, inputs: [{ name: '_proxy', type: 'address' }], name: 'getSigner', outputs: [{ name: '', type: 'address' }], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_signer', type: 'address' }, { name: '_lockAddr', type: 'address' }], name: 'create', outputs: [], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_newSigner', type: 'address' }], name: 'handleRecovery', outputs: [], payable: false, type: 'function' }, { constant: true, inputs: [{ name: '_signer', type: 'address' }], name: 'getAccount', outputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }, { name: '', type: 'bool' }], payable: false, type: 'function' }, { anonymous: false, inputs: [{ indexed: true, name: 'signer', type: 'address' }, { indexed: false, name: 'proxy', type: 'address' }], name: 'AccountCreated', type: 'event' }, { anonymous: false, inputs: [{ indexed: true, name: 'newSigner', type: 'address' }, { indexed: false, name: 'proxy', type: 'address' }, { indexed: false, name: 'oldSigner', type: 'address' }], name: 'AccountRecovered', type: 'event' }];

export default class FactoryContract extends Contract {
  constructor(web3, factoryAddr) {
    super(web3);
    this.contract = this.web3.eth.contract(FACTORY_ABI).at(factoryAddr);
  }

  getAccount(signerAddr) {
    return this.call(this.contract.getAccount.call, signerAddr).then((val) => {
      const proxy = val[0];
      const owner = val[1];
      const isLocked = val[2];
      if (proxy === '0x') {
        throw new NotFound(`no proxy contract found for signer ${signerAddr}`);
      }
      if (!isLocked) {
        throw new BadRequest(`${proxy} is an unlocked account. send tx with ${owner}`);
      }
      return { proxy, owner, isLocked };
    });
  }
}
