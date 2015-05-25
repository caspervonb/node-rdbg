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

Inspector.prototype._send = function(method, params, callback) {
  var id = this._counter++;

  var message = {
    id: id,
    method: method,
    params: params
  };

  this._callbacks[id] = callback;

  try {
    this._socket.send(JSON.stringify(message));
  } catch (error) {
    return callback(error);
  }
};

Inspector.prototype._process = function(message) {
  if (message.id !== undefined) {
    var callback = this._callbacks[message.id];

    if (callback) {
      if (message.error) {
        callback(message.error);
      } else if (message.params) {
        callback(null, message.params);
      } else if (message.result) {
        callback(null, message.result);
      }

      delete this._callbacks[message.id];
    }
  } else {
    if (message.method == 'Debugger.scriptParsed') {
      this._scripts = this._scripts.filter(function(script) {
        return message.params.url !== script.url;
      });

      this._scripts.push(message.params);
    } else if (message.method == 'Console.messageAdded') {
      this._console.emit('data', message.params.message);
    }
  }
};

Inspector.prototype.targets = function(port, host, callback) {
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
  var send = self._send.bind(self);

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
      self._process(message);
    } catch (error) {
      self.emit('error', error);
    }
  });

  this._socket = socket;
};

Inspector.prototype.evaluate = function evaluate(expression, callback) {
  var params = {
    expression: expression,
  };

  this._send('Runtime.evaluate', params, function evaluate(error, params) {
    if (error) {
      return callback(error);
    }

    callback(null, params.result);
  });
};

Inspector.prototype.scripts = function scripts(callback) {
  callback(this._scripts);
};

Inspector.prototype.source = function source(script, contents, callback) {
  var params = {
    scriptId: script.scriptId,
    scriptSource: contents
  };

  var self = this;
  this._send('Debugger.setScriptSource', params, function(error, params) {
    if (error) {
      if (callback) {
        return callback(error);
      } else {
        return self.emit('error', error);
      }
    }

    self.emit('source', script);

    if (callback) {
      callback(null, params);
    }
  });
};

function connect(port, host, callback) {
  var client = new Inspector(port, host);

  if (callback) {
    client.on('attach', callback);
  }

  return client;
}

module.exports.connect = connect;
