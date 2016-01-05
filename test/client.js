'use strict';

const rdbg = require('..');
const test = require('tape');
const ws = require('ws');

test('client requests', assert => {
  assert.plan(11);

  let server = ws.createServer({ port: 4000 });
  server.once('connection', connection => {
    connection.on('message', data => {
      let message = JSON.parse(data);
      connection.send(JSON.stringify({
        id: message.id,
        result: message
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {

      client.once('response', (request, response) => {
        assert.equal(request.method, 'Console.enable');
        assert.deepEqual(response.result.params, {});
        assert.equal(response.result.method, 'Console.enable');

        client.request('Console.clear', null, 5);
        client.once('response', (request, response) => {
          assert.equal(request.method, 'Console.clear');
          assert.equal(request.params, null);
          assert.equal(response.id, 5);
          assert.equal(response.result.method, 'Console.clear');

          client.request('Console.disable', (error, result) => {
            assert.error(error);
            assert.deepEqual(result.params, {});
            assert.equal(result.method, 'Console.disable');

            server.close();
            assert.pass('close');
          });
        });
      });

      client.request('Console.enable');
    });
  });
});
