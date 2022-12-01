import React, { Component, useEffect } from 'react'
import logo from './logo.svg'
import './App.css'
import { FSBrowser } from './fsbrowser'
import { FairdriveBrowser } from './fairdrive'

import { FdpStorage } from '@fairdatasociety/fdp-storage'

export const GLOBAL_POSTAGE_BATCH_ID = '54ed0da82eb85ab72f9b8c37fdff0013ac5ba0bf96ead71d4a51313ed831b9e5'

import { FdpContracts } from '@fairdatasociety/fdp-storage'
// TODO temporary because the fdp-storage is not exporting these values
const { Environments, getEnvironmentConfig } = FdpContracts || {}

function getEnvironment() {
  const environment = process.env.REACT_APP_ENVIRONMENT

  if (environment === 'LOCALHOST') {
    return getEnvironmentConfig(Environments.LOCALHOST)
  } else if (environment === 'GOERLI') {
    return getEnvironmentConfig(Environments.GOERLI)
  }

  return undefined
}

export function getEnsConfig() {
  let ensOptions = getEnvironment()
  const ensRegistry = process.env.REACT_APP_ENS_REGISTRY_ADDRESS
  const publicResolver = process.env.REACT_APP_PUBLIC_RESOLVER_ADDRESS
  const fdsRegistrar = process.env.REACT_APP_SUBDOMAIN_REGISTRAR_ADDRESS
  const rpcUrl = process.env.REACT_APP_RPC_URL
  const ensDomain = 'fds'

  if (!rpcUrl && !ensRegistry && !publicResolver && !fdsRegistrar) {
    return ensOptions
      ? {
          ensOptions,
          ensDomain,
        }
      : undefined
  }

  ensOptions = ensOptions || {}

  if (rpcUrl) {
    ensOptions.rpcUrl = rpcUrl
  }

  if (ensRegistry && publicResolver && fdsRegistrar) {
    ensOptions.contractAddresses = {
      ensRegistry,
      publicResolver,
      fdsRegistrar,
    }
  }

  return {
    ensOptions: {
      performChecks: true,
      ...ensOptions,
    },
    ensDomain,
  }
}
const client = new FdpStorage(
  process.env.REACT_APP_BEE_URL,
  process.env.REACT_APP_GLOBAL_BATCH_ID,
  getEnsConfig(),
)
const App = () => {
  return (
    <div className="App" style={{ display: 'flex' }}>
      <FairdriveBrowser name="Fairdrive" id="fairdrive" fdp={client} />
    </div>
  )
}

export default App
