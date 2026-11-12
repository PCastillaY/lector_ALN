const fs = require("node:fs");
const path = require("node:path");

const transformersEntry = require.resolve("@huggingface/transformers");
const ortEntry = require.resolve("onnxruntime-web", {
  paths: [path.dirname(transformersEntry)],
});
const sourceDir = path.dirname(ortEntry);
const outputDir = path.join(process.cwd(), "public", "onnxruntime");

const assets = fs.readdirSync(sourceDir).filter((name) =>
  name.startsWith("ort-wasm") && /\.(wasm|mjs|js)$/.test(name),
);

if (assets.length === 0) {
  throw new Error(`No se encontraron binarios ONNX Runtime en ${sourceDir}`);
}

fs.mkdirSync(outputDir, { recursive: true });
for (const asset of assets) {
  fs.copyFileSync(path.join(sourceDir, asset), path.join(outputDir, asset));
}

console.log(`ONNX Runtime: ${assets.length} recursos preparados en public/onnxruntime`);
