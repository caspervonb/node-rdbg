var http = require('http');
var ws = require('ws');
var path = require('path');
var events = require('events');
var util = require('util');

var ChromeConnection = (function() {
  function ChromeConnection(port, host) {
    events.EventEmitter.call(this);

    this._port = port;
    this._host = host;
    
    this._callbacks = {};
    this._scripts = [];
  }

  util.inherits(ChromeConnection, events.EventEmitter);

  ChromeConnection.prototype._send = function(method, params, callback) {
    var id = Date.now();

    var message = {
      id: id,
      method: method,
      params: params
    };

    this._callbacks[id] = callback;
    this._socket.send(JSON.stringify(message));
  };

  ChromeConnection.prototype._process = function(message) {
    if (message.id) {
      var callback = this._callbacks[message.id];

      if (callback) {
        if (message.error) {
          callback(message.error);
        } else {
          callback(null, message.params);
        }

        delete this._callbacks[message.id];
      }
    } else {
      if (message.method == 'Debugger.scriptParsed') {
        this._scripts.push(message.params);
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
    socket.once('open', function() {
      self._send('Debugger.enable', {}, function(error) {
        self.emit('attach', target);
      });
    });

    socket.on('message', function(data) {
      try {
        var message = JSON.parse(data);
        self._process(message);
      } catch (error) {
      }
    });

    this._socket = socket;
  };

  ChromeConnection.prototype.source = function source(filename, contents, callback) {
    var script = this._scripts.filter(function(src) {
      return path.basename(src.url) == filename;
    })[0];

    if (script === undefined) {
      return callback('Unknown script ' + filename);
    }

    var params = {
      scriptId: script.scriptId,
      scriptSource: contents
    };

    this._send('Debugger.setScriptSource', params, function(error, params) {
      if (error) {
        return callback(error);
      }

      callback(null, params);
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
