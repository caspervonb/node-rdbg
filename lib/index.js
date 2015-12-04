'use strict';

const events = require('events');
const http = require('http');
const stream = require('stream');
const util = require('util');
const ws = require('ws');

const debug = util.debuglog('rdbg');

class Console extends stream.Readable {
  constructor(client) {
    super({
      objectMode: true
    });

    client.on('message', (method, params) => {
      if (method === 'Console.messageAdded') {
        this.push(params.message);
      } else if (method === 'Console.messagesCleared') {
        this.emit('clear');
      }
    });

    this._client = client;
  }

  _read() {
  }

  get client() {
    return this._client;
  }

  enable(callback) {
    this.client.request('Console.enable', error => {
      callback(error);
    });
  }

  disable(callback) {
    this.client.request('Console.enable', error => {
      callback(error);
    });
  }
}

module.exports.Console = Console;

class Debugger extends events.EventEmitter {
  constructor(client) {
    super();

    client.on('message', (method, params) => {
      if (method === 'Debugger.scriptParsed') {
        this.emit('scriptParse', params);
      } else if (method === 'Debugger.scriptFailedToParse') {
        this.emit('scriptError', params);
      } else if (method === 'Debugger.globalObjectCleared') {
        this.emit('clear');
      }
    });

    this._client = client;
  }

  get client() {
    return this._client;
  }

  enable(callback) {
    this.client.request('Debugger.enable', function(error) {
      callback(error);
    });
  }

  disable(callback) {
    this.client.request('Debugger.enable', function(error) {
      callback(error);
    });
  }

  pause(callback) {
    this.client.request('Debugger.pause', function(error) {
      callback(error);
    });
  }

  disable(callback) {
    this.client.request('Debugger.disable', function(error) {
      callback(error);
    });
  }

  canSetScriptSource(callback) {
    this.client.request('Debugger.canSetScriptSource', function(error, result) {
      if (error) {
        return callback(error);
      }

      callback(null, result.result);
    });
  }

  getScriptSource(scriptId, callback) {
    this.client.request('Debugger.getScriptSource', {
      scriptId: scriptId,
    }, function(error, result) {
      if (error) {
        return callback(error);
      }

      callback(null, result.scriptSource);
    });
  }

  setScriptSource(scriptId, source, callback) {
    this.client.request('Debugger.setScriptSource', {
      scriptId: scriptId,
      scriptSource: source
    }, callback);
  }
}

module.exports.Debugger = Debugger;

class Runtime extends events.EventEmitter {
  constructor(client) {
    super();

    client.on('message', (method, params) => {
    });

    this._client = client;
  }

  get client() {
    return this._client;
  }

  enable(callback) {
    this.client.request('Runtime.enable', error => {
      return callback(error);
    });
  }

  evaluate(cmd, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = undefined;
    }

    this.client.request('Runtime.evaluate', Object.assign({}, {
      expression: cmd,
    }, options), (error, result) => {
      if (error) {
        return callback(error);
      }

      callback(null, result.result, result.wasThrown);
    });
  }
}

module.exports.Runtime = Runtime;

class Client extends events.EventEmitter {
  constructor() {
    super();

    this._counter = 0;
    this._callbacks = {};
    this._commands = {};
    this._socket = null;
  }

  get socket() {
    return this._socket;
  }

  get console() {
    if (!this._console) {
      this._console = new Console(this);
    }

    return this._console;
  }

  get debugger() {
    if (!this._debugger) {
      this._debugger = new Debugger(this);
    }

    return this._debugger;
  }

  get runtime() {
    if (!this._runtime) {
      this._runtime = new Runtime(this);
    }

    return this._runtime;
  }

  request(method, parameters, id, callback) {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = undefined;
    }

    if (typeof id === 'function') {
      callback = id;
      id = undefined;
    }

    if (typeof parameters === 'undefined') {
      parameters = {};
    }

    if (typeof id === 'undefined') {
      id = this._counter++;
    }

    var request = {
      id: id,
      method: method,
      params: parameters,
    };

    this._callbacks[id] = callback;
    this._commands[id] = request;

    debug('request %s', util.inspect(request));
    this.emit('request', request);
    this._socket.send(JSON.stringify(request));
  }

  connect(uri, callback) {
    if (callback) {
      this.on('connect', callback);
    }

    let socket = ws.connect(uri);
    socket.once('open', () => {
      debug('connect');
      this.emit('connect');
    });

    socket.on('close', () => {
      debug('close');
      this.emit('close');
    });

    socket.on('error', (error) => {
      debug('error');
      this.emit('error', error);
    });

    socket.on('message', data => {
      try {
        var message = JSON.parse(data);

        if (message.id !== undefined) {
          var command = this._commands[message.id];
          var callback = this._callbacks[message.id];

          debug('response %s, %s', util.inspect(command), util.inspect(message));
          this.emit('response', command, message);

          if (callback) {
            if (message.error) {
              callback(message.error);
            } else {
              callback(null, message.result);
            }

            delete this._callbacks[message.id];
          }

          delete this._commands[message.id];

        } else {
          debug('message %s', util.inspect(message));
          this.emit('message', message.method, message.params);
        }
      } catch (error) {
        this.emit('error', error);
      }
    });

    this._socket = socket;
    this.emit('socket', socket);
  }

  close() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

module.exports.Client = Client;

function connect(uri, callback) {
  var client = new Client();
  if (callback) {
    client.on('connect', callback);
  }

  client.connect(uri);

  return client;
}

module.exports.connect = connect;

function list(port, host, callback) {
  if (typeof host === 'function') {
    callback = host;
    host = undefined;
  }

  if (typeof host == 'undefined') {
    host = 'localhost';
  }

  var request = http.get({
    port: port,
    host: host,
    path: '/json/list'
  });

  request.on('response', (response) => {
    var data = '';

    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', () => {
      try {
        var targets = JSON.parse(data);
        return callback(null, targets);
      } catch (error) {
        return callback(error);
      }
    });
  });

  request.on('error', (error) => {
    return callback(error);
  });
}

module.exports.list = list;
module.exports.get = util.deprecate(list, 'rdbg.get: Use rdbg.list instead');
