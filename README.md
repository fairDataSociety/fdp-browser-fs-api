# fdp-browser-fs-api


## FDP FileSystem API Polyfill


### Usage with React

```typescript   
// Example usage of fdp fs browser API polyfill
import React from 'react'
import {
  getOriginPrivateDirectory,
  showOpenFilePicker,
} from 'native-file-system-adapter'
export const FairdriveBrowser = ({ fdp, id, name }) => {

  const currentPath = '/'

  async function handlePodChange(e) {
    setLoadingMessage(`Loading pod ${e.target.value}...`)
    setLoading(true)
    
    // Dynamic import polyfill
    const adapter = await import('@fairdatasociety/fdp-browser-fs-api')
    await fdp.account.login(process.env.REACT_APP_USERNAME, process.env.REACT_APP_PASSWORD)

    const pod = { name: e.target.value }
    console.log(`Using pod ${pod.name}`)
  
    // Create adapter with getOriginPrivateDirectory
    const rootHandle = await getOriginPrivateDirectory(adapter, {
      fdp,
      podname: pod.name,
      path: currentPath,
    })

    if (currentPath === '/') {
      setFolderChain([{
        id: 'root',
        name: '/',
        isDir: true
      }])
    } else {
      const folders = currentPath.split('/').map(path => ({
        id: path,
        name: path,
        isDir: true,
      }))

      setFolderChain(folders)
    }
    const files = []

    // Get entries from AsyncIterator
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
})
```

## API Reference

### Loading directory or files entries

```typescript
const adapter = await import('@fairdatasociety/fdp-browser-fs-api')
 
// Create adapter with getOriginPrivateDirectory
const rootHandle = await getOriginPrivateDirectory(adapter, {
    fdp,
    podname: pod.name,
    path: currentPath,
})

const files = []

// Get entries from AsyncIterator
for await (let [name, entry] of rootHandle.entries()) {
    if (entry.kind === 'directory') {
    const item = { id: name, name: name, isDir: true, handle: entry }
    files.push(item)
    } else {
    const item = { id: name, name: name, isDir: false, handle: entry }
    files.push(item)
    }
}

```

### Uploading

```typescript
const adapter = await import('@fairdatasociety/fdp-browser-fs-api')

// request user to select a file
const [picker] = await showOpenFilePicker({
    types: [], // default
    multiple: false, // default
    excludeAcceptAllOption: false, // default
    _preferPolyfill: false, // default
})

// returns a File Instance
const file = await picker.getFile()

// copy the file over to a another place
const rootHandle = await getOriginPrivateDirectory(adapter, {
    fdp,
    path: currentPath,
    podname: podItem.name,
})
const fileHandle = await rootHandle.getFileHandle(file.name, { create: true })
const writable = await fileHandle.createWritable({ keepExistingData: false })
await writable.write(file)
await writable.close()

```


### Downloading


```typescript
import { fileSave } from 'browser-fs-access'

// This is a FileSystemFileHandle store in some state (eg memory, component, redux)
const h = selectedFileHandle.selectedFilesForAction[0].handle
const blob = h.getFile()

// Save a file using browser-fs-access, do not use await or a security context error will be thrown
fileSave(blob, {
    fileName: h.name,
})


```


### Delete


```typescript
// This is a FileSystemFileHandle store in some state (eg memory, component, redux)
const file = selectedFileHandle.selectedFilesForAction[0].handle
const adapter = await import('@fairdatasociety/fdp-browser-fs-api')

// copy the file over to a another place
const rootHandle = await getOriginPrivateDirectory(adapter, {
    fdp,
    path: currentPath,
    podname: podItem.name,
})
await rootHandle.removeEntry(file.name)

```

## Example implementation

An example implementation in React can be found in `/test/browser`. Start it with `npm run start`



## License

MIT