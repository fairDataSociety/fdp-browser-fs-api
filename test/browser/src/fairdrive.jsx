import React, { Component } from 'react'
import { FullFileBrowser } from 'chonky'
import { getOriginPrivateDirectory, support } from 'native-file-system-adapter'
import { useEffect } from 'react'
import { ChonkyActions } from 'chonky'

export const FairdriveBrowser = ({ fdp, id, name }) => {
  const files = []
  const folderChain = [{ id, name, isDir: true }]
  const myFileActions = [ChonkyActions.UploadFiles, ChonkyActions.DownloadFiles, ChonkyActions.DeleteFiles]
  useEffect(() => {
    async function getHandle() {
      const adapter = await import('./dist/index.js')

      let handle
      await fdp.account.login(`testing`, `abtesting`)
      
      handle = await getOriginPrivateDirectory(adapter, {
        fdp,
        podname: `root`,
        id: `54ed0da82eb85ab72f9b8c37fdff0013ac5ba0bf96ead71d4a51313ed831b9e5`,
        path: '/',
        reference: `testing`,
      })

      const entries = await handle.entries()

      let entry = await entries.next()
      while (!entry.done) {
        console.log(entry.value)
        entry = await entries.next()
        if (entry[1].kind === 'directory') {
          files.push({ id: entry[0], name: entry[0], isDir: true, handle: entry[1] })
        } else {
          files.push({ id: entry[0], name: entry[0], isDir: false, handle: entry[1] })
        }
      }
    }
    getHandle()
  }, [])
  return (
    <div style={{ height: 600, width: 300, flex: '50%' }}>
      <FullFileBrowser files={files} folderChain={folderChain} fileActions={myFileActions} />
    </div>
  )
}
