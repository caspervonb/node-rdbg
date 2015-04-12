var http = require('http');
var ws = require('ws');
var path = require('path');
var events = require('events');
var util = require('util');
var async = require('async');
var url = require('url');

var ChromeConnection = (function() {
  function ChromeConnection(port, host) {
    events.EventEmitter.call(this);

    this._port = port;
    this._host = host;

    this._callbacks = [];
    this._counter = 0;

    this._scripts = [];
    this._console = new events.EventEmitter();
  }

  util.inherits(ChromeConnection, events.EventEmitter);

  Object.defineProperty(ChromeConnection.prototype, 'console', {
    get: function() {
      return this._console;
    },
  });

  ChromeConnection.prototype._send = function(method, params, callback) {
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

  ChromeConnection.prototype._process = function(message) {
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
        this._scripts.push(message.params);
      } else if (message.method == 'Console.messageAdded') {
        this._console.emit('data', message.params.message);
      }
    }
  };

  ChromeConnection.prototype.targets = function(callback) {
    var options = {
      host: this._host,
      port: this._port,
      path: '/json'
    };

    var self = this;
    var request = http.get(options, function(response) {
      var data = '';

      response.on('data', function(chunk) {
        data += chunk;
      });

      response.on('end', function() {
        var targets = JSON.parse(data);
        callback(targets);
      });
    });

    request.on('error', function(error) {
      self.emit('error', error);
    });
  };

  ChromeConnection.prototype.attach = function attach(target) {
    var socket = ws.connect(target.webSocketDebuggerUrl);

    var self = this;
    var send = self._send.bind(self);

    socket.on('open', function() {
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

  ChromeConnection.prototype.evaluate = function evaluate(expression, callback) {
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

  ChromeConnection.prototype.scripts = function scripts(callback) {
    callback(this._scripts);
  };

  ChromeConnection.prototype.source = function source(script, contents, callback) {
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

  return ChromeConnection;
}());

function connect(port, host, callback) {
  var client = new ChromeConnection(port, host);

  if (callback) {
    client.on('attach', callback);
  }

  return client;
}

module.exports.connect = connect;
