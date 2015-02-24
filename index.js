var http = require('http');
var ws = require('ws');
var path = require('path');
var events = require('events');
var util = require('util');

var DebugClient = (function() {
  function DebugClient() {
    events.EventEmitter.call(this);
  }

  util.inherits(DebugClient, events.EventEmitter);

  DebugClient.prototype.connect = function(port, host, callback) {
    this.port = port;
    this.host = host;

    var client = this;
    this.once('connect', callback);
    this.targets(function(targets) {
      client.emit('connect', targets);
    });
  };

  DebugClient.prototype.targets = function targets(callback) {
    var options = {
      host: this.host,
      port: this.port,
      path: '/json'
    };

    var client = this;
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
      client.emit('error', error);
    });
  };

  DebugClient.prototype.attach = function attach(target, callback) {
    var scripts = [];
    var socket = ws.connect(target.webSocketDebuggerUrl);
    var client = this;

    this.once('attach', callback);

    socket.once('open', function() {
      var id = Date.now();

      socket.on('message', function process(data) {
        var message = JSON.parse(data);
        if (message.id == id) {
          socket.removeListener('message', process);

          if (message.error) {
            client.emit('error', message.error);
            return;
          }

          client.emit('attach', target);
        }
      });

      socket.send(JSON.stringify({
        id: id,
        method: "Debugger.enable"
      }));
    });

    socket.on('message', function(data) {
      var message = JSON.parse(data);
      if (message.method == 'Debugger.scriptParsed') {
        scripts.push(message.params);
      }

      if (message.method == 'Inspector.detached') {
        client.emit('detatch');
      }
    });

    this.socket = socket;
    this.scripts = scripts;
  };

  DebugClient.prototype.source = function source(filename, contents, callback) {
    var socket = this.socket;
    var scripts = this.scripts;

    var script = scripts.filter(function(src) {
      return path.basename(src.url) == filename;
    })[0];

    if (!script) {
      return callback('Unknown script ' + filename);
    }

    var id = Date.now();
    socket.on('message', function process(data) {
      var message = JSON.parse(data);
      if (message.id == id) {
        socket.removeListener('message', process);

        if (message.error) {
          return callback(message.error);
        }

        callback(null, null);
      }
    });

    if (contents) {
      socket.send(JSON.stringify({
        id: id,
        method: "Debugger.setScriptSource",
        params: {
          scriptId: script.scriptId,
          scriptSource: contents
        }
      }));
    } else {
      var request = http.get(script.url, function(response) {
        var contents = '';

        response.on('data', function(chunk) {
          contents += chunk;
        });

        response.on('end', function() {        
          socket.send(JSON.stringify({
            id: id,
            method: "Debugger.setScriptSource",
            params: {
              scriptId: script.scriptId,
              scriptSource: contents
            }
          }));
        });
      });
    }
  };

  return DebugClient;
}());

function connect(host, port, callback) {
  var client = new DebugClient();
  client.connect(host, port, callback);

  return client;
}

module.exports.connect = connect;
