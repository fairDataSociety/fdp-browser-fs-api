import Blob from 'fetch-blob'
import { ReadableStream } from 'file-system-access/lib/web-streams-ponyfill'
import { getOriginPrivateDirectory } from 'file-system-access/lib/getOriginPrivateDirectory'
import { existsSync, mkdirSync } from 'fs'
import { FdpStorage } from '@fairdatasociety/fdp-storage'
import { cleanupSandboxedFileSystem } from './util'
import steps from './test'

// Make sure Blob and ReadableStream are defined b/c they are used in the tests
globalThis.Blob = Blob
globalThis.ReadableStream = ReadableStream

async function test(fs, step, root) {
  try {
    await cleanupSandboxedFileSystem(root)
    await step.fn(root)
    console.log(`[OK]: ${fs} ${step.desc}`)
    return true
  } catch (err) {
    console.log(`[ERR]: ${fs} ${step.desc}\n\t-> ${err.message}`)
    return false
  }
}
describe('fdp-browser-fs-api', () => {
  let fdpFS: FdpBrowserFsAdapater

  beforeEach(() => {
    const id = `54ed0da82eb85ab72f9b8c37fdff0013ac5ba0bf96ead71d4a51313ed831b9e5` as BatchId
    const client = new FdpStorage('http://localhost:1633', id)
  })

  it('when created should be defined', async () => {
    expect(fdpFS).toBeDefined()
  })

  it('should create block', async () => {
    const fdpFS = await getOriginPrivateDirectory(import('../../src/index'))

    let hasFailures = false


    for (let step of steps) {
      if (!(await test('fdpFS', step, fdpFS))) {
        hasFailures = true
      }
    }

    if (hasFailures) {
      console.log(`\n\nSome tests failed. See output above.`)
      process.exit(1)
    }
  })
})
