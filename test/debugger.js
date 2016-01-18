'use strict';

const rdbg = require('..');
const test = require('tape');
const ws = require('ws');

test('debugger enable', assert => {
  assert.plan(3);
  let server = ws.createServer({port: '4000'});

  server.once('connection', connection => {

    connection.once('close', () => {
      assert.pass('close');
    });

    connection.on('message', data => {
      let message = JSON.parse(data);
      connection.send(JSON.stringify({
        id: message.id
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equals('Debugger.enable', request.method);
      });

      client.debugger.enable(error => {
        assert.error(error);
        server.close();
      });
    });
  });
});

test('debugger disable', assert => {
  assert.plan(3);
  let server = ws.createServer({port: '4000'});

  server.once('connection', connection => {

    connection.once('close', () => {
      assert.pass('close');
    });

    connection.on('message', data => {
      let message = JSON.parse(data);
      connection.send(JSON.stringify({
        id: message.id
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equals('Debugger.disable', request.method);
      });

      client.debugger.disable(error => {
        assert.error(error);
        server.close();
      });
    });
  });
});

test('debugger pause', assert => {
  assert.plan(3);
  let server = ws.createServer({port: '4000'});

  server.once('connection', connection => {

    connection.once('close', () => {
      assert.pass('close');
    });

    connection.on('message', data => {
      let message = JSON.parse(data);
      connection.send(JSON.stringify({
        id: message.id
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equals('Debugger.pause', request.method);
      });

      client.debugger.pause(error => {
        assert.error(error);
        server.close();
      });
    });
  });
});

test('debugger canSetScriptSource', assert => {
  assert.plan(4);
  let server = ws.createServer({port: '4000'});

  server.once('connection', connection => {

    connection.once('close', () => {
      assert.pass('close');
    });

    connection.on('message', data => {
      let message = JSON.parse(data);
      connection.send(JSON.stringify({
        id: message.id,
        result: {
          result: true
        }
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equals('Debugger.canSetScriptSource', request.method);
      });

      client.debugger.canSetScriptSource((error, result) => {
        assert.error(error);
        assert.ok(result, 'Should be true');
        server.close();
      });
    });
  });
});

test('debugger getScriptSource', assert => {
  assert.plan(5);
  let server = ws.createServer({port: '4000'});

  server.once('connection', connection => {

    connection.once('close', () => {
      assert.pass('close');
    });

    connection.on('message', data => {
      let message = JSON.parse(data);
      connection.send(JSON.stringify({
        id: message.id,
        result: {
          scriptSource: 'script'
        }
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equal(request.method, 'Debugger.getScriptSource');
        assert.deepEqual(request.params, { scriptId: '5' });
      });

      client.debugger.getScriptSource('5', (error, scriptSource) => {
        assert.error(error);
        assert.equal(scriptSource, 'script');
        server.close();
      });
    });
  });
});
