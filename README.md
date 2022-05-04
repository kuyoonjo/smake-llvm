# @smake/llvm

```js
// smake.js
const { Fn, Shell } = require('@smake/utils');

module.exports = [
  new Fn('1', () => console.log('Fn OK')),
  new Shell('2', 'echo', ['Shell OK']),
  new Shell('3', 'ls'),
];
```