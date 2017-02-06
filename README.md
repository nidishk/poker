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
curl -X GET/POST -H "Content-Type: application/json" -d
'{
  "email": "test@mail.com"
}'
https://spwna9usel.execute-api.eu-west-1.amazonaws.com/v0/query
```
