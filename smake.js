const { magenta, yellow } = require('colors/safe');

const builds = [
  // ...require('./examples/buildDarwin'),
  ...require('./examples/buildLinux'),
  ...require('./examples/buildWin32'),
  ...require('./examples/buildZigLinux'),
  // ...require('./examples/buildZigWindowsGnu'),
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
          case 'x86_64-pc-windows-msvc':
          case 'i686-pc-windows-msvc':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['wine', [x.outputPath]],
            };
          default:
            return {
              label: yellow(`Skip Test ${x.name} ${x.target}`),
              command: async () => { },
            };
        }
      });
  }
}

class TestZig {
  async generateCommands(_first, _last) {
    return builds.filter(x => x.type === 'executable')
      .map(x => {
        switch (x.target) {
          // case 'arm64-apple-darwin':
          //   return {
          //     label: magenta(`Test ${x.name} ${x.target}`),
          //     command: ['arch', ['-arm64', x.outputPath]],
          //   };
          // case 'x86_64-apple-darwin':
          //   return {
          //     label: magenta(`Test ${x.name} ${x.target}`),
          //     command: ['arch', ['-x86_64', x.outputPath]],
          //   };
          case 'aarch64-linux-gnu':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['armv8', [x.outputPath]],
            };
          case 'x86_64-linux-gnu':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['x64', [x.outputPath]],
            };
          case 'i386-linux-gnu':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['x86', [x.outputPath]],
            };
          case 'arm-linux-gnueabihf':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['armv7', [x.outputPath]],
            };
          case 'x86_64-pc-windows-msvc':
          case 'i686-pc-windows-msvc':
            return {
              label: magenta(`Test ${x.name} ${x.target}`),
              command: ['wine', [x.outputPath]],
            };
          default:
            return {
              label: yellow(`Skip Test ${x.name} ${x.target}`),
              command: async () => { },
            };
        }
      });
  }
}

module.exports = [
  ...builds,
  new TestZig('my-test-zig'),
];
