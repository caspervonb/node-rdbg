const http = require('http');
const ws = require('ws');
const path = require('path');
const events = require('events');
const util = require('util');
const async = require('async');
const url = require('url');
const stream = require('stream');

function Client() {
  events.EventEmitter.call(this);

  this._socket = null;

  this._callbacks = [];
  this._counter = 0;

  this._scripts = [];
  this._console = new stream.Readable({ objectMode: true });
  this._console._read = function() { };
}

util.inherits(Client, events.EventEmitter);

Object.defineProperty(Client.prototype, 'socket', {
  get: function() {
    return this._socket;
  },
});

Object.defineProperty(Client.prototype, 'console', {
  get: function() {
    return this._console;
  },
});

Client.prototype.sendCommand = function(method, params, callback) {
  try {
    var id = this._counter++;

    this._socket.send(JSON.stringify({
      id: id,
      method: method,
      params: params
    }));
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

  if (message.method === 'Console.messageAdded') {
    return this._console.push(message.params.message);
  }

  if (message.method === 'Debugger.scriptParsed') {
    this._scripts = this._scripts.filter(function(script) {
      return message.params.url !== script.url;
    });

    this._scripts.push(message.params);
    return this.emit('scriptParse', message.params);
  }
};

Client.prototype.attach = function attach(target) {
  var socket = ws.connect(target.webSocketDebuggerUrl);

  var self = this;
  var send = self.sendCommand.bind(self);

  socket.on('open', function() {
    self._scripts = [];

    async.series([
      async.apply(send, 'Debugger.enable', {}),
      async.apply(send, 'Runtime.enable', {}),
      async.apply(send, 'Console.enable', {}),
    ], function(error) {
      if (error) {
        return self.emit('error', error);
      }

      self.emit('attach', target);
    });
  });

  socket.on('close', function() {
    self._scripts = [];

    self.emit('detatch', target);
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

Client.prototype.detatch = function() {
  if (this._socket) {
    this._socket.close();
  }
};

Client.prototype.evaluate = function evaluate(expression, callback) {
  this.sendCommand('Runtime.evaluate', {
    expression: expression,
  }, callback);
};

Client.prototype.getScripts = function scripts(callback) {
  callback(this._scripts);
};

Client.prototype.getScriptSource = function(script, callback) {
  this.sendCommand('Debugger.getScriptSource', {
    scriptId: script.scriptId,
  }, callback);
};

Client.prototype.setScriptSource = function source(script, contents, callback) {
  this.sendCommand('Debugger.setScriptSource', {
    scriptId: script.scriptId,
    scriptSource: contents
  }, callback);
};

module.exports.Client = Client;

function createClient() {
  var client = new Client();
  return client;
}

module.exports.createClient = createClient;

function get(port, host, callback) {
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
};

module.exports.get = get;
