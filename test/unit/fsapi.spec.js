import dotenv from 'dotenv'
dotenv.config()

import DOMException from 'node-domexception'
globalThis.DOMException = DOMException

import pkg from '@fairdatasociety/fdp-storage'
const { FdpStorage } = pkg

/** @param {import('../src/FileSystemDirectoryHandle').FileSystemDirectoryHandle} root */
async function cleanupSandboxedFileSystem(root) {
  for await (const [name, entry] of root) {
    await root.removeEntry(name, { recursive: entry.kind === 'directory' })
  }
}

async function testit(fs, step, root) {
  try {
    await cleanupSandboxedFileSystem(root)
    await step.fn(root)

    // eslint-disable-next-line no-console
    console.log(`[OK]: ${fs} ${step.desc}`)

    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`[ERR]: ${fs} ${step.desc}\n\t-> ${err.toString()}`)

    return false
  }
}

async function run() {
  const Blob = await import('fetch-blob')

  // const id = `54ed0da82eb85ab72f9b8c37fdff0013ac5ba0bf96ead71d4a51313ed831b9e5` as any
  // const client = new FdpStorage('http://localhost:1633', id)
  const { ReadableStream } = await import('file-system-access/lib/web-streams-ponyfill.js')
  const { getOriginPrivateDirectory } = await import('file-system-access/lib/node.js')
  // Make sure Blob and ReadableStream are defined b/c they are used in the tests
  const adapter = await import('../../dist/index.js')
  // eslint-disable-next-line
  // @ts-ignore
  globalThis.Blob = Blob

  // eslint-disable-next-line
  // @ts-ignores
  globalThis.ReadableStream = ReadableStream

  const fdp = new FdpStorage(process.env.NEXT_PUBLIC_BEE_URL, process.env.NEXT_PUBLIC_GLOBAL_BATCH_ID, {
    ensOptions: {
      performChecks: true,
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
      contractAddresses: {
        ensRegistry: process.env.NEXT_PUBLIC_ENS_REGISTRY_ADDRESS,
        publicResolver: process.env.NEXT_PUBLIC_PUBLIC_RESOLVER_ADDRESS,
        fdsRegistrar: process.env.NEXT_PUBLIC_SUBDOMAIN_REGISTRAR_ADDRESS,
      },
    },
    ensDomain: 'fds',
  })

  let fdpFS
  let pod
  const wallet = await fdp.account.login(`testing`, `abtesting`)
  try {
    pod = await fdp.personalStorage.create('root')
  } catch (err) {
    console.log(err)
  }
  fdpFS = await getOriginPrivateDirectory(adapter, {
    fdp,
    podname: `root`,
    id: `54ed0da82eb85ab72f9b8c37fdff0013ac5ba0bf96ead71d4a51313ed831b9e5`,
    path: '/',
    reference: `testing`,
  })
  let hasFailures = false

  const steps = await import('./test.js')

  for (const step of steps.default) {
    if (!(await testit('fdpFS', step, fdpFS))) {
      hasFailures = true
    }
  }

  if (hasFailures) {
    // eslint-disable-next-line no-console
    console.log(`\n\nSome tests failed. See output above.`)
    process.exit(1)
  }
}

run()
