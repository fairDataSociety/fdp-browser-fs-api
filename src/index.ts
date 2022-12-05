import {
  Adapter,
  FileSystemFileHandleAdapter,
  FileSystemFolderHandleAdapter,
  WriteChunk,
} from 'file-system-access/lib/interfaces'
import { errors } from 'file-system-access/lib/util.js'
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
  private file: File
  private position = 0
  private fdp: FdpStorage
  path: string
  podname: string

  constructor(fdp: FdpStorage, podname: string, path: string, file: File) {
    this.fdp = fdp
    this.podname = podname

    this.path = path
    this.file = file
  }

  /**
   *
   * @param key
   * @param options
   * @returns
   */
  async has(key: string): Promise<boolean> {
    try {
      return this.fdp.connection.bee.isReferenceRetrievable(key)
    } catch (e) {
      return false
    }
  }

  async write(chunk: WriteChunk) {
    let file = chunk as File

    this.file = file
  }

  async close() {
    return new Promise<void>(async (resolve, reject) => {
      const buffer = await this.file.arrayBuffer()
      try {
        await this.fdp.file.uploadData(this.podname, `${this.path}${this.file.name}`, Buffer.from(buffer))
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
  podname: string
  path: string
  public onclose?(self: this): void

  private fdp: FdpStorage
  constructor(fdp: FdpStorage, podname: string, path: string, name: string, reference: Reference) {
    this.reference = reference
    this.fdp = fdp
    this.podname = podname
    this.path = path
    this.name = name
  }
  writable = true

  async getFile() {
    try {
      const data = await this.fdp.file.downloadData(this.podname, `${this.path}${this.name}`)

      return new File([data.buffer], this.name)
    } catch (e) {
      throw new DOMException(...GONE)
    }
  }

  async createWritable(opts?: FileSystemCreateWritableOptions) {
    let file
    if (opts && !opts.keepExistingData) {
      file = new File([], this.name)
    } else {
      file = await this.getFile()
    }

    return new Sink(this.fdp, this.podname, this.path, file)
  }

  async isSameEntry(other: FileHandle) {
    return this.reference === other.reference
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

    if (entries && entries.getDirectories().length > 0) {
      for (let entry of entries.getDirectories()) {
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

    if (entries && entries.getFiles().length > 0) {
      for (let entry of entries.getFiles()) {
        yield [
          entry.name,
          new FileHandle(this.fdp, this.podname, this.path, entry.name, entry.reference as Reference),
        ] as [string, FileHandle]
      }
    }
  }

  async isSameEntry(other: FolderHandle) {
    return this.path === other.path
  }

  async getDirectoryHandle(name: string, opts: FileSystemGetDirectoryOptions = {}) {
    return new Promise<FolderHandle>(async (resolve, reject) => {
      if (opts.create) {
        await this.fdp.directory.create(this.podname, `${this.path}${name}`)

        resolve(new FolderHandle(this.fdp, name, this.podname, `${this.path}${name}`, ''))
      } else {
        try {
          const entries = await this.fdp.directory.read(this.podname, `${this.path}${name}`)

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
        if (opts.create) {
          resolve(new FileHandle(this.fdp, this.podname, this.path, name, '' as any))
        } else {
          const data = await this.fdp.file.downloadData(this.podname, `${this.path}${name}`)
          const ref = await getSwarmRef(data)
          resolve(new FileHandle(this.fdp, this.podname, this.path, name, ref as unknown as Reference))
        }
      } catch (e) {
        reject(new DOMException(...GONE))
      }
    })
  }

  async removeEntry(name: string, opts: FileSystemRemoveOptions = {}) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        await this.fdp.file.delete(this.podname, `${this.path}${name}`)
      } catch (e) {
        reject(new DOMException(...GONE))
      }
    })
  }
}
export interface FdpOptions {
  fdp: FdpStorage
  podname: string
  path: string
}

const adapter: Adapter<FdpOptions> = async (options: FdpOptions) =>
  new Promise(resolve => {
    resolve(new FolderHandle(options.fdp, options.podname, options.podname, options.path, ''))
  })

export default adapter
