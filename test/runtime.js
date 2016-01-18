'use strict';

const rdbg = require('..');
const test = require('tape');
const ws = require('ws');

test('runtime call', assert => {
  assert.plan(6);
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
          result: { type: 'object' },
          wasThrown: true
        }
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equal(request.method, 'Runtime.callFunctionOn');
        assert.deepEqual(request.params, { objectId: '5', functionDeclaration: '()=>{}', arguments: [{value: '10'}], returnByValue: true });

        client.runtime.call('2', ()=>{}, (error, result, wasThrown) => {
          assert.error(error);
          assert.deepEqual(result, { type: 'object' });
          assert.ok(wasThrown, 'Should be true');

          server.close();
        });

      });

      client.runtime.call('5', ()=>{}, { arguments: [{value: '10'}], returnByValue: true }, (error, result) => {});
    });
  });
});

test('runtime enable', assert => {
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
        assert.equals('Runtime.enable', request.method);
      });

      client.runtime.enable(error => {
        assert.error(error);
        server.close();
      });
    });
  });
});

test('runtime evaluate', assert => {
  assert.plan(6);
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
          result: { type: 'object' },
          wasThrown: true
        }
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equal(request.method, 'Runtime.evaluate');
        assert.deepEqual(request.params, { expression: '1 + 1', objectGroup: 'group', contextId: 1, returnByValue: true });

        client.runtime.evaluate('1 + 1', (error, result, wasThrown) => {
          assert.error(error);
          assert.deepEqual(result, { type: 'object' });
          assert.ok(wasThrown, 'Should be true');

          server.close();
        });
      });

      client.runtime.evaluate('1 + 1', { objectGroup: 'group', contextId: 1, returnByValue: true }, (error, result) => {});
    });
  });
});

test('runtime properties', assert => {
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
          result: [{ name: 'type', configurable: false, enumerable: true }]
        }
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equal(request.method, 'Runtime.getProperties');
        assert.deepEqual(request.params, { objectId: '5', ownProperties: true });

        client.runtime.properties('2', (error, result) => {
          assert.error(error);
          assert.deepEqual(result, [{ name: 'type', configurable: false, enumerable: true }]);

          server.close();
        });
      });

      client.runtime.properties('5', { ownProperties: true }, (error, result) => {});
    });
  });
});

test('runtime release', assert => {
  assert.plan(4);
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
        assert.equal('Runtime.releaseObject', request.method);
        assert.deepEqual(request.params, { objectId: '5' });
      });

      client.runtime.release('5', error => {
        assert.error(error);
        server.close();
      });
    });
  });
});
