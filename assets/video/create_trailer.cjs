#!/usr/bin/env node

const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SCRIPT_DIR = path.resolve(__dirname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_SCREENSHOTS_DIR = path.join(REPO_ROOT, 'assets', 'img', 'screenshots');
const DEFAULT_OUTPUT_DIR = path.join(SCRIPT_DIR, 'trailer');
const CLIPS_DIRNAME = 'clips';
const MANIFEST_FILENAME = 'manifest.json';
const FINAL_VIDEO_FILENAME = 'trailer.mp4';
const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const VIDEO_FPS = 60;
const VIDEO_BITRATE = '12000k';
const VIDEO_MAXRATE = '12000k';
const VIDEO_BUFSIZE = '24000k';
const AUDIO_BITRATE = '192k';
const DEFAULT_TOTAL_DURATION_SECONDS = 60;
const DEFAULT_IMAGE_ORDER = [
  'Dashboard.png',
  'Invoices.png',
  'New Invoice.png',
  'New Client.png',
  'Templates.png'
];

function parseArgs(argv) {
  const options = {
    screenshotsDir: DEFAULT_SCREENSHOTS_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    durationSeconds: DEFAULT_TOTAL_DURATION_SECONDS,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg.startsWith('--screenshots-dir=')) {
      const rawValue = arg.slice('--screenshots-dir='.length).trim();
      options.screenshotsDir = rawValue ? path.resolve(rawValue) : DEFAULT_SCREENSHOTS_DIR;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      const rawValue = arg.slice('--output-dir='.length).trim();
      options.outputDir = rawValue ? path.resolve(rawValue) : DEFAULT_OUTPUT_DIR;
      continue;
    }

    if (arg.startsWith('--duration=')) {
      const rawValue = arg.slice('--duration='.length).trim();
      const parsedValue = Number(rawValue);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error(`Invalid duration value: ${rawValue}`);
      }
      options.durationSeconds = parsedValue;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log('Create a 60-second trailer for Roselt Invoice Generator from screenshots.');
  console.log('');
  console.log('Usage: node assets/video/create_trailer.cjs [options]');
  console.log('');
  console.log('Options:');
  console.log(`  --screenshots-dir=${DEFAULT_SCREENSHOTS_DIR}  Source screenshots directory.`);
  console.log(`  --output-dir=${DEFAULT_OUTPUT_DIR}            Output directory for clips and trailer.`);
  console.log(`  --duration=${DEFAULT_TOTAL_DURATION_SECONDS}                              Total trailer length in seconds.`);
  console.log('  --help, -h                                   Show this help.');
}

async function ensureFfmpegInstalled() {
  await runCommand('ffmpeg', ['-version'], { cwd: REPO_ROOT, stdio: 'ignore' });
}

async function ensureCleanOutput(outputDir) {
  await fsp.rm(outputDir, { recursive: true, force: true });
  await fsp.mkdir(path.join(outputDir, CLIPS_DIRNAME), { recursive: true });
}

async function collectScreenshotPaths(screenshotsDir) {
  let dirEntries;
  try {
    dirEntries = await fsp.readdir(screenshotsDir, { withFileTypes: true });
  } catch {
    throw new Error(`Unable to read screenshots directory: ${screenshotsDir}`);
  }

  const imagePaths = dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name));

  if (imagePaths.length === 0) {
    throw new Error(`No screenshots found in ${screenshotsDir}. Add PNG/JPG/WebP images and re-run.`);
  }

  const preferredOrder = new Map(DEFAULT_IMAGE_ORDER.map((name, index) => [name.toLowerCase(), index]));

  return imagePaths
    .sort((left, right) => {
      const leftIndex = preferredOrder.has(left.toLowerCase())
        ? preferredOrder.get(left.toLowerCase())
        : Number.MAX_SAFE_INTEGER;
      const rightIndex = preferredOrder.has(right.toLowerCase())
        ? preferredOrder.get(right.toLowerCase())
        : Number.MAX_SAFE_INTEGER;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    })
    .map((name) => path.join(screenshotsDir, name));
}

function sanitizeId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'slide';
}

function roundToMilliseconds(value) {
  return Math.round(value * 1000) / 1000;
}

function buildShots(screenshotPaths, totalDurationSeconds) {
  const shotCount = screenshotPaths.length;
  const evenDuration = totalDurationSeconds / shotCount;
  let remainingDuration = totalDurationSeconds;

  return screenshotPaths.map((filePath, index) => {
    const baseName = path.parse(filePath).name;
    const durationSeconds = index === shotCount - 1
      ? roundToMilliseconds(remainingDuration)
      : roundToMilliseconds(evenDuration);
    remainingDuration = roundToMilliseconds(remainingDuration - durationSeconds);
    const id = `${String(index + 1).padStart(2, '0')}_${sanitizeId(baseName)}`;

    return {
      id,
      title: baseName,
      sourcePath: filePath,
      durationSeconds,
      clipRelativePath: `${CLIPS_DIRNAME}/${id}.mp4`
    };
  });
}

function buildClipPath(outputDir, shot) {
  return path.join(outputDir, shot.clipRelativePath);
}

async function renderShotClip(outputDir, shot) {
  const clipPath = buildClipPath(outputDir, shot);
  const fadeDuration = roundToMilliseconds(Math.min(0.8, shot.durationSeconds / 4));
  const fadeOutStart = roundToMilliseconds(Math.max(0, shot.durationSeconds - fadeDuration));
  const filterChain = [
    `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
    'format=yuv420p',
    `fade=t=in:st=0:d=${fadeDuration}`,
    `fade=t=out:st=${fadeOutStart}:d=${fadeDuration}`
  ].join(',');

  console.log(`[render] ${shot.id}: ${path.basename(shot.sourcePath)} (${shot.durationSeconds}s)`);

  await runCommand(
    'ffmpeg',
    [
      '-y',
      '-loop', '1',
      '-framerate', String(VIDEO_FPS),
      '-t', String(shot.durationSeconds),
      '-i', shot.sourcePath,
      '-f', 'lavfi',
      '-t', String(shot.durationSeconds),
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-vf', filterChain,
      '-t', String(shot.durationSeconds),
      '-r', String(VIDEO_FPS),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-profile:v', 'high',
      '-level', '4.2',
      '-pix_fmt', 'yuv420p',
      '-x264-params', 'nal-hrd=cbr:force-cfr=1',
      '-b:v', VIDEO_BITRATE,
      '-minrate', VIDEO_BITRATE,
      '-maxrate', VIDEO_MAXRATE,
      '-bufsize', VIDEO_BUFSIZE,
      '-g', String(VIDEO_FPS * 2),
      '-c:a', 'aac',
      '-b:a', AUDIO_BITRATE,
      '-ar', '48000',
      '-ac', '2',
      '-shortest',
      clipPath
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    }
  );
}

function quoteConcatPath(filePath) {
  return `file '${filePath.replaceAll("'", "'\\''")}'`;
}

async function renderTrailer(outputDir, shots) {
  for (const shot of shots) {
    await renderShotClip(outputDir, shot);
  }

  const concatManifestPath = path.join(outputDir, 'clips.txt');
  const concatManifest = `${shots.map((shot) => quoteConcatPath(buildClipPath(outputDir, shot))).join('\n')}\n`;
  await fsp.writeFile(concatManifestPath, concatManifest, 'utf8');

  await runCommand(
    'ffmpeg',
    [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatManifestPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      path.join(outputDir, FINAL_VIDEO_FILENAME)
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    }
  );
}

function toDisplayPath(filePath) {
  const relativePath = path.relative(REPO_ROOT, filePath);
  return relativePath && !relativePath.startsWith('..') ? relativePath.replaceAll(path.sep, '/') : filePath;
}

async function writeManifest(outputDir, shots, options) {
  const manifest = {
    createdAt: new Date().toISOString(),
    screenshotsDir: toDisplayPath(options.screenshotsDir),
    outputVideo: FINAL_VIDEO_FILENAME,
    resolution: `${VIDEO_WIDTH}x${VIDEO_HEIGHT}`,
    fps: VIDEO_FPS,
    totalDurationSeconds: roundToMilliseconds(options.durationSeconds),
    videoCodec: 'h264',
    audioCodec: 'aac',
    shots: shots.map((shot) => ({
      id: shot.id,
      title: shot.title,
      durationSeconds: shot.durationSeconds,
      sourcePath: toDisplayPath(shot.sourcePath),
      clip: shot.clipRelativePath
    }))
  };

  await fsp.writeFile(path.join(outputDir, MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  await ensureFfmpegInstalled();
  const screenshotPaths = await collectScreenshotPaths(options.screenshotsDir);
  const shots = buildShots(screenshotPaths, options.durationSeconds);

  await ensureCleanOutput(options.outputDir);
  await renderTrailer(options.outputDir, shots);
  await writeManifest(options.outputDir, shots, options);

  const finalVideoPath = path.join(options.outputDir, FINAL_VIDEO_FILENAME);
  console.log(`[done] Trailer written to ${finalVideoPath}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

(async () => {
  try {
    await runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  }
})();
