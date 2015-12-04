'use strict';

const rdbg = require('..');
const test = require('tape');
const http = require('http');

test('list targets', assert => {
  assert.plan(4);

  let server = http.createServer();

  server.once('listening', () => {
    server.once('request', (request, response) => {
      assert.equal(request.url, '/json/list');

      response.end(JSON.stringify([
        {
          description: "",
          devtoolsFrontendUrl: "/devtools/devtools.html?ws=localhost:9222/devtools/page/961C1EB7-A0DA-2F42-F6D4-76B453E70DB5",
          faviconUrl: "https://s.yimg.com/rz/l/favicon.ico",
          id: "961C1EB7-A0DA-2F42-F6D4-76B453E70DB5",
          title: "Yahoo",
          type: "page",
          url: "https://www.yahoo.com/",
          webSocketDebuggerUrl: "ws://localhost:9222/devtools/page/961C1EB7-A0DA-2F42-F6D4-76B453E70DB5"
        }
      ]));
    });

    rdbg.list(4000, (error, targets) => {
      assert.error(error);
      assert.deepEqual(targets, [
        {
          description: "",
          devtoolsFrontendUrl: "/devtools/devtools.html?ws=localhost:9222/devtools/page/961C1EB7-A0DA-2F42-F6D4-76B453E70DB5",
          faviconUrl: "https://s.yimg.com/rz/l/favicon.ico",
          id: "961C1EB7-A0DA-2F42-F6D4-76B453E70DB5",
          title: "Yahoo",
          type: "page",
          url: "https://www.yahoo.com/",
          webSocketDebuggerUrl: "ws://localhost:9222/devtools/page/961C1EB7-A0DA-2F42-F6D4-76B453E70DB5"
        }
      ]);

      server.once('close', () => {
        assert.pass('close');
      });

      server.close();
    });
  });

  server.listen(4000);
});
