const { LLVM } = require('../lib');

module.exports = function (target, config) {
  const executable = new LLVM('executable', target);
  if(config) config(executable);
  executable.files = ['examples/src/main.c'];

  const static = new LLVM('static', target);
  if(config) config(static);
  static.type = 'static';
  static.files = ['examples/src/lib.cpp'];

  const static_executable = new LLVM('static_executable', target);
  if(config) config(static_executable);
  static_executable.files = ['examples/src/libmain.cpp'];
  static_executable.libs.push(static);

  const shared = new LLVM('shared', target);
  if(config) config(shared);
  shared.type = 'shared';
  shared.files = ['examples/src/dll.cpp'];

  const shared_executable = new LLVM('shared_executable', target);
  if(config) config(shared_executable);
  shared_executable.files = ['examples/src/dllmain.cpp'];
  shared_executable.libs.push(shared);

  const builds = [
    executable,
    static,
    static_executable,
    shared,
    shared_executable,
  ];

  if (target.includes('darwin')) {
    const objc = new LLVM('objc', target);
    objc.files = ['examples/src/main.m'];
    objc.ldflags = [
      ...objc.ldflags,
      '-fobjc-arc -framework Foundation',
    ];
    builds.push(objc);
    const objcpp = new LLVM('objcpp', target);
    objcpp.files = ['examples/src/main.mm'];
    objcpp.ldflags = [
      ...objcpp.ldflags,
      '-fobjc-arc -framework Foundation',
    ];
    builds.push(objcpp);
  }

  return builds;
}