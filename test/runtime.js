'use strict';

const rdbg = require('..');
const test = require('tape');
const ws = require('ws');

test('Runtime.callFunctionOn', assert => {
  let server = ws.createServer({port: '4000'});
  server.once('connection', connection => {

  	connection.on('message', data => {
      let message = JSON.parse(data);
  		connection.send(JSON.stringify({
  			id: message.id,
        error: false,
        result: {
          result: {type: 'object'}
        }
  		}));
  	});
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {
      let runtime = client.runtime;

      client.once('response', (request, response) => {
        assert.deepEqual({functionDeclaration: '()=>{}', objectId: 1}, request.params, 'request to call a declared function on the given object');
        assert.deepEqual({type: 'object'}, response.result.result, 'response with result from the call');

        runtime.callFunctionOn(1, '()=>{}', {arguments: [{ value: '5' }]}, (error, result) => {});
        client.once('response', (request, response) => {
          assert.deepEqual({functionDeclaration: '()=>{}', arguments: [{ value: '5' }], objectId: 1 }, request.params, 'request to call a declared function on the given object with arguments');
          assert.deepEqual({type: 'object'}, response.result.result, 'response with result from the call');
          server.close();
          assert.end();
        });
      });

      runtime.callFunctionOn(1, '()=>{}', (error, result) => {});
    });
  });
});

test('Runtime.enable', assert => {
  let server = ws.createServer({port: '4000'});
  server.once('connection', connection => {

    connection.on('message', data => {
      let message = JSON.parse(data);
      connection.send(JSON.stringify({
        id: message.id,
        error: false
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {
      let runtime = client.runtime;

      client.once('response', (request, response) => {
        assert.ok(request.method, 'request to enable to create execution context');
        assert.error(response.error, 'response with no errors');      
        server.close();
        assert.end();
      });

      runtime.enable(error => {});
    });
  });
});

test('Runtime.evaluate', assert => {
  let server = ws.createServer({port: '4000'});
  server.once('connection', connection => {

    connection.on('message', data => {
      let message = JSON.parse(data);
      connection.send(JSON.stringify({
        id: message.id,
        error: false,
        result: {
          result: {type: 'object'}
        }
      }));
    });
  });

  server.on('listening', () => {
    let client = rdbg.connect('ws://localhost:4000');
    client.once('connect', () => {
      let runtime = client.runtime;

      client.once('response', (request, response) => {
        assert.deepEqual({expression: 'Obj.resolve'}, request.params, 'request to evaluate the given expression on a global object');  
        assert.deepEqual({type: 'object'}, response.result.result, 'response with a result from the object eveluation');
        server.close();
        assert.end();
      });

      runtime.evaluate('Obj.resolve', error => {});
    });
  });
});