const build = require('./buildZig');

module.exports = [
  ...build('x86_64-windows-gnu'),
  ...build('i386-windows-gnu'),
];