import { execSync } from 'child_process';
import { cyan, green, magenta, red, yellow } from 'colors/safe';
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { homedir, join } from '@smake/utils';
import { quote } from '@smake/utils';
import { ICommand, IToolchain } from '@smake/utils';

export const CommonTargets = {
  'x86_64-apple-darwin': 'x86_64-apple-darwin',
  'arm64-apple-darwin': 'arm64-apple-darwin',
  'i386-unknown-linux-gnu': 'i386-unknown-linux-gnu',
  'x86_64-unknown-linux-gnu': 'x86_64-unknown-linux-gnu',
  'aarch64-unknown-linux-gnu': 'aarch64-unknown-linux-gnu',
  'arm-unknown-linux-gnueabihf': 'arm-unknown-linux-gnueabihf',
  'i386-unknown-linux-musl': 'i386-unknown-linux-musl',
  'x86_64-unknown-linux-musl': 'x86_64-unknown-linux-musl',
  'aarch64-unknown-linux-musl': 'aarch64-unknown-linux-musl',
  'arm-unknown-linux-musleabihf': 'arm-unknown-linux-musleabihf',
  'x86_64-pc-windows-msvc': 'x86_64-pc-windows-msvc',
  'i686-pc-windows-msvc': 'i686-pc-windows-msvc',
  'aarch64-pc-windows-msvc': 'aarch64-pc-windows-msvc',
  'arm-pc-windows-msvc': 'arm-pc-windows-msvc',
  'wasm32-unknown-wasi': 'wasm32-unknown-wasi',
  'wasm64-unknown-wasi': 'wasm64-unknown-wasi',
}

function dirExists(p: string) {
  try {
    const st = statSync(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

export class LLVM implements IToolchain {
  id: string;
  arch: string;
  constructor(public name: string, target: string) {
    this.id = name + '-' + target;
    this.target = target;
    this.arch = target.split('-')[0];

    const sysrootsDir = process.platform === 'win32'
      ? join(homedir(), 'AppData', 'Local', 'smake', 'sysroots')
      : join(homedir(), '.smake', 'sysroots');
    if (this.platform === 'win32') {
      const dirname = this.getMsvcLibDirname();
      if (!process.env.SMAKE_LLVM_MSVC_PATH || !dirExists(join(process.env.SMAKE_LLVM_MSVC_PATH, 'lib', dirname))) {
        if (dirExists(join(sysrootsDir, 'msvc', 'vc', 'lib', dirname))) {
          const info = require(join(sysrootsDir, 'msvc', 'info.json'));
          this.MSVC_VERSION = info._MSC_VER;
          this.MSVC_PATH = join(sysrootsDir, 'msvc', 'vc');
          this.WINDOWS_KITS_10_PATH = join(sysrootsDir, 'msvc', 'kits');
          this.WINDOWS_KITS_10_VERSION = info.win_kits_ver;
        } else {
          this.throwError();
        }
      }
    } else if (this.platform === 'darwin') {
      if (process.platform !== 'darwin')
        this.throwError();
    } else {
      const dir = process.env[
        'SMAKE_LLVM_SYSROOT_' + this.target.toUpperCase().replace(/-/g, '_')
      ];
      if (dir && dirExists(dir)) {
        this.sysroot = dir;
      } else {
        const dir = join(sysrootsDir, this.target);
        if (dirExists(dir)) {
          this.sysroot = dir;
        } else {
          this.throwError();
        }
      }
    }
  }

  getMsvcLibDirname() {
    if (this.arch.endsWith('86'))
      return 'x86';
    if (this.arch.endsWith('_64'))
      return 'x64';
    if (/a.+64/.test(this.arch))
      return 'arm64';
    if (this.arch.startsWith('arm'))
      return 'arm';
    return 'unknown-arch';
  }

  error = '';

  throwError() {
    this.error = `error: sysroot '${this.target}' not installed`;
  };

  MSVC_VERSION = process.env.SMAKE_LLVM_MSVC_VERSION;
  MSVC_PATH = process.env.SMAKE_LLVM_MSVC_PATH;
  WINDOWS_KITS_10_PATH = process.env.SMAKE_LLVM_WINDOWS_KITS_10_PATH;
  WINDOWS_KITS_10_VERSION = process.env.SMAKE_LLVM_WINDOWS_KITS_10_VERSION;
  useLldLink = false;
  // lldLinkDebugFlags = process.argv.includes('--debug') ? ' /DEBUG' : '';

  protected _files!: string[];
  get files() {
    if (this._files === undefined) this._files = [];
    return this._files;
  }
  set files(v) {
    this._files = v;
  }

  protected _target!: string;
  get target() {
    if (this._target === undefined) this._target = 'arm64-apple-darwin';
    return this._target;
  }
  set target(v) {
    this._target = v;
  }

  stdc: 'c99' | 'c11' | 'c17' | 'c18' = 'c17';
  stdcxx: 'c++98' | 'c++03' | 'c++11' | 'c++14' | 'c++17' | 'c++20' | 'c++2a' =
    'c++17';

  targetPlatformVersion = '';

  get platform() {
    if (this.target.includes('darwin')) return 'darwin';
    if (this.target.includes('windows')) return 'win32';
    if (this.target.includes('win32')) return 'win32';
    if (this.target.includes('linux')) return 'linux';
    if (this.target.includes('wasm')) return 'wasm';
    return 'none';
  }

  public sysroot!: string;

  protected _type!: 'executable' | 'shared' | 'static';
  get type() {
    if (this._type === undefined) this._type = 'executable';
    return this._type;
  }
  set type(v) {
    this._type = v;
  }

  protected _prefix!: string;
  get prefix() {
    if (this._prefix === undefined) {
      if (this.platform === 'darwin') this._prefix = '';
      else
        this._prefix = process.env.SMAKE_LLVM_PREFIX || '';
    }
    return this._prefix;
  }
  set prefix(v) {
    this._prefix = v;
  }

  protected _cxx!: string;
  get cxx() {
    if (this._cxx === undefined) this._cxx = 'clang++';
    return this._cxx;
  }
  set cxx(v) {
    this._cxx = v;
  }

  protected _cc!: string;
  get cc() {
    if (this._cc === undefined) this._cc = 'clang';
    return this._cc;
  }
  set cc(v) {
    this._cc = v;
  }

  protected _ld!: string;
  get ld() {
    if (this._ld === undefined) {
      if (this.platform === 'win32' && this.useLldLink) this._ld = 'lld-link';
      else
        this._ld = 'clang++';
    }
    return this._ld;
  }
  set ld(v) {
    this._ld = v;
  }

  protected _sh!: string;
  get sh() {
    if (this._sh === undefined) {
      if (this.platform === 'win32' && this.useLldLink) this._sh = 'lld-link';
      else
        this._sh = 'clang++';
    }
    return this._sh;
  }
  set sh(v) {
    this._sh = v;
  }

  protected _ar!: string;
  get ar() {
    if (this._ar === undefined) {
      if (this.platform === 'darwin') this._ar = 'ar';
      else this._ar = 'llvm-ar';
    }
    return this._ar;
  }
  set ar(v) {
    this._ar = v;
  }

  protected _useClangHeaders!: boolean;
  get useClangHeaders() {
    if (this._useClangHeaders === undefined) this._useClangHeaders = false;
    return this._useClangHeaders;
  }
  set useClangHeaders(v) {
    this._useClangHeaders = v;
  }

  protected _includedirs!: string[];
  get includedirs() {
    if (this._includedirs === undefined) this._includedirs = [];
    return this._includedirs;
  }
  set includedirs(v) {
    this._includedirs = v;
  }

  protected _sysIncludedirs!: string[];
  get sysIncludedirs() {
    if (this._sysIncludedirs === undefined) {
      let dirs: string[] = [];
      if (this.useClangHeaders && process.env.SMAKE_LLVM_CLANG_PATH)
        dirs = [...dirs, process.env.SMAKE_LLVM_CLANG_PATH + '/include'];
      if (this.platform === 'win32')
        dirs = [
          ...dirs,
          `${this.MSVC_PATH}/include`,
          `${this.MSVC_PATH}/atlmfc/include`,
          `${this.WINDOWS_KITS_10_PATH}/Include/${this.WINDOWS_KITS_10_VERSION}/ucrt`,
          `${this.WINDOWS_KITS_10_PATH}/Include/${this.WINDOWS_KITS_10_VERSION}/um`,
          `${this.WINDOWS_KITS_10_PATH}/Include/${this.WINDOWS_KITS_10_VERSION}/shared`,
          `${this.WINDOWS_KITS_10_PATH}/Include/${this.WINDOWS_KITS_10_VERSION}/winrt`,
          `${this.WINDOWS_KITS_10_PATH}/Include/${this.WINDOWS_KITS_10_VERSION}/cppwinrt`,
        ];
      this._sysIncludedirs = dirs;
    }
    return this._sysIncludedirs;
  }
  set sysIncludedirs(v) {
    this._sysIncludedirs = v;
  }

  get buildDir() {
    return '.smake';
  }

  get cacheDirname() {
    return '.' + this.id;
  }

  protected _linkdirs!: string[];
  get linkdirs() {
    if (this._linkdirs === undefined) {
      let dirs = [this.buildDir];
      if (this.platform === 'win32') {
        const dir = this.target.startsWith('x86_64') ? 'x64' : 'x86';
        this._linkdirs = [
          ...dirs,
          `${this.MSVC_PATH}/lib/${dir}`,
          `${this.MSVC_PATH}/atlmfc/lib/${dir}`,
          `${this.WINDOWS_KITS_10_PATH}/Lib/${this.WINDOWS_KITS_10_VERSION}/ucrt/${dir}`,
          `${this.WINDOWS_KITS_10_PATH}/Lib/${this.WINDOWS_KITS_10_VERSION}/um/${dir}`,
        ];
      }
      else this._linkdirs = dirs;
    }
    return this._linkdirs;
  }
  set linkdirs(v) {
    this._linkdirs = v;
  }

  protected _libs!: Array<string | LLVM>;
  get libs() {
    if (this._libs === undefined) {
      if (this.platform === 'win32' && this.useLldLink) this._libs = ['libcmt'];
      else this._libs = [];
    }
    return this._libs;
  }
  set libs(v) {
    this._libs = v;
  }

  protected _cflags!: string[];
  get cflags() {
    if (this._cflags === undefined) this._cflags = [];
    return this._cflags;
  }
  set cflags(v) {
    this._cflags = v;
  }

  protected _cxxflags!: string[];
  get cxxflags() {
    if (this._cxxflags === undefined) this._cxxflags = [];
    return this._cxxflags;
  }
  set cxxflags(v) {
    this._cxxflags = v;
  }

  protected _asmflags!: string[];
  get asmflags() {
    if (this._asmflags === undefined) this._asmflags = [];
    return this._asmflags;
  }
  set asmflags(v) {
    this._asmflags = v;
  }

  protected _cxflags!: string[];
  get cxflags() {
    if (this._cxflags === undefined) {
      switch (this.platform) {
        case 'darwin':
          this._cxflags = (() => {
            const flags = ['-Qunused-arguments'];
            if (this.type === 'shared') flags.push('-fPIC');
            // else if (this.type === 'executable')
            //   flags.push('-fvisibility=hidden  -fvisibility-inlines-hidden');
            return flags;
          })();
          break
        case 'win32':
          this._cxflags = (() => {
            const flags = [
              '-Qunused-arguments',
              `-fmsc-version=${this.MSVC_VERSION}`,
              '-fms-extensions',
              '-fms-compatibility',
              '-fdelayed-template-parsing',
              '-DWIN32',
              '-D_WINDOWS',
              '-D_CRT_STDIO_LEGACY_WIDE_SPECIFIERS',
              '-D_CRT_SECURE_NO_WARNINGS',
              `-D_MSC_VER=${this.MSVC_VERSION}`,
            ];
            // if (this.type === 'executable')
            //   flags.push('-fvisibility=hidden  -fvisibility-inlines-hidden');
            return flags;
          })();
          break
        case 'linux':
          this._cxflags = (() => {
            const flags = [`--sysroot ${this.sysroot}`, '-Qunused-arguments'];
            if (this.type === 'shared') flags.push('-fPIC');
            // else if (this.type === 'executable')
            //   flags.push('-fvisibility=hidden  -fvisibility-inlines-hidden');
            return flags;
          })();
          break
        case 'wasm':
          this._cxflags = (() => {
            const flags = [
              `--sysroot ${this.sysroot}`,
              '-Qunused-arguments',
              '-Wl,--no-entry',
              '-Wl,--export-all',
            ];
            if (this.type === 'shared') flags.push('-fPIC');
            return flags;
          })();
          break
        case 'none':
          this._cxflags = []
          break;
      }
    }
    return this._cxflags;
  }
  set cxflags(v) {
    this._cxflags = v;
  }

  protected _ldflags!: string[];
  get ldflags() {
    if (this._ldflags === undefined) {
      switch (this.platform) {
        case 'darwin':
          this._ldflags = (() => {
            const flags = [
              `-target ${this.target}${this.targetPlatformVersion}`,
            ];
            if (this.libs.length)
              flags.push('-Xlinker -rpath -Xlinker @loader_path');
            return flags;
          })();
          break
        case 'win32':
          this._ldflags = (() => {
            if (this.useLldLink) return [];
            return [
              '-fuse-ld=lld',
              `-target ${this.target}${this.targetPlatformVersion}`,
            ];
          })();
          break
        case 'linux':
          this._ldflags = (() => {
            const flags = [
              `--sysroot ${this.sysroot}`,
              '-fuse-ld=lld',
              `-target ${this.target}${this.targetPlatformVersion}`,
            ];
            if (this.libs.length) flags.push(`-Wl,-rpath,'$$ORIGIN'`);
            return flags;
          })();
          break
        case 'wasm':
          this._ldflags = (() => {
            const flags = [
              `--sysroot ${this.sysroot}`,
              '-fuse-ld=lld',
              `-target ${this.target}${this.targetPlatformVersion}`,
              '-Wl,--no-entry',
              '-Wl,--export-all',
              '-nostdlib',
            ];
            return flags;
          })();
          break
        case 'none':
          this._ldflags = []
          break
      }
    }
    return this._ldflags;
  }
  set ldflags(v) {
    this._ldflags = v;
  }

  protected _shflags!: string[];
  get shflags() {
    if (this._shflags === undefined) {
      switch (this.platform) {
        case 'darwin':
          this._shflags = (() => {
            const flags = [
              `-target ${this.target}${this.targetPlatformVersion}`,
              '-fPIC',
              `-install_name @rpath/${this.outputFilename}`,
            ];
            if (this.libs.length)
              flags.push('-Xlinker -rpath -Xlinker @loader_path');
            return flags;
          })();
          break
        case 'win32':
          this._shflags = (() => {
            if (this.useLldLink) return ['/DLL'];
            return [
              '-shared',
              '-fuse-ld=lld',
              `-target ${this.target}${this.targetPlatformVersion}`,
            ];
          })();
          break
        case 'linux':
          this._shflags = (() => {
            return [
              `--sysroot ${this.sysroot}`,
              '-fuse-ld=lld',
              `-target ${this.target}${this.targetPlatformVersion}`,
              '-fPIC',
              '-shared',
            ];
          })();
          break
        case 'wasm':
          this._shflags = (() => {
            return [
              `--sysroot ${this.sysroot}`,
              '-fuse-ld=lld',
              `-target ${this.target}${this.targetPlatformVersion}`,
              '-fPIC',
              '-shared',
              '-Wl,--no-entry',
              '-Wl,--export-all',
              '-nostdlib',
            ];
          })();
          break
        case 'none':
          this._shflags = []
          break
      }
    }
    return this._shflags;
  }
  set shflags(v) {
    this._shflags = v;
  }

  protected _arflags!: string[];
  get arflags() {
    if (this._arflags === undefined) this._arflags = [];
    return this._arflags;
  }
  set arflags(v) {
    this._arflags = v;
  }

  protected _arobjs!: string[];
  get arobjs() {
    if (this._arobjs === undefined) this._arobjs = [];
    return this._arobjs;
  }
  set arobjs(v) {
    this._arobjs = v;
  }

  // protected _debugFlags = process.argv.includes('--debug') ? ' -g' : '';
  // get debugFlags() {
  //   return this._debugFlags;
  // }
  // set debugFlags(v) {
  //   this._debugFlags = v;
  // }

  protected _objOutDirname!: string;
  get objOutDirname() {
    if (this._objOutDirname === undefined) this._objOutDirname = 'objs';
    return this._objOutDirname;
  }
  set objOutDirname(v) {
    this._objOutDirname = v;
  }

  protected _objOutSuffix!: string;
  get objOutSuffix() {
    if (this._objOutSuffix === undefined) this._objOutSuffix = '.o';
    return this._objOutSuffix;
  }
  set objOutSuffix(v) {
    this._objOutSuffix = v;
  }

  protected _executableOutPrefix!: string;
  get executableOutPrefix() {
    if (this._executableOutPrefix === undefined) this._executableOutPrefix = '';
    return this._executableOutPrefix;
  }
  set executableOutPrefix(v) {
    this._executableOutPrefix = v;
  }

  protected _executableOutSuffix!: string;
  get executableOutSuffix() {
    if (this._executableOutSuffix === undefined) {
      switch (this.platform) {
        case 'win32':
          this._executableOutSuffix = '.exe';
          break;
        case 'wasm':
          this._executableOutSuffix = '.wasm';
          break;
        default:
          this._executableOutSuffix = '';
      }
    }
    return this._executableOutSuffix;
  }
  set executableOutSuffix(v) {
    this._executableOutSuffix = v;
  }

  protected _sharedOutPrefix!: string;
  get sharedOutPrefix() {
    if (this._sharedOutPrefix === undefined) {
      switch (this.platform) {
        case 'win32':
          this._sharedOutPrefix = '';
          break;
        default:
          this._sharedOutPrefix = 'lib';
      }
    }
    return this._sharedOutPrefix;
  }
  set sharedOutPrefix(v) {
    this._sharedOutPrefix = v;
  }

  protected _sharedOutSuffix!: string;
  get sharedOutSuffix() {
    if (this._sharedOutSuffix === undefined) {
      switch (this.platform) {
        case 'darwin':
          this._sharedOutSuffix = '.dylib';
          break;
        case 'win32':
          this._sharedOutSuffix = '.dll';
          break;
        default:
          this._sharedOutSuffix = '.so';
      }
    }
    return this._sharedOutSuffix;
  }
  set sharedOutSuffix(v) {
    this._sharedOutSuffix = v;
  }

  protected _staticOutPrefix!: string;
  get staticOutPrefix() {
    if (this._staticOutPrefix === undefined) {
      switch (this.platform) {
        case 'win32':
          this._staticOutPrefix = '';
          break;
        default:
          this._staticOutPrefix = 'lib';
      }
    }
    return this._staticOutPrefix;
  }
  set staticOutPrefix(v) {
    this._staticOutPrefix = v;
  }

  protected _staticOutSuffix!: string;
  get staticOutSuffix() {
    if (this._staticOutSuffix === undefined) {
      switch (this.platform) {
        case 'win32':
          this._staticOutSuffix = '.lib';
          break;
        default:
          this._staticOutSuffix = '.a';
      }
    }
    return this._staticOutSuffix;
  }
  set staticOutSuffix(v) {
    this._staticOutSuffix = v;
  }

  protected _outputFileBasename!: string;
  get outputFileBasename() {
    if (this._outputFileBasename === undefined) this._outputFileBasename = this.name;
    return this._outputFileBasename;
  }
  set outputFileBasename(v) {
    this._outputFileBasename = v;
  }

  protected _outputFilename!: string;
  get outputFilename() {
    if (this._outputFilename === undefined) {
      switch (this.type) {
        case 'executable':
          this._outputFilename = (
            this.executableOutPrefix +
            this.outputFileBasename +
            this.executableOutSuffix
          );
          break;
        case 'shared':
          this._outputFilename = (
            this.sharedOutPrefix +
            this.outputFileBasename +
            this.sharedOutSuffix
          );
          break;
        case 'static':
          this._outputFilename = (
            this.staticOutPrefix +
            this.outputFileBasename +
            this.staticOutSuffix
          );
          break;
      }
    }
    return this._outputFilename;
  }
  set outputFilename(v) {
    this._outputFilename = v;
  }

  get debug() {
    return process.env.mode === 'debug';
  }

  protected _outputDir!: string;
  get outputDir() {
    if (this._outputDir === undefined)
      this._outputDir = join(
        this.buildDir,
        this.name,
        this.debug ? 'debug' : 'release',
        this.target
      );
    return this._outputDir;
  }
  set outputDir(v) {
    this._outputDir = v;
  }

  get outputPath() {
    return join(this.outputDir, this.outputFilename);
  }

  protected _ninjaFilePath!: string;
  get ninjaFilePath() {
    if (this._ninjaFilePath === undefined)
      this._ninjaFilePath = join(this.buildDir, this.id + '.ninja');
    return this._ninjaFilePath;
  }
  set ninjaFilePath(v) {
    this._ninjaFilePath = v;
  }

  compdbFilePath = 'compile_commands.json';

  cFileExts = ['.c'];
  cxxFileExts = ['.cc', '.cpp', '.cxx', '.C'];
  asmFileExts = ['.s', '.S', '.asm'];

  isCFile(f: string) {
    for (const ext of this.cFileExts) if (f.endsWith(ext)) return true;
    return false;
  }

  isCXXFile(f: string) {
    for (const ext of this.cxxFileExts) if (f.endsWith(ext)) return true;
    return false;
  }

  isASMFile(f: string) {
    for (const ext of this.asmFileExts) if (f.endsWith(ext)) return true;
    return false;
  }

  async generateCommands(_first: boolean, _last: boolean): Promise<ICommand[]> {
    if (this.error)
      return [
        {
          label: red(this.error),
          command: async () => { }
        }
      ]
    return [
      {
        label: magenta(`Generating build.ninja for ${this.id}`),
        command: async (opts: any) => {
          const { cmd, outs } = await this.buildObjs();
          const content = [
            await this.buildCCRules(opts),
            await this.buildCXXRules(opts),
            await this.buildASMRules(opts),
            cmd,
          ];
          switch (this.type) {
            case 'executable':
              content.push(await this.buildExecutable(opts, outs, this.outputPath));
              break;
            case 'shared':
              content.push(await this.buildShared(opts, outs, this.outputPath));
              break;
            case 'static':
              content.push(await this.buildStatic(outs, this.outputPath));
              break;
          }

          content.push('');
          mkdirSync(this.buildDir, { recursive: true });
          writeFileSync(this.ninjaFilePath, content.join('\n'));
        },
      },
      {
        label: magenta(`Building ${this.id}`),
        command: async (opts: any) => {
          try {
            let cmd = `ninja -f ${this.ninjaFilePath}`;
            if (opts.verbose) cmd += ' --verbose';
            execSync(cmd, {
              stdio: 'inherit',
            });
            if (this.type === 'executable') {
              const llvmLibs = this.libs.filter(
                (x) => x instanceof LLVM && x.type === 'shared'
              ) as LLVM[];
              for (const lib of llvmLibs) {
                console.log(
                  'copy',
                  green(lib.outputPath),
                  'to',
                  cyan(this.outputDir)
                );
                copyFileSync(
                  lib.outputPath,
                  join(this.outputDir, lib.outputFilename)
                );
              }
            }
          } catch {
            throw '';
          }
        },
      },
    ];
  }

  async buildCCRules(opts: any) {
    let compiler = this.prefix + this.cc;
    if (this.target)
      compiler += ` -target ${this.target}${this.targetPlatformVersion}`;
    const flags =
      [
        ...this.sysIncludedirs.map((x) => `-isystem ${quote(x)}`),
        ...this.includedirs.map((x) => `-I${quote(x)}`),
        ...this.cflags,
        ...this.cxflags,
      ].join(' ') + (opts.debug ? ' -g' : '');
    return [
      `rule _CC`,
      '  depfile = $out.d',
      `  command = ${compiler} -MD -MF $out.d ${flags} -std=${this.stdc}  -c $in -o $out`,
    ].join('\n');
  }

  async buildCXXRules(opts: any) {
    let compiler = this.prefix + this.cxx;
    if (this.target)
      compiler += ` -target ${this.target}${this.targetPlatformVersion}`;
    const flags =
      [
        ...this.sysIncludedirs.map((x) => `-isystem ${quote(x)}`),
        ...this.includedirs.map((x) => `-I${quote(x)}`),
        ...this.cxxflags,
        ...this.cxflags,
      ].join(' ') + (opts.debug ? ' -g' : '');

    return [
      `rule _CXX`,
      '  depfile = $out.d',
      `  command = ${compiler} -MD -MF $out.d ${flags} -std=${this.stdcxx} -c $in -o $out`,
    ].join('\n');
  }

  async buildASMRules(opts: any) {
    let compiler = this.prefix + this.cc;
    if (this.target)
      compiler += ` -target ${this.target}${this.targetPlatformVersion}`;
    const flags =
      [
        ...this.sysIncludedirs.map((x) => `-isystem ${quote(x)}`),
        ...this.includedirs.map((x) => `-I${quote(x)}`),
        ...this.cflags,
        ...this.asmflags,
      ].join(' ') + (opts.debug ? ' -g' : '');
    return [
      `rule _ASM`,
      '  depfile = $out.d',
      `  command = ${compiler} -MD -MF $out.d ${flags} -c $in -o $out`,
    ].join('\n');
  }

  async buildObjs() {
    const outDir = join(this.buildDir, this.cacheDirname, this.objOutDirname);

    const res = this.files.map((f) => {
      const out = join(outDir, f.replace(/\.\./g, '_') + this.objOutSuffix);
      return {
        cmd: `build ${out}: _${this.isCXXFile(f) ? 'CXX' : this.isASMFile(f) ? 'ASM' : 'CC'
          } ${f}`,
        out,
      };
    });
    const cmd = res.map((x) => x.cmd).join('\n');
    const outs = res.map((x) => x.out);
    return { cmd, outs };
  }

  async buildExecutable(opts: any, objFiles: string[], distFile: string) {
    const linker = this.prefix + this.ld;
    if (this.useLldLink && this.platform === 'win32')
      return [
        `rule _LD`,
        `  command = ${[
          linker,
          ...this.linkdirs.map((x) => `/libpath:${quote(x)}`),
          ...this.libs
            .filter((x) => x instanceof LLVM)
            .map((x: any) => `/libpath${x.outputDir}`),
          ...this.libs.map(
            (x) => `${typeof x === 'string' ? x : x.outputFileBasename}.lib`
          ),
          ...this.ldflags,
        ].join(' ') + (opts.debug ? ' /DEBUG' : '')
        } $in /out:$out`,
        '',
        `build ${distFile}: _LD ${objFiles.join(' ')}`,
      ].join('\n');
    return [
      `rule _LD`,
      `  command = ${[
        linker,
        ...this.linkdirs.map((x) => `-L${quote(x)}`),
        ...this.libs
          .filter((x) => x instanceof LLVM)
          .map((x: any) => `-L${x.outputDir}`),
        ...this.libs.map(
          (x) => `-l${typeof x === 'string' ? x : x.outputFileBasename}`
        ),
        ...this.ldflags,
      ].join(' ') + (opts.debug ? ' -g' : '')
      } $in -o $out`,
      '',
      `build ${distFile}: _LD ${objFiles.join(' ')}`,
    ].join('\n');
  }

  async buildShared(opts: any, objFiles: string[], distFile: string) {
    const linker = this.prefix + this.sh;
    if (this.useLldLink && this.platform === 'win32')
      return [
        `rule _SH`,
        `  command = ${[
          linker,
          ...this.linkdirs.map((x) => `/libpath:${quote(x)}`),
          ...this.libs
            .filter((x) => x instanceof LLVM)
            .map((x: any) => `/libpath:${x.outputDir}`),
          ...this.libs.map(
            (x) => `${typeof x === 'string' ? x : x.outputFileBasename}.lib`
          ),
          ...this.shflags,
        ].join(' ') + (opts.debug ? ' /DEBUG' : '')
        } $in /out:$out`,
        '',
        `build ${distFile}: _SH ${objFiles.join(' ')}`,
      ].join('\n');
    return [
      `rule _SH`,
      `  command = ${[
        linker,
        ...this.linkdirs.map((x) => `-L${quote(x)}`),
        ...this.libs
          .filter((x) => x instanceof LLVM)
          .map((x: any) => `-L${x.outputDir}`),
        ...this.libs.map(
          (x) => `-l${typeof x === 'string' ? x : x.outputFileBasename}`
        ),
        ...this.shflags,
        '-shared',
      ].join(' ') + (opts.debug ? ' -g' : '')
      } $in -o $out`,
      '',
      `build ${distFile}: _SH ${objFiles.join(' ')}`,
    ].join('\n');
  }

  async buildStatic(objFiles: string[], distFile: string) {
    const linker = this.prefix + this.ar;
    return [
      `rule _AR`,
      `  command = ${[linker, ...this.arflags].join(
        ' '
      )} crs $out $in ${this.arobjs.join(' ')}`,
      '',
      `build ${distFile}: _AR ${objFiles.join(' ')}`,
    ].join('\n');
  }

  async clean() {
    console.log(yellow(`rm: ${this.ninjaFilePath}`));
    rmSync(this.ninjaFilePath, {
      force: true,
    });
    console.log(yellow(`rm: ${this.outputPath}`));
    rmSync(this.outputPath, {
      force: true,
    });

    if (this.type === 'executable') {
      const llvmLibs = this.libs.filter(
        (x) => x instanceof LLVM && x.type === 'shared'
      ) as LLVM[];
      for (const lib of llvmLibs) {
        const p = join(this.outputDir, lib.outputFilename);
        console.log(yellow(`rm: ${p}`));
        rmSync(p, {
          force: true,
        });
      }
    }

    if (this.type === 'shared' && this.platform === 'win32') {
      const p = this.outputPath.replace(
        new RegExp(this.sharedOutSuffix.replace(/\./g, '\\.') + '$'),
        '.lib'
      );
      console.log(yellow(`rm: ${p}`));
      rmSync(p, {
        force: true,
      });
    }
  }
}
