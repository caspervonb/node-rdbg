var http = require('http');
var ws = require('ws');
var path = require('path');
var events = require('events');
var util = require('util');
var async = require('async');
var url = require('url');
var stream = require('stream');

function Client() {
  events.EventEmitter.call(this);

  this._socket = null;

  this._callbacks = [];
  this._counter = 0;
}

util.inherits(Client, events.EventEmitter);

Client.prototype.request = function(method, params, id, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = undefined;
  }

  if (typeof id === 'function') {
    callback = id;
    id = undefined;
  }

  if (params === undefined) {
    params = {};
  }

  if (id === undefined) {
    id = this._counter++;
  }

  try {
    var request = {
      id: id,
      method: method,
      params: params
    };

    this.emit('request', request);
    this._socket.send(JSON.stringify(request));

    this._callbacks[id] = callback;
  } catch (error) {
    return callback(error);
  }
};

Client.prototype.processCommand = function(message) {
  var callback = this._callbacks[message.id];

  if (callback) {
    if (message.error) {
      return callback(message.error);
    } else if (message.result) {
      return callback(null, message.result);
    } else if (message.params) {
      return callback(null, message.params);
    }
  }
};

Client.prototype.connect = function(target) {
  var socket = ws.connect(target.webSocketDebuggerUrl);

  var self = this;
  var send = self.request.bind(self);

  socket.on('open', function() {
    self.emit('connect');
  });

  socket.on('close', function() {
    self.emit('close');
  });

  socket.on('error', function(error) {
    self.emit('error', error);
  });

  socket.on('message', function(data) {
    try {
      var message = JSON.parse(data);
      self.processCommand(message);
    } catch (error) {
      self.emit('error', error);
    }
  });

  this._socket = socket;
};

Client.prototype.close = function() {
  if (this._socket) {
    this._socket.close();
  }
};

module.exports.Client = Client;

function createClient() {
  var client = new Client();
  return client;
}

module.exports.createClient = createClient;

function get(port, localhost, callback) {
  var request = http.get({
    port: port,
    host: host,
    path: '/json'
  });

  request.on('response', function(response) {
    var body = '';

    response.on('data', function(chunk) {
      body += chunk;
    });

    response.on('end', function() {
      try {
        var targets = JSON.parse(body);
        return callback(null, targets);
      } catch (error) {
        return callback(error);
      }
    });
  });

  request.on('error', function(error) {
    return callback(error);
  });
}

module.exports.get = get;
