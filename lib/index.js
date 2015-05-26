var http = require('http');
var ws = require('ws');
var path = require('path');
var events = require('events');
var util = require('util');
var async = require('async');
var url = require('url');

function Inspector() {
  events.EventEmitter.call(this);

  this._socket = null;

  this._callbacks = [];
  this._counter = 0;

  this._scripts = [];
  this._console = new events.EventEmitter();
}

util.inherits(Inspector, events.EventEmitter);

Object.defineProperty(Inspector.prototype, 'console', {
  get: function() {
    return this._console;
  },
});

Inspector.prototype.sendCommand = function(method, params, callback) {
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

Inspector.prototype.processCommand = function(message) {
  var callback = this._callbacks[message.id];

  if (callback) {
    if (message.error) {
      return callback(message.error);
    } else if (message.result.scriptSource) {
      return callback(null, message.result.scriptSource);
    } else if (message.result) {
      return callback(null, message.result);
    } else if (message.params) {
      return callback(null, message.params);
    }
  }

  if (message.method === 'Console.messageAdded') {
    return this._console.emit('data', message.params);
  }

  if (message.method === 'Debugger.scriptParsed') {
    this._scripts = this._scripts.filter(function(script) {
      return message.params.url !== script.url;
    });

    this._scripts.push(message.params);
    return;
  }
};

Inspector.prototype.getTargets = function(port, host, callback) {
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
      var targets = JSON.parse(body);
      return callback(null, targets);
    });
  });

  request.on('error', function(error) {
    return callback(error);
  });
};

Inspector.prototype.attach = function attach(target) {
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

Inspector.prototype.detatch = function() {
  if (this._socket) {
    this._socket.close();
  }
};

Inspector.prototype.evaluate = function evaluate(expression, callback) {
  this.sendCommand('Runtime.evaluate', {
    expression: expression,
  }, callback);
};

Inspector.prototype.getScripts = function scripts(callback) {
  callback(this._scripts);
};

Inspector.prototype.getScriptSource = function(script, callback) {
  this.sendCommand('Debugger.getScriptSource', {
    scriptId: script.scriptId,
  }, callback);
};

Inspector.prototype.setScriptSource = function source(script, contents, callback) {
  this.sendCommand('Debugger.setScriptSource', {
    scriptId: script.scriptId,
    scriptSource: contents
  }, callback);
};

module.exports.Inspector = Inspector;

function createInspector() {
  var inspector = new Inspector();
  return inspector;
}

module.exports.createInspector = createInspector;
