// reference: https://github.com/use-strict/file-system-access/blob/master/test/util.js
function streamFromFetch(data) {
  return new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(data)
      ctrl.close()
    },
  })
}

function arrayEqual(a1, a2) {
  assert(JSON.stringify(a1) === JSON.stringify(a2), `expected [${a1}] to equal [${a2}]`)
}

/** @param {boolean} r */
function assert(r, msg = 'Assertion failed') {
  if (!r) throw new Error(msg)
}

function capture(p) {
  return p.catch(_ => _)
}

/** @param {import('../src/FileSystemDirectoryHandle').FileSystemDirectoryHandle} root */
async function cleanupSandboxedFileSystem(root) {
  for await (const [name, entry] of root) {
    await root.removeEntry(name, { recursive: entry.kind === 'directory' })
  }
}

async function getFileSize(handle) {
  const file = await handle.getFile()
  return file.size
}

async function getFileContents(handle) {
  const file = await handle.getFile()
  return file.text()
}

async function getDirectoryEntryCount(handle) {
  let result = 0
  for await (let entry of handle.entries()) {
    result++
  }
  return result
}

/**
 * @param {string} name
 * @param {import('../src/FileSystemDirectoryHandle').FileSystemDirectoryHandle} parent
 */
async function createEmptyFile(name, parent) {
  const handle = await parent.getFileHandle(name, { create: true })
  // Make sure the file is empty.
  assert((await getFileSize(handle)) === 0)
  return handle
}

/**
 * @param {string} fileName
 * @param {string} contents
 * @param {import('../src/FileSystemDirectoryHandle').FileSystemDirectoryHandle} parent
 */
async function createFileWithContents(fileName, contents, parent) {
  const handle = await createEmptyFile(fileName, parent)
  const Writable = await handle.createWritable()
  await Writable.write(contents)
  await Writable.close()
  return handle
}

/**
 * @param {import('../src/FileSystemDirectoryHandle').FileSystemDirectoryHandle} handle
 * @returns {Promise<string[]>}
 */
async function getSortedDirectoryEntries(handle) {
  const result = []
  for await (const [name, entry] of handle) {
    result.push(name + (entry.kind === 'directory' ? '/' : ''))
  }
  result.sort()
  return result
}

/**
 * @param {string} name
 * @param {import('../src/FileSystemDirectoryHandle').FileSystemDirectoryHandle} parent
 */
async function createDirectory(name, parent) {
  return parent.getDirectoryHandle(name, { create: true })
}
