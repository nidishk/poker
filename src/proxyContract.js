import Contract from './contract';

const PROXY_ABI = [{ constant: false, inputs: [{ name: '_newOwner', type: 'address' }], name: 'transfer', outputs: [], payable: false, type: 'function' }, { constant: true, inputs: [], name: 'getOwner', outputs: [{ name: '', type: 'address' }], payable: false, type: 'function' }, { constant: true, inputs: [], name: 'isLocked', outputs: [{ name: '', type: 'bool' }], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_from', type: 'address' }, { name: '_value', type: 'uint256' }, { name: '_data', type: 'bytes' }], name: 'tokenFallback', outputs: [], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_r', type: 'bytes32' }, { name: '_s', type: 'bytes32' }, { name: '_pl', type: 'bytes32' }], name: 'unlock', outputs: [], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_destination', type: 'address' }, { name: '_value', type: 'uint256' }, { name: '_data', type: 'bytes' }], name: 'forward', outputs: [], payable: false, type: 'function' }, { inputs: [{ name: '_owner', type: 'address' }, { name: '_lockAddr', type: 'address' }], payable: false, type: 'constructor' }, { payable: true, type: 'fallback' }, { anonymous: false, inputs: [{ indexed: true, name: 'sender', type: 'address' }, { indexed: false, name: 'value', type: 'uint256' }], name: 'Deposit', type: 'event' }, { anonymous: false, inputs: [{ indexed: true, name: 'to', type: 'address' }, { indexed: false, name: 'value', type: 'uint256' }, { indexed: false, name: 'data', type: 'bytes' }], name: 'Withdrawal', type: 'event' }];

export default class ProxyContract extends Contract {

  forward(proxyAddr, destination, value, data, signerAddr) {
    const contract = this.web3.eth.contract(PROXY_ABI).at(proxyAddr);
    return this.sendTransaction(
      contract,
      'forward',
      200000,
      [destination, value, data],
      { signerAddr },
    );
  }

  getOwner(proxyAddr) {
    const contract = this.web3.eth.contract(PROXY_ABI).at(proxyAddr);
    return this.call(contract.getOwner.call);
  }

  isLocked(proxyAddr) {
    const contract = this.web3.eth.contract(PROXY_ABI).at(proxyAddr);
    return this.call(contract.isLocked.call);
  }

}
