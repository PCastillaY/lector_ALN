const test = require("node:test")
const assert = require("node:assert/strict")
const {
  createReadingProgress,
  resolveReadingProgressIndex,
} = require(process.env.LECTOR_TEST_BUILD + "/lib/documents/reading-progress.js")

function segment(overrides = {}) {
  return {
    id: "section:block:1",
    text: "Texto",
    startOffset: 100,
    endOffset: 105,
    sectionId: "section",
    sectionIndex: 0,
    sectionTitle: "Capítulo",
    sourceBlockId: "block",
    blockIndex: 0,
    segmentIndex: 0,
    order: 0,
    ...overrides,
  }
}

test("creates a versioned anchor using the block-local offset", () => {
  const anchor = createReadingProgress("doc-1", segment({
    startOffset: 112,
    endOffset: 120,
    order: 4,
  }), 100, "2026-11-11T12:00:00.000Z")

  assert.deepEqual(anchor, {
    schemaVersion: 1,
    documentId: "doc-1",
    sectionId: "section",
    sectionIndex: 0,
    sourceBlockId: "block",
    blockIndex: 0,
    segmentIndex: 0,
    order: 4,
    blockStartOffset: 100,
    offsetInBlock: 12,
    updatedAt: "2026-11-11T12:00:00.000Z",
  })
})

test("restores by stable section and block identity when segment order changes", () => {
  const segments = [
    segment({ id: "other:block:1", sectionId: "other", order: 0 }),
    segment({ id: "section:block:1", startOffset: 100, endOffset: 110, order: 1 }),
    segment({ id: "section:block:2", startOffset: 110, endOffset: 120, segmentIndex: 1, order: 2 }),
    segment({ id: "section:block:3", startOffset: 120, endOffset: 130, segmentIndex: 2, order: 3 }),
  ]
  const progress = {
    schemaVersion: 1,
    documentId: "doc-1",
    sectionId: "section",
    sectionIndex: 0,
    sourceBlockId: "block",
    blockIndex: 0,
    segmentIndex: 1,
    order: 8,
    blockStartOffset: 100,
    offsetInBlock: 15,
    updatedAt: "2026-11-11T12:00:00.000Z",
  }

  assert.equal(resolveReadingProgressIndex(segments, progress), 2)
})

test("falls back to the closest block position within the same section", () => {
  const segments = [
    segment({ id: "section:new:1", sourceBlockId: "new", blockIndex: 2, segmentIndex: 0, order: 0 }),
    segment({ id: "section:new:2", sourceBlockId: "new", blockIndex: 2, segmentIndex: 3, order: 1 }),
  ]
  const progress = {
    schemaVersion: 1,
    documentId: "doc-1",
    sectionId: "section",
    sectionIndex: 0,
    sourceBlockId: "deleted",
    blockIndex: 2,
    segmentIndex: 2,
    order: 1,
    blockStartOffset: 0,
    offsetInBlock: 0,
    updatedAt: "2026-11-11T12:00:00.000Z",
  }

  assert.equal(resolveReadingProgressIndex(segments, progress), 1)
})

test("uses a clamped global order when the original section no longer exists", () => {
  const segments = [segment({ order: 0 }), segment({ order: 1 })]
  const progress = {
    schemaVersion: 1,
    documentId: "doc-1",
    sectionId: "missing",
    sectionIndex: 9,
    sourceBlockId: "missing",
    blockIndex: 9,
    segmentIndex: 9,
    order: 99,
    blockStartOffset: 0,
    offsetInBlock: 0,
    updatedAt: "2026-11-11T12:00:00.000Z",
  }

  assert.equal(resolveReadingProgressIndex(segments, progress), 1)
})

test("starts at the first segment when no saved progress exists", () => {
  assert.equal(resolveReadingProgressIndex([segment()], null), 0)
  assert.equal(resolveReadingProgressIndex([], null), 0)
})
