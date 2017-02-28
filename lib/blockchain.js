const ethUtil = require('ethereumjs-util');

function Blockchain (provider, factoryAddress) {
  this.provider = provider;
  this.factoryAddress = factoryAddress;
}

Blockchain.prototype.createAccount = function(signerAddress) {
  var self = this;
  var contract = this.provider.getFactory(this.factoryAddress);
  return new Promise(function (fulfill, reject) {
    contract.create.sendTransaction(signerAddress, self.provider.getAddress(), 259200, {from: self.provider.getAddress(), gas: 2000000}, function(err, val){
      if (err) {
        console.log(JSON.stringify(err));
        reject(JSON.stringify(err));
        return;
      }
      fulfill(val);
    });
  });  
}

module.exports = Blockchain;