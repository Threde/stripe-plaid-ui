### stripe-plaid-node quickstart

[Plaid Stripe Integration Docs](https://plaid.com/docs/link/stripe/)
[Plaid Link Quickstart Guide](https://plaid.com/docs/quickstart)

To test, create a stripe and plaid account. Connect the both.
Your stripe account has to be in test mode.
In stripe's UI create a new customer and copy the ID for the url:
http://localhost:8000/?customer={customer id}

Click on "Link Account", select a bank account, verify the bank account, add the bank account.
You will then see the bank account as been verified on the back-end ( in stripe.com)

``` bash
npm install
node index.js

# Go to http://localhost:8000
#
# For SandBox Testing
# user: usr_good
# password: pass_good
#
# url for customer: http://localhost:8000/?customer={customer id}
#
# TO see Token response on client, otherwise run node --inspect index.js
$.get('/test', function(d) {console.log(d);});
```
