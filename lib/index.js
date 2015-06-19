const events = require('events');
const http = require('http');
const stream = require('stream');
const util = require('util');
const ws = require('ws');

function Client() {
  events.EventEmitter.call(this);

  this._socket = null;

  this._callbacks = {};
  this._commands = {};
  this._counter = 0;

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

  this.emit('request', request);
  this._socket.send(JSON.stringify(request));

  this._callbacks[id] = callback;
  this._commands[id] = request;
};

Client.prototype.connect = function(target) {
  if (typeof target === 'object') {
    target = target.webSocketDebuggerUrl;
  }

  var socket = ws.connect(target);
  socket.on('open', function() {
    this.emit('connect');
  }.bind(this));

  socket.on('close', function() {
    self.emit('close');
  }.bind(this));

  socket.on('error', function(error) {
    self.emit('error', error);
  }.bind(this));

  socket.on('message', function(data) {
    try {
      var message = JSON.parse(data);

      if (message.id) {
        var command = this._commands[message.id];
        var callback = this._callbacks[message.id];

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
        this.emit('message', message);
        if (message.method === 'Console.messageAdded') {
          this._console.push(message.params.message);
        }

        if (message.method === 'Debugger.scriptParsed') {
          this._scripts = this._scripts.filter(function(script) {
            return message.params.url !== script.url;
          });

          this._scripts.push(message.params);
          this.emit('scriptParse', message.params);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }.bind(this));

  this._socket = socket;
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
