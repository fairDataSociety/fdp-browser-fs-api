import React, { useRef } from 'react'
import { FullFileBrowser } from 'chonky'
import {
  FileSystemFileHandle,
  getOriginPrivateDirectory,
  showOpenFilePicker,
  showSaveFilePicker,
} from 'native-file-system-adapter'
import { useEffect } from 'react'
import { ChonkyActions } from 'chonky'
import { useCallback } from 'react'
import Modal from 'react-modal'
import { fileOpen, directoryOpen, fileSave, supported } from 'browser-fs-access'

Modal.setAppElement('#root')

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
  },
}

export const FairdriveBrowser = ({ fdp, id, name }) => {
  const [items, setItems] = React.useState([])
  const [loadingMessage, setLoadingMessage] = React.useState('Loading pod...')
  const [loading, setLoading] = React.useState(false)
  const [podItem, setPod] = React.useState({ name: '' })
  const folderChain = [{ id, name, isDir: true }]
  const myFileActions = [
    ChonkyActions.UploadFiles,
    ChonkyActions.CreateFolder,
    ChonkyActions.DeleteFiles,
    ChonkyActions.DownloadFiles,
    // ChonkyActions.OpenSelection,
  ]
  const [modalIsOpen, setIsOpen] = React.useState(false)
  const [selectedFileHandle, setSelectedFileHandle] = React.useState(null)

  function openModal() {
    setIsOpen(true)
  }

  function afterOpenModal() {}

  function closeModal() {
    setIsOpen(false)
  }

  useEffect(() => {
    async function getHandle() {
      setLoadingMessage('Loading pod...')
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
          path: '/',
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
        setLoadingMessage('')
      }
    }
    getHandle()
  }, [])

  async function openFile() {}

  async function deleteFile() {
    debugger
    await selectedFileHandle.removeEntry()
  }

  async function downloadFile() {
    setLoadingMessage('Downloading file...')
    setLoading(true)
    const h = selectedFileHandle.selectedFilesForAction[0].handle
    const blob = await h.getFile()
    // Save a file.
    await fileSave(blob, {
      fileName: h.name,
      extensions: ['.png'],
    })
    setLoading(false)
    setLoadingMessage('')
  }

  const handleAction = podItem =>
    useCallback(
      data => {
        async function upload() {
          setLoading(true)
          setLoadingMessage('Uploading file...')

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
            path: '/',
            podname: podItem.name,
          })
          const fileHandle = await rootHandle.getFileHandle(file.name, { create: true })
          const writable = await fileHandle.createWritable({ keepExistingData: false })
          await writable.write(file)
          await writable.close()
          setLoading(false)
          setLoadingMessage('')
        }

        setSelectedFileHandle(data.state)
        if (data.id === ChonkyActions.UploadFiles.id) {
          upload()
        } else if (data.id === ChonkyActions.DownloadFiles.id) {
          const h = selectedFileHandle.selectedFilesForAction[0].handle
          const blob = h.getFile()
          // Save a file.
          fileSave(blob, {
            fileName: h.name,
            extensions: ['.png'],
          })
        } else if (data.id === ChonkyActions.DeleteFiles.id) {
          deleteFile()
        } else if (data.id === ChonkyActions.OpenSelection.id) {
          openModal()
        }
      },
      [podItem, loading, selectedFileHandle],
    )
  return (
    <div style={{ height: 600, width: 300, flex: '100%' }}>
      {loading ? <div>{loadingMessage}</div> : null}
      <FullFileBrowser
        onFileAction={handleAction(podItem)}
        files={items}
        folderChain={folderChain}
        fileActions={myFileActions}
      />
      <Modal
        isOpen={modalIsOpen}
        onAfterOpen={afterOpenModal}
        onRequestClose={closeModal}
        style={customStyles}
        contentLabel="File actions"
      >
        <button onClick={openFile}>Open</button>
        <a
          onClick={() => {
            setLoadingMessage('Downloading file...')
            setLoading(true)
            const h = selectedFileHandle.selectedFilesForAction[0].handle
            const blob = h.getFile()
            // Save a file.
            fileSave(blob, {
              fileName: h.name,
              extensions: ['.png'],
            })
            setLoading(false)
            setLoadingMessage('')
          }}
        >
          Download
        </a>
        <button onClick={deleteFile}>Delete</button>
      </Modal>

      {/* <Modal
        isOpen={openNewFolderModal}
        onRequestClose={closeNewFolderModal}
        contentLabel="New folder"
      >

         </Modal> */}
    </div>
  )
}
