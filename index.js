'use strict';
var https = require('https');
var fs = require('fs');
var util = require('util');
var envvar = require('envvar');
var express = require('express');
var bodyParser = require('body-parser');
var moment = require('moment');
// Stripe Keys
//
//sk_test_
//pk_test_
//sk_live_
//pk_live_
//test customer id: cus_ANjLfuBWFXthGb
// Set your secret key: remember to change this to your live secret key in production
// See your keys here: https://dashboard.stripe.com/account/apikeys
var stripe = require("stripe")("sk_test_<yourKeyHere>");
//https://plaid.com/docs/api/#introduction
var plaid = require('plaid');
// Plaid Keys
//
// client_id: 58bc3c804e95b85ea6192d04
// public_key: ee366dd21e1802accf5bc7520e9296
// secret: be4ed1d9d20f5f163092e948683fae
var APP_PORT = envvar.number('APP_PORT', 8000);
var PLAID_CLIENT_ID = envvar.string('PLAID_CLIENT_ID', 'yourKeyHere');
var PLAID_SECRET = envvar.string('PLAID_SECRET', 'yourKeyHere');
var PLAID_PUBLIC_KEY = envvar.string('PLAID_PUBLIC_KEY', 'yourKeyHere');
var PLAID_ENV = envvar.string('PLAID_ENV', 'sandbox'); //production || sandbox
// Initialize the Plaid client
var client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments[PLAID_ENV]
);
// We store the access_token in memory
// in production, store it in a secure persistent data store
var ACCESS_TOKEN = null;
var PUBLIC_TOKEN = null;
var ACCOUNT_ID = null;
var CUSTOMER_ID = null;
var CUSTOMER = null;
var INVOICES = null;
var STRIPE_BANK_ACCOUNT_TOKEN = null;


// Server
var app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());


// Server Init
app.get('/', function(request, response, next) {
  CUSTOMER_ID = request.query.customer || null;
  // Reset global vars
  ACCESS_TOKEN = null;
  PUBLIC_TOKEN = null;
  ACCOUNT_ID = null;
  CUSTOMER = null;
  INVOICES = null;
  STRIPE_BANK_ACCOUNT_TOKEN = null;
  // Get Stripe Customer information
  // Get Stripe Customer Invoices

  response.render('index.ejs', {
    PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
    PLAID_ENV: PLAID_ENV,
    CUSTOMER: CUSTOMER,
    INVOICES: INVOICES,
  });
});


// Get Stripe Customer Invoices
app.get('/get_customer_invoices', function(request, response, next) {
  stripe.invoices.list({
    customer: CUSTOMER_ID
  }, function(error, invoices) {
    if (error != null) {
      var msg = 'Couldnt get Customer Invoices';
      console.log(msg + '\n' + error);
      return response.json({
        error: msg
      });
    }
    console.log('customer invoices ' + util.inspect(invoices, false, null));
    INVOICES = invoices;
    return response.json(CUSTOMER);
  });
});


// Get Stripe Customer information
app.get('/get_customer_info', function(request, response, next) {
  stripe.customers.retrieve(
    CUSTOMER_ID,
    function(error, customer) {
      if (error != null) {
        var msg = 'Couldnt get Customer Data';
        console.log(msg + '\n' + error);
        return response.json({
          error: msg
        });
      }
      console.log('customer' + util.inspect(customer, false, null));
      CUSTOMER = customer;
      return response.json(CUSTOMER);
    }
  );
});


// Add Bank Account Source to Stripe
// https://stripe.com/docs/api/node#customer_create_bank_account
app.post('/add_bank', function(request, response, next) {
  stripe.customers.createSource(CUSTOMER_ID,
    { source: STRIPE_BANK_ACCOUNT_TOKEN },
    function(error, payment_source) {
      if (error != null) {
        var msg = 'Your Bank Account could not be added.';
        console.log(msg + '\n' + error);
        return response.json({
          error: msg + '\n' + error
        });
      }
      console.log('Bank Account Added: ' + util.inspect(payment_source, false, null));
      response.json({
        success: 'Your Bank Account has been successfully added.'
      });
    }
  );
});


// Get Plaid Access Token
app.post('/get_access_token', function(request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;
  ACCOUNT_ID = request.body.account_id;
  // Get Access Token
  client.exchangePublicToken(PUBLIC_TOKEN, function(error, tokenResponse) {
    if (error != null) {
      var msg = 'Could not exchange public_token!';
      console.log(msg + '\n' + error);
      return response.json({
        error: msg + '\n' + error
      });
    }
    ACCESS_TOKEN = tokenResponse.access_token;
    console.log('Access Token: ' + util.inspect(ACCESS_TOKEN, false, null));
    response.json({
      success: 'You have successfully logged into your Bank Account to grant Threde LLC access to the following account.'
    });
    // Get Stripe Bank Account Token via Plaid ACCESS_TOKEN
    // /processor/stripe/bank_account_token/create
  });
});


// Set Plaid Access Token
app.post('/set_access_token', function(request, response, next) {
  ACCESS_TOKEN = request.body.access_token;
  console.log('Access Token: ' + ACCESS_TOKEN);
  response.json({
    success: 'You have successfully logged into your Bank Account and choisen which account to grant Threde access.'
  });
});


// Set Plaid Stripe Bank Account Token
// https://github.com/plaid/plaid-node/blob/904891f1c90311d8527721a10e4e6d387b794d0b/lib/PlaidClient.js#L146
app.post('/verify_bank', function(request, response, next) {
  client.createProcessorToken(ACCESS_TOKEN, ACCOUNT_ID, 'stripe', function(error, tokenResponse){
    if (error != null) {
      var msg = 'Unable to get Stripe Bank Account Token from the Plaid API.';
      console.log(msg + '\n' + error);
      return response.json({
        error: msg + '\n' + error
      });
    }
    STRIPE_BANK_ACCOUNT_TOKEN = tokenResponse.stripe_bank_account_token
    console.log('Stripe Banke Account Token: ' + util.inspect(STRIPE_BANK_ACCOUNT_TOKEN, false, null));
    response.json({
      success: 'You have successfully verified which Bank Account to grant Threde access'
    });
  })
});


// Get Plaid Bank Accounts
app.get('/accounts', function(request, response, next) {
  // Retrieve high-level account information and account and routing numbers
  // for each account associated with the Item.
  client.getAuth(ACCESS_TOKEN, function(error, authResponse) {
    if (error != null) {
      var msg = 'Unable to pull accounts from the Plaid API.';
      console.log(msg + '\n' + error);
      return response.json({
        error: msg
      });
    }
    console.log(authResponse.accounts);
    response.json({
      accounts: authResponse.accounts,
      numbers: authResponse.numbers,
    });
  });
});


// Get Plaid Items
app.post('/item', function(request, response, next) {
  // Pull the Item - this includes information about available products,
  // billed products, webhook information, and more.
  client.getItem(ACCESS_TOKEN, function(error, itemResponse) {
    if (error != null) {
      console.log(JSON.stringify(error));
      return response.json({
        error: error
      });
    }
    // Also pull information about the institution
    client.getInstitutionById(itemResponse.item.institution_id, function(err, instRes) {
      if (err != null) {
        var msg = 'Unable to pull institution information from the Plaid API.';
        console.log(msg + '\n' + error);
        return response.json({
          error: msg
        });
      } else {
        response.json({
          item: itemResponse.item,
          institution: instRes.institution,
        });
      }
    });
  });
});


// Get Plaid Transactions
app.post('/transactions', function(request, response, next) {
  // Pull transactions for the Item for the last 30 days
  var startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
  var endDate = moment().format('YYYY-MM-DD');
  client.getTransactions(ACCESS_TOKEN, startDate, endDate, {
    count: 250,
    offset: 0,
  }, function(error, transactionsResponse) {
    if (error != null) {
      console.log(JSON.stringify(error));
      return response.json({
        error: error
      });
    }
    console.log('pulled ' + transactionsResponse.transactions.length + ' transactions');
    response.json(transactionsResponse);
  });
});


app.get('/test', function(request, response, next) {
  response.json({
                  access:ACCESS_TOKEN,
                  public:PUBLIC_TOKEN,
                  account_id:ACCOUNT_ID,
                  customer_id:CUSTOMER_ID,
                  stripe_bank_account_token: STRIPE_BANK_ACCOUNT_TOKEN
                });
});

var server = app.listen(APP_PORT, function() {
  console.log('stripe plaid server listening on port ' + APP_PORT);
});

// var options = {
//     key  : fs.readFileSync('ssl/key.pem'),
//     ca   : fs.readFileSync('ssl/csr.pem'),
//     cert : fs.readFileSync('ssl/cert.pem')
// };
//
// https.createServer(options, app).listen(APP_PORT, HOST, null, function() {
//     console.log('stripe plaid server listening on port %d in %s mode', this.address().port, app.settings.env);
// });
