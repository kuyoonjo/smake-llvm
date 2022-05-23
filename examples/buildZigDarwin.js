const build = require('./buildZig');

module.exports = [
  ...build('aarch64-macos'),
  ...build('x86_64-macos'),
];