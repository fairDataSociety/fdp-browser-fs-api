import { Adapter, FileSystemFileHandleAdapter, FileSystemFolderHandleAdapter, WriteChunk } from 'file-system-access/src/interfaces'
import { errors, isChunkObject } from 'file-system-access/src/util'

import { FdpStorage } from '@fairdatasociety/fdp-storage'

const { INVALID, GONE, MISMATCH, MOD_ERR, SYNTAX, DISALLOWED } = errors


let File = globalThis.File
let Blob = globalThis.Blob


class Sink implements UnderlyingSink<WriteChunk> {
  private size: number
  private file: File
  private position = 0
  private fdp: FdpStorage

  constructor (fdp:  FdpStorage, size: number, file: File) {
    this.fdp = fdp
    this.size = size
    this.file = file
  }

  async write (chunk: WriteChunk) {
    // TODO: check if file reference exists in fdp else throw error
    if (!this.file) throw new DOMException(...GONE)

    let file = this.file

    if (isChunkObject(chunk)) {
      if (chunk.type === 'write') {
        if (typeof chunk.position === 'number' && chunk.position >= 0) {
          this.position = chunk.position
          if (this.size < chunk.position) {
            this.file = new File(
              [this.file, new ArrayBuffer(chunk.position - this.size)],
              this.file.name,
              this.file
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
          file = chunk.size < this.size
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
    blob = new File([
      head,
      new Uint8Array(padding),
      chunk,
      tail
    ], blob.name)

    this.size = blob.size
    this.position += chunk.size

    this.file = blob
  }

  // TODO: close writes to fdp-storage
  async close () {
    return new Promise<void>((resolve, reject) => {
      const [tx, table] = store(this.db)
      table.get(this.id).onsuccess = (evt) => {
        (evt.target as IDBRequest).result
          ? table.put(this.file, this.id)
          : reject(new DOMException(...GONE))
      }
      tx.oncomplete = () => resolve()
      tx.onabort = reject
      tx.onerror = reject
    })
  }
}

export class FileHandle implements FileSystemFileHandleAdapter {
  public file: File | null
  public readonly name: string
  public readonly kind = 'file'
  // TODO: check if we need this, b/c we can check file for null instead
  private deleted = false
  public writable: boolean
  public onclose?(self: this): void

  constructor (name = '', file = new File([], name), writable = true) {
    this.file = file
    this.name = name
    this.writable = writable
  }

  async getFile () {
    if (this.deleted || this.file === null) throw new DOMException(...GONE)
    return this.file
  }

  async createWritable (opts?: FileSystemCreateWritableOptions) {
    if (!this.writable) throw new DOMException(...DISALLOWED)
    if (this.deleted) throw new DOMException(...GONE)
    return new Sink(this, !!opts?.keepExistingData)
  }

  async isSameEntry (other: FileHandle) {
    return this === other
  }

  destroy () {
    this.deleted = true
    this.file = null
  }
}

export class FolderHandle implements FileSystemFolderHandleAdapter {
  public readonly name: string
  public readonly kind = 'directory'
  private deleted = false
  public _entries: Record<string, FolderHandle | FileHandle> = {}
  public writable: boolean

  constructor (name: string, writable = true) {
    this.name = name
    this.writable = writable
  }

  async * entries () {
    if (this.deleted) throw new DOMException(...GONE)
    yield* Object.entries(this._entries)
  }

  async isSameEntry (other: FolderHandle) {
    return this === other
  }

  async getDirectoryHandle (name: string, opts: { create?: boolean; } = {}) {
    if (this.deleted) throw new DOMException(...GONE)
    const entry = this._entries[name]
    if (entry) { // entry exist
      if (entry instanceof FileHandle) {
        throw new DOMException(...MISMATCH)
      } else {
        return entry
      }
    } else {
      if (opts.create) {
        return (this._entries[name] = new FolderHandle(name))
      } else {
        throw new DOMException(...GONE)
      }
    }
  }

  async getFileHandle (name: string, opts: { create?: boolean; } = {}) {
    const entry = this._entries[name]
    if (entry) {
      if (entry instanceof FileHandle) {
        return entry
      } else {
        throw new DOMException(...MISMATCH)
      }
    } else {
      if (!opts.create) {
        throw new DOMException(...GONE)
      } else {
        return (this._entries[name] = new FileHandle(name))
      }
    }
  }

  async removeEntry (name: string, opts: { recursive?: boolean; } = {}) {
    const entry = this._entries[name]
    if (!entry) throw new DOMException(...GONE)
    entry.destroy(opts.recursive)
    delete this._entries[name]
  }

  destroy (recursive?: boolean) {
    for (let x of Object.values(this._entries)) {
      if (!recursive) throw new DOMException(...MOD_ERR)
      x.destroy(recursive)
    }
    this._entries = {}
    this.deleted = true
  }
}

const fs = new FolderHandle('')

const adapter: Adapter<void> = () => fs

export default adapter