# node-rdbg

## INSTALLATION

```sh
$ npm install rdbg
```

## USAGE

```js
var rdbg = require('rdbg');

rdbg.get(9222, 'localhost', function(error, targets) {
  var client = rdbg.connect(targets[0].debuggerUrl, function() {

  });
});
```

## DOCUMENTATION

[See the manual](doc/api/readme.md)

## SUPPORT

* If you need help, ask in the [chat](http://gitter.im/caspervonb/node-rdbg).
* If you found a bug, submit an [issue](https://github.com/caspervonb/node-rdbg/issues).
* If you have an idea, submit an [issue](https://github.com/caspervonb/node-rdbg/issues).
* If you’d like to ask a general question, [issue](https://github.com/caspervonb/node-rdbg/issues).
* If you want to contribute, submit a [pull request](https://github.com/caspervonb/node-rdbg/pulls).

## RELEASES

[See the changelog](changelog.md).

## LICENSE

The project is licensed under the [MIT License](license.md).
