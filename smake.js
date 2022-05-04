const { magenta, yellow } = require('colors/safe');
const { Toolchain } = require('./lib');

const builds = [
  // ...require('./examples/buildDarwin'),
  // ...require('./examples/buildLinux'),
  ...require('./examples/buildWin32'),
];

class Test {
  async generateCommands(_first, _last) {
    return builds.filter(x => x.type === 'executable')
      .map(x => {
        switch (x.target) {
          case 'arm64-apple-darwin':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['arch', ['-arm64', x.outputPath]],
            };
          case 'x86_64-apple-darwin':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['arch', ['-x86_64', x.outputPath]],
            };
          case 'aarch64-unknown-linux-gnu':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['linux', ['arm64', x.outputPath]],
            };
          case 'x86_64-unknown-linux-gnu':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['linux', ['amd64', x.outputPath]],
            };
          case 'armv7-unknown-linux-gnueabihf':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['linux', ['armv7', x.outputPath]],
            };
          // case 'x86_64-pc-windows-msvc':
          // case 'i386-pc-windows-msvc':
          //   return {
          //     label: magenta(`Test ${x.name} ${x.target}`),
          //     cmd: `wine ${x.outputPath}`,
          //   };
          default:
            return {
              label:  yellow(`Skip Test ${x.name} ${x.target}`),
              command: async() => {},
            };
        }
      });
  }
}

module.exports = [
  ...builds,
  // new Test('my-test'),
];
