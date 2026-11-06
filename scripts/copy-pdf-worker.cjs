const { copyFileSync, mkdirSync } = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const source = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs")
const publicDirectory = path.join(root, "public")
const destination = path.join(publicDirectory, "pdf.worker.min.mjs")

mkdirSync(publicDirectory, { recursive: true })
copyFileSync(source, destination)
process.stdout.write("PDF.js worker preparado en public/pdf.worker.min.mjs\n")
