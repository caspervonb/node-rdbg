'use strict';

const rdbg = require('..');
const test = require('tape');
const ws = require('ws');

test('clear console', assert => {
  assert.plan(5);

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
            server.once('close', () => {
              assert.pass('close');
            });

            server.close();
          });

          client.close();
        });
      });
    });
  });
});
