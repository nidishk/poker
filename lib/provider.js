const Web3 = require('web3');
const ProviderEngine = require('web3-provider-engine');
const CacheSubprovider = require('web3-provider-engine/subproviders/cache.js');
const FixtureSubprovider = require('web3-provider-engine/subproviders/fixture.js');
const FilterSubprovider = require('web3-provider-engine/subproviders/filters.js');
const RpcSubprovider = require('web3-provider-engine/subproviders/rpc.js');
const HookedWalletSubprovider = require('web3-provider-engine/subproviders/hooked-wallet.js');
const NonceSubprovider = require('web3-provider-engine/subproviders/nonce-tracker.js');
const wallet = require('eth-lightwallet');


const pwDerivedKey = new Uint8Array([215,152,86,175,5,168,43,177,135,97,218,89,136,5,110,93,193,114,94,197,247,212,127,83,200,150,255,124,17,245,91,10]);
const factoryAbi = [{ constant: false, inputs: [{ name: '_oldSigner', type: 'address' }, { name: '_newSigner', type: 'address' }], name: 'handleRecovery', outputs: [], payable: false, type: 'function' }, { constant: true, inputs: [{ name: '', type: 'address' }], name: 'signerToController', outputs: [{ name: '', type: 'address' }], payable: false, type: 'function' }, { constant: true, inputs: [{ name: '', type: 'address' }], name: 'signerToProxy', outputs: [{ name: '', type: 'address' }], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_signer', type: 'address' }, { name: '_proxy', type: 'address' }, { name: '_controller', type: 'address' }], name: 'register', outputs: [], payable: false, type: 'function' }, { constant: true, inputs: [{ name: '_signer', type: 'address' }], name: 'getAccount', outputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }, { name: '', type: 'uint96' }], payable: false, type: 'function' }, { constant: false, inputs: [{ name: '_signer', type: 'address' }, { name: '_recovery', type: 'address' }, { name: '_timeLock', type: 'uint256' }], name: 'create', outputs: [], payable: false, type: 'function' }, { anonymous: false, inputs: [{ indexed: true, name: 'signer', type: 'address' }, { indexed: false, name: 'proxy', type: 'address' }, { indexed: false, name: 'controller', type: 'address' }, { indexed: false, name: 'recovery', type: 'address' }], name: 'AccountCreated', type: 'event' }, { anonymous: false, inputs: [{ indexed: true, name: 'newSigner', type: 'address' }, { indexed: false, name: 'proxy', type: 'address' }, { indexed: false, name: 'oldSigner', type: 'address' }], name: 'AccountRecovered', type: 'event' }, { anonymous: false, inputs: [{ indexed: false, name: 'code', type: 'uint256' }], name: 'Error', type: 'event' }];

function Provider (rpcUrl, secret) {
  var engine = new ProviderEngine();
  var web3 = new Web3(engine);
  
  engine.addProvider(new FixtureSubprovider({
    web3_clientVersion: 'ProviderEngine/v0.0.0/javascript',
    net_listening: true,
    eth_hashrate: '0x00',
    eth_mining: false,
    eth_syncing: true,
  }));

  // cache layer
  engine.addProvider(new CacheSubprovider());

  // filters 
  //engine.addProvider(new FilterSubprovider())

  // pending nonce
  engine.addProvider(new NonceSubprovider());

  // vm
  //engine.addProvider(new VmSubprovider());

  if (secret) {
    var ks;
    if (secret && secret.length > 70) {
      ks = new wallet.keystore(secret, pwDerivedKey);
      ks.generateNewAddress(pwDerivedKey, 1);
    } else if (secret) {
      ks = new wallet.keystore();
      ks.addPriv = function(privkeyHex) {
        var privKey = new Buffer(privkeyHex.replace('0x',''), 'hex');
        var encPrivKey = wallet.keystore._encryptKey(privKey, pwDerivedKey);
        var address = wallet.keystore._computeAddressFromPrivKey(privKey);
        this.ksData["m/0'/0'/0'"].encPrivKeys[address] = encPrivKey;
        this.ksData["m/0'/0'/0'"].addresses.push(address);
      };
      ks.isDerivedKeyCorrect = function(pwDerivedKey) {
        if (!this.encSeed)
          return true;
        var paddedSeed = KeyStore._decryptString(this.encSeed, pwDerivedKey);
        if (paddedSeed.length > 0) {
          return true;
        }
        return false;
      };
      ks.addPriv(secret);
    }

    var addr = '0x' + ks.getAddresses()[0];

    engine.addProvider(new HookedWalletSubprovider({
      getAccounts: function(cb) {
        cb(null, [addr]);
      },
      approveTransaction: function(txParams, cb) {
        cb(null, true);
      },
      signTransaction: function(txData, cb) {
        txData.gasPrice = parseInt(txData.gasPrice, 16);
        txData.nonce = parseInt(txData.nonce, 16);
        txData.gasLimit = txData.gas;
        var tx = wallet.txutils.createContractTx(addr, txData);
        var signed = wallet.signing.signTx(ks, pwDerivedKey, tx.tx, addr);
        cb(null, signed);
      }
    }));
  }

  engine.addProvider(new RpcSubprovider({
    rpcUrl: rpcUrl,
  }));
  engine.start();

  this.web3 = web3;
  this.address = addr;
}

Provider.prototype.getFactory = function (factoryAddr) {
  return this.web3.eth.contract(factoryAbi).at(factoryAddr);
}

Provider.prototype.getWeb3 = function () {
  return this.web3;
}

Provider.prototype.getAddress = function () {
  return this.address;
}

module.exports = Provider;
