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

  this.socket = null;

  this._callbacks = [];
  this._requests = [];
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
    this.socket.send(JSON.stringify(request));

    if (callback) {
      this._callbacks[id] = callback;
    }

    this._requests[id] = request;
  } catch (error) {
    this.emit('error', error);
  }
};

Client.prototype.processCommand = function(message) {
  if (message.id) {
    var request = this._requests[message.id];
    var callback = this._requests[message.id];

    this.emit('response', request, message);

    if (callback) {
      callback(request, message);
    }
  } else {
    this.emit('event', message);
  }
};

Client.prototype.connect = function(url, callback) {
  if (callback) {
    this.on('connect', callback);
  }

  this.socket = ws.connect(url);
  this.emit('socket');

  var self = this;
  var send = self.request.bind(self);

  this.socket.on('open', function() {
    self.emit('connect');
  });

  this.socket.on('close', function() {
    self.emit('close');
  });

  this.socket.on('error', function(error) {
    self.emit('error', error);
  });

  this.socket.on('message', function(data) {
    try {
      var message = JSON.parse(data);
      self.processCommand(message);
    } catch (error) {
      self.emit('error', error);
    }
  });
};

Client.prototype.close = function(callback) {
  if (callback) {
    this.on('close', callback);
  }

  if (this.socket) {
    this.socket.close();
  }
};

module.exports.Client = Client;

function createClient() {
  var client = new Client();
  return client;
}

module.exports.createClient = createClient;

function get(port, host, callback) {
  if (typeof host === 'function') {
    callback = host;
    host = undefined;
  }

  if (host === undefined) {
    host = 'localhost';
  }

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
