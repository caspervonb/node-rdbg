const events = require('events');
const http = require('http');
const stream = require('stream');
const util = require('util');
const ws = require('ws');

const debug = util.debuglog('rdbg');

function Console(client) {
  stream.Readable.call(this, {
    objectMode: true
  });

  this.client = client;
  this.client.on('message', function(method, params) {
    if (method === 'Console.messageAdded') {
      this.push(params.message);
    }
  }.bind(this));
}

util.inherits(Console, stream.Readable);

Console.prototype._read = function() {
};

Console.prototype.enable = function(callback) {
  this.client.request('Console.enable');
};

Console.prototype.disable = function(callback) {
  this.client.request('Console.disable', callback);
};

function Debugger(client) {
  events.EventEmitter.call(this);

  this.client = client;
  this.client.on('message', function(method, params) {
    if (method === 'Debugger.scriptParsed') {
      this.emit('scriptParse', params);
    } else if (method === 'Debugger.scriptFailedToParse') {
      this.emit('scriptError', params);
    }
  }.bind(this));
}

util.inherits(Debugger, events.EventEmitter);

Debugger.prototype.enable = function(callback) {
  this.client.request('Debugger.enable', callback);
};

Debugger.prototype.disable = function(callback) {
  this.client.request('Debugger.disable', callback);
};

Debugger.prototype.pause = function(callback) {
  this.client.request('Debugger.pause', callback);
};

Debugger.prototype.resume = function(callback) {
  this.client.request('Debugger.resume', callback);
};

Debugger.prototype.canSetScriptSource = function(callback) {
  this.client.request('Debugger.canSetScriptSource', function(error, result) {
    if (error) {
      return callback(error);
    }

    callback(null, result.result);
  });
};

Debugger.prototype.getScriptSource = function(script, callback) {
  this.client.request('Debugger.getScriptSource', {
    scriptId: script,
  }, function(error, result) {
    if (error) {
      return callback(error);
    }

    callback(null, result.scriptSource);
  });
};

Debugger.prototype.setScriptSource = function(script, source, callback) {
  if (typeof script === 'object') {
    script = script.scriptId;
  }

  this.client.request('Debugger.setScriptSource', {
    scriptId: script,
    scriptSource: source
  }, callback);
};

function Runtime(client) {
  this.client = client;

  this.client.on('message', function(method, params) {
  }.bind(this));
}

util.inherits(Runtime, events.EventEmitter);

Runtime.prototype.enable = function(callback) {
  this.client.request('Runtime.enable', callback);
};

Runtime.prototype.evaluate = function(cmd, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = undefined;
  }

  if (options == undefined) {
    options = {};
  }

  this.client.request('Runtime.evaluate', {
    expression: cmd,
    objectGroup: options.objectGroup,
    contextId: options.contextId,
  }, callback);
};

function Client() {
  events.EventEmitter.call(this);

  this._socket = null;

  this._callbacks = {};
  this._commands = {};
  this._counter = 0;
}

util.inherits(Client, events.EventEmitter);

Object.defineProperty(Client.prototype, 'socket', {
  get: function() {
    return this._socket;
  },
});

Object.defineProperty(Client.prototype, 'console', {
  get: function() {
    if (!this._console) {
      this._console = new Console(this);
    }

    return this._console;
  },
});

Object.defineProperty(Client.prototype, 'debugger', {
  get: function() {
    if (!this._debugger) {
      this._debugger = new Debugger(this);
    }

    return this._debugger;
  },
});


Object.defineProperty(Client.prototype, 'runtime', {
  get: function() {
    if (!this._runtime) {
      this._runtime = new Runtime(this);
    }

    return this._runtime;
  },
});

Client.prototype.request = function(method, params, id, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = undefined;
  } else if (typeof id === 'function') {
    callback = id;
    id = undefined;
  }

  if (params === undefined) {
    params = {};
  }

  if (id === undefined) {
    id = this._counter++;
  }

  var request = {
    id: id,
    method: method,
    params: params
  };

  debug('request %s', util.inspect(request));
  this.emit('request', request);
  this._socket.send(JSON.stringify(request));

  this._callbacks[id] = callback;
  this._commands[id] = request;
};

Client.prototype.connect = function(target, callback) {
  if (typeof target === 'object') {
    target = target.webSocketDebuggerUrl;
  }

  if (callback) {
    this.on('connect', callback);
  }

  var socket = ws.connect(target);
  socket.on('open', function() {
    debug('connect');
    this.emit('connect');

    if (Object.keys(this._commands).length === 0) {
      this.emit('ready');
    }
  }.bind(this));

  socket.on('close', function() {
    debug('close');
    this.emit('close');
    this._socket = null;
  }.bind(this));

  socket.on('error', function(error) {
    debug('error %s', util.inspect(error));
    this.emit('error', error);
  }.bind(this));

  socket.on('message', function(data) {
    try {
      var message = JSON.parse(data);

      if (message.id) {
        var command = this._commands[message.id];
        var callback = this._callbacks[message.id];

        debug('response %s, %s', util.inspect(command), util.inspect(message));
        this.emit('response', command, message);

        if (callback) {
          if (message.error) {
            callback(message.error);
          } else if (message.result) {
            callback(null, message.result);
          }

          delete this._callbacks[message.id];
        }

        delete this._commands[message.id];

        if (Object.keys(this._commands).length === 0) {
          this.emit('ready');
        }
      } else {
        debug('message %s', util.inspect(message));
        this.emit('message', message.method, message.params);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }.bind(this));

  this._socket = socket;

  debug('socket');
  this.emit('socket');
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

function connect(target, callback) {
  var client = createClient();
  client.connect(target, callback);

  return client;
}

module.exports.connect = connect;

function get(port, host, callback) {
  if (typeof host === 'function') {
    callback = host;
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
};

module.exports.get = get;
