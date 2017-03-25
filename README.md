## Poker Account Service

- createAccount(accountId, email, wallet); -> 200

- confirmEmail(token); -> 200

- queryAccount(email); -> 200


## Usage

### Creat Account

```
curl -X POST -H "Content-Type: application/json" -d
'{
  "email": "test@mail.com",
  "wallet": {},
}'
https://spwna9usel.execute-api.eu-west-1.amazonaws.com/v0/account/5092a8db-bfee-43b2-a8f4-ccb54449808c
```

### Verify Email

```
curl -X POST -H "Content-Type: application/json" -d
'{
  "token": "c19949e0-8150-430a-868e-b35fe5ecc959"
}'
https://spwna9usel.execute-api.eu-west-1.amazonaws.com/v0/confirm
```


### Get Account

```
curl -X POST -H "Content-Type: application/json" -d
'{
  "email": "test@mail.com"
}'
https://spwna9usel.execute-api.eu-west-1.amazonaws.com/v0/query
```


### Notes

f536df6d804579d83b550ecff5039f5d




watch this one: https://github.com/SilentCicero/redux-contract

https://github.com/DigixGlobal/web3-redux/tree/v2


projects:

https://github.com/amiller/instant-poker
https://github.com/ethereum/EIPs/pull/212

https://github.com/cryptofiat/contract

https://everex.one/


https://github.com/melonproject/melon
https://github.com/sonm-io



nohup 

nohup geth --identity "Acebesturs" --ipcdisable --rpc --rpcaddr="0.0.0.0" --rpcport="8545" --rpccorsdomain="*" --datadir "/home/ubuntu/.ethereum/abNet" --port "30303" --nodiscover --autodag --mine --targetgaslimit 3000000 --unlock 0x297d02da6733fc66d260dd6956cff04d2d030855 --password /home/ubuntu/.ethereum/worker.pw --networkid "1234" console 2>>geth.log &

geth --identity "Acebesturs" --ipcdisable --rpc --rpcaddr="0.0.0.0" --rpcport="8545" --rpccorsdomain="*" --datadir "/home/ubuntu/.ethereum/abNet" --port "30303" --nodiscover --autodag --mine --targetgaslimit 4700000 --unlock 0x297d02da6733fc66d260dd6956cff04d2d030855 --password /home/ubuntu/.ethereum/worker.pw --networkid "1234" console 2>>geth.log