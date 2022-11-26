import React, { Component } from 'react'
import logo from './logo.svg'
import './App.css'
import { FSBrowser } from './fsbrowser'
import { FairdriveBrowser } from './fairdrive'

import {FdpStorage} from '@fairdatasociety/fdp-storage'


export const GLOBAL_POSTAGE_BATCH_ID =
  "0000000000000000000000000000000000000000000000000000000000000000";

  export function getEnsConfig() {
  const ensRegistry = process.env.REACT_APP_ENS_REGISTRY_ADDRESS;
  const publicResolver = process.env.REACT_APP_PUBLIC_RESOLVER_ADDRESS;
  const fdsRegistrar = process.env.REACT_APP_SUBDOMAIN_REGISTRAR_ADDRESS;
  const rpcUrl = process.env.REACT_APP_RPC_URL;
  const ensDomain = "fds";

  if (!rpcUrl && !ensRegistry && !publicResolver && !fdsRegistrar) {
    return ensOptions
      ? {
          ensOptions,
          ensDomain,
        }
      : undefined;
  }

  let ensOptions = {};

  if (rpcUrl) {
    ensOptions.rpcUrl = rpcUrl;
  }

  if (ensRegistry && publicResolver && fdsRegistrar) {
    ensOptions.contractAddresses = {
      ensRegistry,
      publicResolver,
      fdsRegistrar,
    };
  }

  return {
    ensOptions: {
      performChecks: true,
      ...ensOptions,
    },
    ensDomain,
  };
}


const fdp = new FdpStorage(process.env.REACT_APP_BEE_URL, GLOBAL_POSTAGE_BATCH_ID, getEnsConfig())

class App extends Component {
  render() {
    return (
      <div className="App" style={{ display: 'flex' }}>
        <FairdriveBrowser name="Fairdrive" id="fairdrive" fdp={fdp} />
      </div>
    )
  }
}

export default App
