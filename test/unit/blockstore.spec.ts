import { BatchId } from '@ethersphere/bee-js'
import { BeeSon, Type } from '@fairdatasociety/beeson'
import * as Block from 'multiformats/block'
import { FdpStorageBlockstore } from '../../src'
import { FdpStorage } from '@fairdatasociety/fdp-storage'
import { codec, hasher } from '@fairdatasociety/beeson-multiformats'

describe('fdp-blockstore', () => {
  let fdpBlockstore: FdpStorageBlockstore

  beforeEach(() => {
    const id = `54ed0da82eb85ab72f9b8c37fdff0013ac5ba0bf96ead71d4a51313ed831b9e5` as BatchId
    const client = new FdpStorage('http://localhost:1633', id)
    // TODO: create mock
    fdpBlockstore = new FdpStorageBlockstore(client)
  })

  it('when created should be defined', async () => {
    expect(fdpBlockstore).toBeDefined()
  })

  it('should create block', async () => {
    const json = [0, 1, 2, 3, 5, 6]
    const beeson = new BeeSon({ json })
    expect(beeson.typeManager.type).toBe(Type.array)
    expect(beeson.json).toStrictEqual(json)

    const value = beeson
    // encode a block
    const block = await Block.encode({ value, codec, hasher })
    await fdpBlockstore.put(block.cid, block.bytes)

    // get block
    const resp = await fdpBlockstore.get(block.cid)

    expect(resp.toString()).toEqual(block.bytes.toString())
  })

  it('should create beeson block', async () => {
    const json = [0, 1, 2, 3, 5, 6]
    const beeson = new BeeSon({ json })
    expect(beeson.typeManager.type).toBe(Type.array)
    expect(beeson.json).toStrictEqual(json)

    // pub block
    const cid = await fdpBlockstore.putBeesonBlock(beeson)

    // get block
    const resp = await fdpBlockstore.getBeesonBlock(cid)

    expect(resp.json).toEqual(beeson.json)
  })
})
