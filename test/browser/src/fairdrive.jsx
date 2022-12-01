import React, { Component } from 'react'
import { FullFileBrowser } from 'chonky'
import { getOriginPrivateDirectory, showOpenFilePicker, showSaveFilePicker } from 'native-file-system-adapter'
import { useEffect } from 'react'
import { ChonkyActions } from 'chonky'
import { useCallback } from 'react'

export const FairdriveBrowser = ({ fdp, id, name }) => {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [podItem, setPod] = React.useState({ name: '' })
  const folderChain = [{ id, name, isDir: true }]
  const myFileActions = [ChonkyActions.UploadFiles, ChonkyActions.DownloadFiles, ChonkyActions.DeleteFiles]
  useEffect(() => {
    async function getHandle() {
      setLoading(true)
      const adapter = await import('./dist/index.js')
      await fdp.account.login(process.env.REACT_APP_USERNAME, process.env.REACT_APP_PASSWORD)

      let pods
      try {
       pods = await fdp.personalStorage.list() //(`testing-${Date.now()}`)
      } catch (e) {
        console.log(e)
      }
      if (pods) {
        const pod = pods.getPods().reverse()[8]
        console.log(`Using pod ${pod.name}`)
        const rootHandle = await getOriginPrivateDirectory(adapter, {
          fdp,
          podname: pod.name,
          path:'/'
        })
        const files = []

        for await (let [name, entry] of rootHandle.entries()) {
          if (entry.kind === 'directory') {
            const item = { id: name, name: name, isDir: true, handle: entry }
            files.push(item)
          } else {
            const item = { id: name, name: name, isDir: false, handle: entry }
            files.push(item)
          }
        }

        setPod({ ...pod })
        setItems(files)
        setLoading(false)
      }
    }
    getHandle()
  }, [])

  const handleAction = podItem =>
    useCallback(
      data => {
        async function upload() {
          // request user to select a file
          const [picker] = await showOpenFilePicker({
            types: [], // default
            multiple: false, // default
            excludeAcceptAllOption: false, // default
            _preferPolyfill: false, // default
          })

          // returns a File Instance
          const file = await picker.getFile()
          const adapter = await import('./dist/index.js')

          // copy the file over to a another place
          const rootHandle = await getOriginPrivateDirectory(adapter, {
            fdp,

            path:'/',
            podname: podItem.name,
          })
          const fileHandle = await rootHandle.getFileHandle(file.name, { create: true })
          const writable = await fileHandle.createWritable({ keepExistingData: false })
          await writable.write(file)
          await writable.close()
        }

        async function download() {
          const fileHandle = await showSaveFilePicker({
            _preferPolyfill: true,
            suggestedName: 'Untitled.png',
            types: [
              { accept: { 'image/png': ['png'] } },
              { accept: { 'image/jpg': ['jpg'] } },
              { accept: { 'image/webp': ['webp'] } },
            ],
            excludeAcceptAllOption: false, // default
          })

          // Look at what extension they chosen
          const extensionChosen = fileHandle.name.split('.').pop()

          const blob = {
            jpg: generateCanvasBlob({ type: 'blob', format: 'jpg' }),
            png: generateCanvasBlob({ type: 'blob', format: 'png' }),
            webp: generateCanvasBlob({ type: 'blob', format: 'webp' }),
          }[extensionChosen]

          const writer = await fileHandle.createWritable()
          await writer.write(blob)
          await writer.close()
        }

        async function deleteFile() {
          await data.file.handle.removeEntry()
        }
        setLoading(true)

        if (data.id === ChonkyActions.UploadFiles.id) {
          upload()
        } else if (data.id === ChonkyActions.DownloadFiles.id) {
          download()
        } else if (data.id === ChonkyActions.DeleteFiles.id) {
          deleteFile()
        }
        setLoading(false)
      },
      [podItem],
    )
  return (
    <div style={{ height: 600, width: 300, flex: '100%' }}>
      {loading ? <div>Loading...</div> : null}
      <FullFileBrowser
        onFileAction={handleAction(podItem)}
        files={items}
        folderChain={folderChain}
        fileActions={myFileActions}
      />
    </div>
  )
}
