const build = require('./buildZig');

module.exports = [
  ...build('aarch64-linux-gnu'),
  ...build('x86_64-linux-gnu'),
  ...build('arm-linux-gnueabihf'),
  ...build('i386-linux-gnu'),
];