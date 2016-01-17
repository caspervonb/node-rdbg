'use strict';

const rdbg = require('..');
const test = require('tape');
const ws = require('ws');

test('clear console', assert => {
  assert.plan(6);

  let server = ws.createServer({port: '4000'});

  server.once('connection', connection => {
    const responses = [
    {
      result: {},
    },
    {
      error: {},
    }
    ];

    connection.on('message', data => {
      let message = JSON.parse(data);
      let response = responses.shift();

      connection.send(JSON.stringify(Object.assign(response, {
        id: message.id
      })));
    });

    connection.once('close', () => {
      assert.pass('close');
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');

    client.once('connect', () => {
      client.on('request', (request) => {
        assert.equals('Console.clearMessages', request.method);
      });

      client.console.clear(error => {
        assert.error(error);

        client.once('request', (request) => {
          assert.equals('Console.clearMessages', request.method);
        });

        client.console.clear(error => {
          assert.ok(error);

          client.once('close', () => {
            server.close();
          });

          client.close();
        });
      });
    });
  });
});
