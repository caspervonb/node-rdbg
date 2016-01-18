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