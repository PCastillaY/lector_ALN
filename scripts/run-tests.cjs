const { spawnSync } = require("node:child_process")
const { mkdtempSync, rmSync } = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const tempDir = mkdtempSync(path.join(os.tmpdir(), "lector-aln-tests-"))
const tsc = require.resolve("typescript")
const tscCli = path.join(path.dirname(tsc), "..", "bin", "tsc")

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
  })

  if (result.error) throw result.error
  return result.status === 0
}

try {
  const compiled = run(process.execPath, [
    tscCli,
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--target", "ES2020",
    "--lib", "ES2020,DOM",
    "--strict",
    "--skipLibCheck",
    "--rootDir", root,
    "--outDir", tempDir,
    path.join(root, "lib/documents/types.ts"),
    path.join(root, "lib/documents/validation.ts"),
    path.join(root, "lib/documents/extraction/plain-text.ts"),
    path.join(root, "lib/documents/extraction/pdf.ts"),
    path.join(root, "lib/documents/extraction/epub.ts"),
    path.join(root, "lib/documents/segmentation/types.ts"),
    path.join(root, "lib/documents/segmentation/segmenter.ts"),
    path.join(root, "lib/documents/reading-progress.ts"),
    path.join(root, "lib/documents/extract.ts"),
    path.join(root, "lib/speech/phonemization/kokoro-spanish.ts"),
  ])

  if (compiled) {
    const tested = run(process.execPath, [
      "--test",
      path.join(root, "tests/document-validation.test.cjs"),
      path.join(root, "tests/plain-text-extraction.test.cjs"),
      path.join(root, "tests/pdf-extraction.test.cjs"),
      path.join(root, "tests/epub-extraction.test.cjs"),
      path.join(root, "tests/text-segmentation.test.cjs"),
      path.join(root, "tests/reading-progress.test.cjs"),
      path.join(root, "tests/kokoro-spanish-phonemizer.test.cjs"),
    ], {
      ...process.env,
      LECTOR_TEST_BUILD: tempDir,
    })
    if (!tested) process.exitCode = 1
  } else {
    process.exitCode = 1
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
