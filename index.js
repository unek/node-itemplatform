var request = require('request');
var util = require('util');
var crypto = require('crypto');

var getRawBody = require('raw-body')

var EventEmitter = require('events');

var ItemPlatform = module.exports = function (config) {
  EventEmitter.call(this);

  this.account_id = config.account_id;

  this.token_username = config.token_username;
  this.token_secret = config.token_secret;

  this.webhook_hmac = config.webhook_hmac;
}
util.inherits(ItemPlatform, EventEmitter);

ItemPlatform.prototype._call = function (options, callback) {
  options.method = options.method || 'get';

  return request[options.method]({
    uri: 'https://my.webmini.com/api/v1/itemplatform' + (options.no_account_id ? '' : ('/' + this.account_id)) + options.uri,
    json: true,
    headers: {
      'User-Agent': 'node-itemplatform'
    },
    auth: {
      user: this.token_username,
      pass: this.token_secret
    },
    body: options.method != 'get' ? options.params : undefined,
    qs: options.method == 'get' ? options.params : undefined
  }, function (err, response, body) {
    if (err) {
      callback(err);
      return;
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      callback(null, body);
      return;
    }

    callback(new Error(body ? body.message : response.statusCode));
  });
}

ItemPlatform.prototype.getInventory = function (trade_url, game, extensive, callback) {
  if (typeof extensive == 'function')
    callback = extensive;

  return this._call({
    uri: '/external/items',
    params: {
      tradeurl: trade_url,
      game: game,
      extensive: typeof extensive !== 'function' ? !!extensive : false
    },
    no_account_id: true
  }, callback);
}

ItemPlatform.prototype.getItems = function (callback) {
  return this._call({
    uri: '/items'
  }, callback);
}

ItemPlatform.prototype.deposit = function (trade_url, items, allow_escrow, callback) {
  if (typeof allow_escrow == 'function')
    callback = allow_escrow;

  return this._call({
    method: 'post',
    uri: '/deposits',
    params: {
      tradeurl: trade_url,
      items: items,
      escrow: typeof allow_escrow !== 'function' ? !!allow_escrow : true
    }
  }, callback);
}

ItemPlatform.prototype.withdraw = function (trade_url, item_ids, callback) {
  return this._call({
    method: 'post', 
    uri: '/withdrawals',
    params: {
      tradeurl: trade_url,
      items: item_ids
    }
  }, callback);
}

ItemPlatform.prototype.getDeposit = function (id, callback) {
  return this._call({
    uri: '/deposits/' + id,
    no_account_id: true
  }, callback);
}

ItemPlatform.prototype.getWithdrawal = function (id, callback) {
  return this._call({
    uri: '/withdrawals/' + id,
    no_account_id: true
  }, callback);
}

ItemPlatform.prototype.webhook = function (webhook_hmac) {
  var self = this;

  return function (req, res, next) {
    getRawBody(req, {encoding: 'utf-8'}, function (err, body) {
      if (err) throw new Error('Could not handle webhook: ' + err.message);

      // verify hmac
      if (webhook_hmac || self.webhook_hmac) {
        var signature = req.headers['x-webmini-signature'].split('=');
        var hmac = crypto.createHmac(signature[0], webhook_hmac || self.webhook_hmac);
        hmac.setEncoding('hex');
        hmac.write(body);
        hmac.end();

        if (signature[1] !== hmac.read()) return;
      }

      var data = JSON.parse(body);

      self.emit(req.headers['x-webmini-event'], data)
    });
  }
}
