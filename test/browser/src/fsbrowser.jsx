import React, { Component, useEffect } from 'react'
import { FullFileBrowser } from 'chonky'
import { getOriginPrivateDirectory, support } from 'native-file-system-adapter'
import { ChonkyActions } from 'chonky';

export const FSBrowser = ({ id, name }) => {
  const files = [
  ]
  const folderChain = [{ id, name, isDir: true }]
  const myFileActions = [
    ChonkyActions.UploadFiles,
    ChonkyActions.DownloadFiles,
    ChonkyActions.DeleteFiles,
];
  useEffect(() => {
    async function getHandle() {
      const handle = await getOriginPrivateDirectory()
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
      <FullFileBrowser files={files} folderChain={folderChain} fileActions={myFileActions}/>
    </div>
  )
}
