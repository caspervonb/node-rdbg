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
