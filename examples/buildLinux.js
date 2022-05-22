const build = require('./build');

module.exports = [
  ...build('aarch64-ubuntu14.04-linux-gnu'),
  ...build('x86_64-ubuntu14.04-linux-gnu'),
  ...build('armv7-ubuntu14.04-linux-gnueabihf'),
  ...build('i386-ubuntu14.04-linux-gnu'),
];