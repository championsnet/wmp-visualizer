// Builds the TV apps from the website: LG webOS (.ipk), Samsung Tizen (.wgt,
// unsigned) and Android TV (.apk). The site's ES modules are bundled into one
// classic script so the pages also run from file:// on the TVs.
// Usage: node scripts/build-tv.mjs [webos] [tizen] [android]   (default: all)
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tv = join(root, 'tv');
const dist = join(tv, 'dist');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const wanted = process.argv.slice(2);
const targets = wanted.length ? wanted : ['webos', 'tizen', 'android'];
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

function png(svg, out, w, h = w) {
  run('rsvg-convert', ['-w', String(w), '-h', String(h), '-o', out, svg]);
}

// The web app, bundled, for one platform.
function www(platform, out) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  run('npx', ['--yes', 'esbuild@0.28.2', join(root, 'js/main.js'), '--bundle', '--format=iife',
    '--target=chrome53', '--minify', '--log-level=warning', `--outfile=${join(out, 'app.js')}`]);
  let html = readFileSync(join(root, 'index.html'), 'utf8');
  html = html.replace('<script type="module" src="js/main.js"></script>',
    `<script>window.TV_PLATFORM = '${platform}';</script>\n  <script src="app.js"></script>`);
  html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
  writeFileSync(join(out, 'index.html'), html);
  cpSync(join(root, 'css'), join(out, 'css'), { recursive: true });
  cpSync(join(root, 'vendor'), join(out, 'vendor'), { recursive: true });
  cpSync(join(root, 'icon.svg'), join(out, 'icon.svg'));
}

mkdirSync(dist, { recursive: true });

if (targets.includes('webos')) {
  const dir = join(dist, 'webos-app');
  www('webos', dir);
  const info = JSON.parse(readFileSync(join(tv, 'webos/appinfo.json'), 'utf8'));
  info.version = version;
  writeFileSync(join(dir, 'appinfo.json'), JSON.stringify(info, null, 2));
  png(join(root, 'icon.svg'), join(dir, 'icon.png'), 80);
  png(join(root, 'icon.svg'), join(dir, 'largeIcon.png'), 130);
  png(join(tv, 'banner.svg'), join(dir, 'splash.png'), 1920, 1080);
  run('npx', ['--yes', '-p', '@webos-tools/cli@3', 'ares-package', '--no-minify', dir, '-o', dist]);
}

if (targets.includes('tizen')) {
  const dir = join(dist, 'tizen-app');
  www('tizen', dir);
  writeFileSync(join(dir, 'config.xml'),
    readFileSync(join(tv, 'tizen/config.xml'), 'utf8').replace(/(<widget[^>]*version=")[^"]*/, `$1${version}`));
  png(join(root, 'icon.svg'), join(dir, 'icon.png'), 512);
  // A .wgt is a zip. Samsung TVs only install it once it is signed with a
  // Samsung certificate (Tizen Studio > Certificate Manager), see tv/README.md.
  const wgt = join(dist, 'WMPVisualizer-unsigned.wgt');
  rmSync(wgt, { force: true });
  run('zip', ['-qr', wgt, '.'], { cwd: dir });
}

if (targets.includes('android')) {
  const proj = join(tv, 'android');
  const res = join(proj, 'app/src/main/res');
  www('android', join(proj, 'app/src/main/assets/www'));
  mkdirSync(join(res, 'mipmap-xxxhdpi'), { recursive: true });
  mkdirSync(join(res, 'drawable-xhdpi'), { recursive: true });
  png(join(root, 'icon.svg'), join(res, 'mipmap-xxxhdpi/ic_launcher.png'), 192);
  png(join(tv, 'banner.svg'), join(res, 'drawable-xhdpi/banner.png'), 320, 180);
  const env = { ...process.env };
  env.JAVA_HOME ||= '/opt/homebrew/opt/openjdk@17';
  env.ANDROID_HOME ||= join(process.env.HOME, 'Library/Android/sdk');
  if (!existsSync(join(proj, 'gradlew'))) {
    // Pin Gradle 8.14 for the Android plugin; made in an empty folder so a
    // newer system Gradle never has to load the project itself.
    const tmp = mkdtempSync(join(tmpdir(), 'wrapper-'));
    writeFileSync(join(tmp, 'settings.gradle'), '');
    run('gradle', ['wrapper', '--gradle-version', '8.14.3', '--quiet'], { cwd: tmp, env });
    for (const f of ['gradlew', 'gradlew.bat', 'gradle']) cpSync(join(tmp, f), join(proj, f), { recursive: true });
    rmSync(tmp, { recursive: true, force: true });
  }
  run('./gradlew', ['--quiet', 'assembleRelease'], { cwd: proj, env });
  cpSync(join(proj, 'app/build/outputs/apk/release/app-release.apk'), join(dist, 'WMPVisualizer.apk'));
}

console.log(`TV builds in ${dist}`);
