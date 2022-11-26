import {
  Adapter,
  FileSystemFileHandleAdapter,
  FileSystemFolderHandleAdapter,
  WriteChunk,
} from 'file-system-access/lib/interfaces'
import { errors, isChunkObject } from 'file-system-access/lib/util.js'
import { CID } from 'multiformats/cid'
import * as digest from 'multiformats/hashes/digest'

import { JsonValue } from '@fairdatasociety/beeson/dist/types'
import { Reference } from '@ethersphere/swarm-cid'

import { FdpStorage } from '@fairdatasociety/fdp-storage'
import { makeChunkedFile, ChunkAddress } from '@fairdatasociety/bmt-js'
import { BeeSon } from '@fairdatasociety/beeson'
const { INVALID, GONE, SYNTAX } = errors

const File = globalThis.File
const Blob = globalThis.Blob

/**
 * Converts array of number or Uint8Array to HexString without prefix.
 *
 * @param bytes   The input array
 * @param len     The length of the non prefixed HexString
 */
function bytesToHex(bytes: Uint8Array, len?: number): string {
  const hexByte = (n: number) => n.toString(16).padStart(2, '0')
  const hex = Array.from(bytes, hexByte).join('')
  if (len && hex.length !== len) {
    throw new TypeError(`Resulting HexString does not have expected length ${len}: ${hex}`)
  }

  return hex
}

/**
 * Get CID from Beeson helper
 * @param beeson beeson value
 * @returns A CID
 */
export async function getCidFromBeeson(beeson: BeeSon<JsonValue>): Promise<CID> {
  const value = beeson.serialize()
  const chunk = makeChunkedFile(value)
  const ref = chunk.address()

  return CID.decode(digest.create(0x1b, ref).digest)
}

/**
 * Get Swarm Reference from Beeson
 * @param beeson beeson value
 * @returns A Swarm Reference (chunk address)
 */
export async function getSwarmRefFromBeeson(beeson: BeeSon<JsonValue>): Promise<ChunkAddress> {
  const value = beeson.serialize()
  const chunk = makeChunkedFile(value)

  return chunk.address()
}

/**
 * Get Swarm Reference
 * @param value bytes value
 * @returns A Swarm Reference (chunk address)
 */
export async function getSwarmRef(value: Uint8Array): Promise<ChunkAddress> {
  const chunk = makeChunkedFile(value)

  return chunk.address()
}

/**
 * Converts a swarm reference to cid
 * @param cid CID
 * @returns A swarm reference
 */
export function toSwarmRef(cid: CID): Reference {
  return bytesToHex(cid.multihash.digest) as Reference
}

class Sink implements UnderlyingSink<WriteChunk> {
  private size: number
  private file: File
  private position = 0
  private fdp: FdpStorage

  constructor(fdp: FdpStorage, size: number, file: File) {
    this.fdp = fdp
    this.size = size
    this.file = file
  }

  /**
   *
   * @param key
   * @param options
   * @returns
   */
  async has(key: string): Promise<boolean> {
    return this.fdp.connection.bee.isReferenceRetrievable(key)
  }

  async write(chunk: WriteChunk) {
    const buf = await await this.file.stream()
    const value = await buf.getReader().read()
    const ref = await getSwarmRef(value?.value as Uint8Array)
    const exists = await this.has(ref.toString())
    if (!exists) throw new DOMException(...GONE)

    let file = this.file

    if (isChunkObject(chunk)) {
      if (chunk.type === 'write') {
        if (typeof chunk.position === 'number' && chunk.position >= 0) {
          this.position = chunk.position
          if (this.size < chunk.position) {
            this.file = new File(
              [this.file, new ArrayBuffer(chunk.position - this.size)],
              this.file.name,
              this.file,
            )
          }
        }
        if (!('data' in chunk)) {
          throw new DOMException(...SYNTAX('write requires a data argument'))
        }
        chunk = chunk.data
      } else if (chunk.type === 'seek') {
        if (Number.isInteger(chunk.position) && chunk.position >= 0) {
          if (this.size < chunk.position) {
            throw new DOMException(...INVALID)
          }
          this.position = chunk.position

          return
        } else {
          throw new DOMException(...SYNTAX('seek requires a position argument'))
        }
      } else if (chunk.type === 'truncate') {
        if (Number.isInteger(chunk.size) && chunk.size >= 0) {
          file =
            chunk.size < this.size
              ? new File([file.slice(0, chunk.size)], file.name, file)
              : new File([file, new Uint8Array(chunk.size - this.size)], file.name, file)

          this.size = file.size
          if (this.position > file.size) {
            this.position = file.size
          }
          this.file = file

          return
        } else {
          throw new DOMException(...SYNTAX('truncate requires a size argument'))
        }
      }
    }

    chunk = new Blob([chunk])

    let blob = this.file
    // Calc the head and tail fragments
    const head = blob.slice(0, this.position)
    const tail = blob.slice(this.position + chunk.size)

    // Calc the padding
    let padding = this.position - head.size
    if (padding < 0) {
      padding = 0
    }
    blob = new File([head, new Uint8Array(padding), chunk, tail], blob.name)

    this.size = blob.size
    this.position += chunk.size

    this.file = blob
  }

  async close() {
    return new Promise<void>(async (resolve, reject) => {
      const buffer = await this.file.arrayBuffer()
      try {
        await this.fdp.connection.bee.uploadData(this.fdp.connection.postageBatchId, Buffer.from(buffer))
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }
}

// FS File Handle
export class FileHandle implements FileSystemFileHandleAdapter {
  public readonly name: string
  public readonly kind = 'file'
  reference: Reference
  public onclose?(self: this): void

  private fdp: FdpStorage
  constructor(fdp: FdpStorage, reference: Reference) {
    this.reference = reference
    this.fdp = fdp
    this.name = reference
  }
  writable = true

  async getFile() {
    try {
      const data = await this.fdp.connection.bee.downloadData(this.reference.toString())

      return new File([data], this.name)
    } catch (e) {
      throw new DOMException(...GONE)
    }
  }

  async createWritable(opts?: FileSystemCreateWritableOptions) {
    let file = await this.getFile()

    if (opts && !opts.keepExistingData) {
      file = new File([], file.name, file)
    }

    return new Sink(this.fdp, file.size, file)
  }

  async isSameEntry(other: FileHandle) {
    return this === other
  }
}

// FS Folder Handle
export class FolderHandle implements FileSystemFolderHandleAdapter {
  public readonly path: string
  public readonly kind = 'directory'
  readonly name: string

  fdp: FdpStorage
  podname: string
  writable = true
  readable = true
  reference: string

  constructor(fdp: FdpStorage, name: string, podname: string, path: string, reference: string) {
    this.fdp = fdp
    this.path = path
    this.podname = podname
    this.name = name
    this.reference = reference
  }

  async *entries() {
    const entries = await this.fdp.directory.read(this.podname, this.path)

    if (entries.getDirectories().length > 0) {
      for (const entry of entries.getDirectories()) {
        yield [
          entry.name,
          new FolderHandle(
            this.fdp,
            entry.name,
            this.podname,
            this.path + entry.name + '/',
            entry.reference as string,
          ),
        ] as [string, FolderHandle]
      }
    }

    if (entries.getFiles().length > 0) {
      for (const entry of entries.getFiles()) {
        yield [entry.name, new FileHandle(this.fdp, entry.reference as Reference)] as [string, FileHandle]
      }
    }
  }

  async isSameEntry(other: FolderHandle) {
    return this.path === other.path
  }

  async getDirectoryHandle(name: string, opts: FileSystemGetDirectoryOptions = {}) {
    return new Promise<FolderHandle>(async (resolve, reject) => {
      if (opts.create) {
        await this.fdp.directory.create(this.podname, `${this.path}/${name}`)

        resolve(new FolderHandle(this.fdp, name, this.podname, `${this.path}/${name}`, ''))
      } else {
        try {
          const entries = await this.fdp.directory.read(this.podname, `${this.path}/${name}`)

          if (entries.raw) {
            resolve(
              new FolderHandle(this.fdp, entries.name, this.podname, this.path, entries.reference as any),
            )
          }
        } catch (e) {
          reject(new DOMException(...GONE))
        }
      }
    })
  }

  async getFileHandle(name: string, opts: FileSystemGetFileOptions = {}) {
    return new Promise<FileHandle>(async (resolve, reject) => {
      try {
        const data = await this.fdp.file.downloadData(this.podname, this.path)

        if (data) {
          const ref = await getSwarmRef(data)
          resolve(new FileHandle(this.fdp, ref as unknown as Reference))
        } else {
          if (opts.create) {
            const resp = await this.fdp.file.uploadData(
              this.podname,
              `${this.path}/${name}`,
              new Uint8Array(),
            )

            resolve(new FileHandle(this.fdp, resp.blocksReference as unknown as Reference))
          } else {
            reject(new DOMException(...GONE))
          }
        }
      } catch (e) {
        reject(new DOMException(...GONE))
      }
    })
  }

  async removeEntry(name: string, opts: FileSystemRemoveOptions) {
    // TODO: Implement
  }
}
export interface FdpOptions {
  fdp: FdpStorage
  id: string
  podname: string
  path: string
  reference: string
}

const adapter: Adapter<FdpOptions> = async (options: FdpOptions) =>
  new Promise(resolve => {
    resolve(new FolderHandle(options.fdp, options.id, options.podname, options.path, options.reference))
  })

export default adapter
