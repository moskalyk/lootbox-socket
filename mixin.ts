import 'dotenv/config'

// Strings
const Strings = (base: any) => {
    base.toSnakeCase = (str: any) => {
        return str.toLowerCase().replace(/\s+/g, '_');
    }
    base.removeCharacter = (str: any, charToRemove: any)=>{
        return str.replace(new RegExp(charToRemove, 'g'), '');
    }

    base.isValidKey = (data: any) => {
        try {
            // Check if 'data' is an object and has 'inference' property
            if (typeof data === 'object' && data !== null && 'inference' in data) {
                // Check if 'inference' has 'images' property which is an array
                if (Array.isArray(data.inference.images) && data.inference.images.length > 0) {
                    // Check if the first element of 'images' array has 'url' property
                    return 'url' in data.inference.images[0]
                }
            }
        } catch (error) {
            console.error("An error occurred:", error)
        }
        return false;
      }

    base.formatStatString = (str: any, main = true) => {
        if(str == null ) return []
        const regex = /^(.*?)\s*([+-]?\d+)(-)?(\d+)?(%?)$/;
        const matches = str.match(regex);
        let formattedResult = [];
      
        if (matches) {
            let [_, stat_name, firstValue, rangeIndicator, secondValue, percentageSymbol] = matches;
            stat_name = base.removeCharacter(stat_name, ':')
            const baseDisplayType = base.toSnakeCase(stat_name);
            const isPercentage = percentageSymbol === '%';
      
            if (rangeIndicator === '-') {
                formattedResult.push({
                    "display_type": main ? baseDisplayType + "_min" : "sub_stats_"+baseDisplayType + "_min", 
                    "trait_type": stat_name + " Minimum", 
                    "value": parseInt(firstValue, 10) + (isPercentage ? '%' : '')
                });
      
                formattedResult.push({
                    "display_type": main ? baseDisplayType + "_max" : "sub_stats_"+baseDisplayType + "_max", 
                    "trait_type": stat_name + " Maximum", 
                    "value": parseInt(secondValue, 10) + (isPercentage ? '%' : '')
                });
            } else {
                formattedResult.push({
                    "display_type": main ? baseDisplayType : "sub_stats_"+baseDisplayType, 
                    "trait_type": stat_name, 
                    "value": parseInt(firstValue, 10) + (isPercentage ? '%' : '')
                });
            }
        } 
      
        return formattedResult;
      }
    return base;
};

// Stream
import { Readable } from 'stream'
const Stream = (base: any) => {
    base.bufferToStream = (buffer: any) => {
        const readable = new Readable();
        readable._read = () => {} // _read is required but you can noop it
        readable.push(buffer)
        readable.push(null)
        return readable
    };
    return base;
};

// Inference
import api from 'api'
const modelId = process.env.model_id
const sdk = api('@scenario-api/v1.0#fydhn73iklq3ujnso')
sdk.auth(`Basic ${process.env.scenario_api_key}`)

const Inference = (base: any) => {
    return {
        ...base,
        getInferenceWithItem: async (prompt: any) => {
            return new Promise( async (res) => {
              const { data } = await sdk.postModelsInferencesByModelId({
                parameters: {
                  type: 'txt2img',
                  prompt: prompt + ' single object on black background no people'
                }
              }, {modelId: modelId})
              res({inferenceId: data.inference.id, prompt: prompt, seconds: base.getCurrentSecond() })
            })
          },
         getInferenceStatus: (id: any, address: any, seconds: any, prompt: any) => {
            console.log('getting inference status for: ',id)
            return new Promise(async (res) => {
              const { data } = await sdk.getModelsInferencesByModelIdAndInferenceId({
                modelId, 
                inferenceId: id
              })
              if(base.isValidKey(data)){
                res({ status: data.inference.status, seconds: seconds, prompt: prompt, url: data.inference.images[0].url, address: address })
              } else {
                res({ status: data.inference.status, seconds: seconds, prompt: prompt, url: null, address: address })
              }
            })
          }
    }
}

// ProcessInferencePool
const ProcessInferencePool = (base: any) => {
    base.inferencePool = {}
    return {
        ...base,
        processInferencePool: async () => {
            while (true) {
                await base.wait(1000 * 10); // check for status every 10 seconds
                const entries = Object.entries(base.inferencePool)
                let urls: any = []
                let listOfAddresses: any = []
                let times: any = []
                let prompts: any = []
          
                const promises = entries.map(([id,obj]: any) =>{
                  if(obj.awaitingMint == false){
                      return base.getInferenceStatus(id, obj.address, obj.seconds, obj.prompt).then(async ({ status, url, address, seconds, prompt } : any) => {
                        console.log(status)  
                        if (status == 'succeeded') {
                              // TODO: do cleanup of this logic with objects                 
                              prompts.push(prompt)
                              urls.push(url)
                              times.push(seconds)
                              listOfAddresses.push(address)
                          } else {
                            console.log('status else')
                            console.log(status)
                          }
                      })
                    }
                  }
                );
          
                await Promise.all(promises)
          
                if(urls.length > 0){
                  // Process URLs after all getInferenceStatus calls are done
                  const MetadataPromises = urls.map((url: any, i: any) => base.upload(url, times[i], prompts[i]))
                  const metadatas = await Promise.all(MetadataPromises);
          
                  
                  const ids = Object.keys(base.loggedIn)
          
                  for(let i = 0; i < ids.length; i++){
                    const socket = base.loggedIn[ids[i]]
                    
                    for(let j = 0; j < listOfAddresses.length; j++){
                      // TODO: do more to cleanup lists
                      // if addressess align with sockets, remove and emit
          
                      if(listOfAddresses[j].toLowerCase() == socket.address.toLowerCase() && socket.socket) {
                        const index = listOfAddresses.indexOf(socket.address);
                        if (index > -1) { // only splice array when item is found
                          listOfAddresses.splice(index, 1) // 2nd parameter means remove one item only
                        }
                        const entries: any = Object.entries(base.inferencePool)
                        const filteredEntries = entries.filter((entry: any) => !entry[1].awaitingMint);
          
                        for(let k = 0; k < filteredEntries.length; k++){
                          if(filteredEntries[k][1].address.toLowerCase() == socket.address.toLowerCase()){
                            filteredEntries[k][1].data.url = metadatas[k].image
                            base.inferencePool[filteredEntries[k][0]].awaitingMint = true
                            socket.socket.emit(`loot`, filteredEntries[k])
                          }
                        }
                        break
                      }
                    }
                  }
                }
            }
        }
    }
} 

// Upload
import CID from 'cids'
const pinataSDK = require('@pinata/sdk')
const pinata = new pinataSDK({ pinataJWTKey: process.env.pinata_jwt_key})

const Upload = (base: any) => {
    base.uploadToIPFS = async (url: any, pinata: any, seconds: any, prompt: any) => {
        try {
        
          const response = await axios({
              method: 'get',
              url: url,
              responseType: 'arraybuffer'
          })
      
          // Convert the downloaded data to a stream
          const fileStream = base.bufferToStream(response.data)
      
          // Pinata upload options
          const options = {
              pinataMetadata: {
                  name: 'loot',
                  keyvalues: {
                      sourceGeneration: 'scenario.gg',
                      time: seconds,
                      prompt: prompt,
                      aesthetic: JSON.stringify(['medieval','compute','single-object','no people'])
                  }
              },
              pinataOptions: {
                  cidVersion: 0
              }
          }
      
          // Upload the file to IPFS using Pinata
          const res = await pinata.pinFileToIPFS(fileStream, options)
      
          // Convert to CID object
          const cidV0 = new CID(res.IpfsHash)
      
          // Convert to CIDv1 in Base32
          const cidV1Base32 = cidV0.toV1().toString('base32')
      
          const metadata = {
            name: 'Lootbox: ' + prompt,
            description: 'A free lootbox mini-game available for use in any game that requires collectible rewards',
            image: `https://${cidV1Base32}.ipfs.nftstorage.link`
          }
      
          return metadata
        } catch (error) {
            console.error('Error uploading file to IPFS:', error)
            throw error
        }
      }
    return {
        ...base,
        null: (buffer: any) => {
            console.log('todo')
        },
        upload: async (url: any, seconds: any, prompt: any) => {
            const metadata = await base.uploadToIPFS(url, pinata, seconds, prompt)
            return metadata
        },
    }
    return base;
};

// Time
const Time = (base: any) => {
    return {
        ...base, 
        wait: async (ms: any) => new Promise((res) => setTimeout(res, ms)),
        getCurrentSecond: () => {
            const now = new Date()
            return now.getSeconds()
        }
    }
}

// Server 
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';

const CLIENT_URL = process.env.client_url

const corsOptions = {
    origin: CLIENT_URL,
}

const Server = (base: any) => {
    base.app = express()
    base.httpServer = createServer(base.app)
      
    base.app.use(cors(corsOptions))
    return {
        ...base,

    }
}

// SocketMintPool
import { Server as socketIoServer } from 'socket.io';

import * as ethers from 'ethers'
import { ValidateSequenceWalletProof } from '@0xsequence/auth'
import { commons, v2 } from '@0xsequence/core'
import { ETHAuth } from '@0xsequence/ethauth'
import { trackers } from '@0xsequence/sessions'
import { Session } from '@0xsequence/auth'
import axios from 'axios'

const rpcUrl = 'https://nodes.sequence.app/arbitrum-nova'
const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
const contractAddress = '0xc8a3e4268e9fccaeedb26c0fb22e7653c76d2771'


const SocketProcessInferencePool = (base: any) => {
    base.loggedIn = {}
    base.io = new socketIoServer(base.httpServer, {
        cors: {
          origin: CLIENT_URL
        }
      })
    base.validator = ValidateSequenceWalletProof(
        () => new commons.reader.OnChainReader(provider),
        new trackers.remote.RemoteConfigTracker('https://sessions.sequence.app'),
        v2.DeployedWalletContext
    )
    base.ethauth = new ETHAuth(base.validator)
    base.mintPool = {}
    base.inferencePool = {}
    return {
        ...base,
        processInferencePool: async () => {
            while (true) {
                await base.wait(1000 * 10); // check for status every 10 seconds
                const entries = Object.entries(base.inferencePool)
                let urls: any = []
                let listOfAddresses: any = []
                let times: any = []
                let prompts: any = []
          
                const promises = entries.map(([id,obj]: any) =>{
                  if(obj.awaitingMint == false){
                      return base.getInferenceStatus(id, obj.address, obj.seconds, obj.prompt).then(async ({ status, url, address, seconds, prompt } : any) => {
                        console.log(status)  
                        if (status == 'succeeded') {
                              // TODO: do cleanup of this logic with objects                 
                              prompts.push(prompt)
                              urls.push(url)
                              times.push(seconds)
                              listOfAddresses.push(address)
                          } else {
                            console.log('status else')
                            console.log(status)
                          }
                      })
                    }
                  }
                );
          
                await Promise.all(promises)
          
                if(urls.length > 0){
                  // Process URLs after all getInferenceStatus calls are done
                  const MetadataPromises = urls.map((url: any, i: any) => base.upload(url, times[i], prompts[i]))
                  const metadatas = await Promise.all(MetadataPromises);
          
                  
                  const ids = Object.keys(base.loggedIn)
          
                  for(let i = 0; i < ids.length; i++){
                    const socket = base.loggedIn[ids[i]]
                    
                    for(let j = 0; j < listOfAddresses.length; j++){
                      // TODO: do more to cleanup lists
                      // if addressess align with sockets, remove and emit
          
                      if(listOfAddresses[j].toLowerCase() == socket.address.toLowerCase() && socket.socket) {
                        const index = listOfAddresses.indexOf(socket.address);
                        if (index > -1) { // only splice array when item is found
                          listOfAddresses.splice(index, 1) // 2nd parameter means remove one item only
                        }
                        const entries: any = Object.entries(base.inferencePool)
                        const filteredEntries = entries.filter((entry: any) => !entry[1].awaitingMint);
          
                        for(let k = 0; k < filteredEntries.length; k++){
                          if(filteredEntries[k][1].address.toLowerCase() == socket.address.toLowerCase()){
                            filteredEntries[k][1].data.url = metadatas[k].image
                            base.inferencePool[filteredEntries[k][0]].awaitingMint = true
                            socket.socket.emit(`loot`, filteredEntries[k])
                          }
                        }
                        break
                      }
                    }
                  }
                }
            }
        },
        processMintPool: async () => {
            while (true) {
              await base.wait(1000 * 4); // check for status every 10 seconds
          
              const mints = Object.entries(base.mintPool)
              const entries: any = Object.entries(base.inferencePool)
          
              if(mints.length > 0){
                const directory = []
                for (let i = 0; i < mints.length; i++){
          
                  // get token supply
                  // const provider = new ethers.providers.JsonRpcProvider('https://nodes.sequence.app/bsc-testnet');
                  // const contract = new ethers.Contract(contractAddress, abi, provider);
                  // let totalSupply
                  // try {
                  //     // Call the totalSupply function
                  //     totalSupply = await contract.totalSupply();
                  //     console.log(`Total Supply: ${totalSupply.toString()}`);
                  // } catch (error) {
                  //     console.error(`Error in fetching total supply: ${error}`);
                  // }
          
                  for (let j = 0; j < entries.length; j++){
                    if(mints[i][0] == entries[j][1].address){
                      delete base.inferencePool[entries[j][0]]
                      delete base.mintPool[entries[j][1].address]
                      const metadata = {
                        name: 'Lootbox: ' + entries[j][1].data.name,
                        description: 'A free lootbox mini-game available for use in any game that requires collectible rewards',
                        image: entries[j][1].data.url,
                        attributes: entries[j][1].attributes
                      }
                      // add to array
                      directory.push(metadata)
                    }
                  }
          
                  let mintTxs = []
          
                  // // Create your server EOA
                  // const walletEOA = new ethers.Wallet(String(process.env.PKEY), provider);
          
                  // // Open a Sequence session, this will find or create
                  // // a Sequence wallet controlled by your server EOA
                  // const session = await Session.singleSigner({
                  //     signer: walletEOA
                  // })
          
                  // const signer = session.account.getSigner(97)
                  // console.log(signer.account.address)
          
                  // for(let j = 0; j < listOfAddresses.length; j++){
          
                  //   // // Craft your transaction
                  //   const erc721Interface = new ethers.utils.Interface([
                  //     'function collect(address address_)'
                  //   ])
          
                  //   const data = erc721Interface.encodeFunctionData(
                  //     'collect', [listOfAddresses[j]]
                  //   )
          
                  //   const txn = {
                  //     to: contractAddress,
                  //     data
                  //   }
          
                  //   // Send the transaction
                  //   mintTxs.push(txn)
                  // }
          
                  // let txnResponse: any;
                  // try{
                  //   // txnResponse = await signer.sendTransaction([...mintTxs])
                  //   // console.log(txnResponse)
                  // }catch(err) {
                  //   console.log(err)
                  // } 
          
                  console.log(directory)
                }
              }
            }
        },
        initETHAuthProof: () => {
            base.io.use(async (socket: any, next: any) => {
                const token = socket.handshake.query.token as string
                console.log(token)
                // const address = socket.handshake.query.address as string;
                await base.ethauth.configJsonRpcProvider(rpcUrl)
                try {
                    const proof = await base.ethauth.decodeProof(token)
                    // only allow for 1 socket
                    const sockets: any = Object.entries(base.loggedIn)
                    for(let i = 0; i < sockets.length; i++){
                      console.log(sockets[i])
                      // }
                      if(sockets[i][1].hasOwnProperty('address') && sockets[i][1].address == proof.address){
                        next(new Error('Duplicate Socket'))
                      } 
                    }
                    base.loggedIn[socket.id] = {address: proof.address, socket: null }
                    console.log(`proof for address ${proof.address} is valid`)
                    next()
                } catch (err) {
                  console.log(`invalid proof -- do not trust address: ${err}`)
                  next(new Error('Authentication error'))
                }
            })
        },
        boot: () => {
            base.io.on('connection', (socket: any) => {
                  if(base.loggedIn[socket.id]) { // check for duplicate sockets
                      base.loggedIn[socket.id] = {address: base.loggedIn[socket.id].address, socket: socket }
                      // console.log(loggedIn[socket.id])
                      socket.on('disconnect', () => {
                          console.log('Client disconnected')
                          delete base.loggedIn[socket.id]
                      })
              
                      socket.on('cancel', async (data: any) => {
                        console.log(data.address)
                        const entries: any = Object.entries(base.inferencePool)
              
                        for(let i = 0; i < entries.length; i++){
                          console.log(entries[i])
                          if(entries[i][1].address.toLowerCase() == data.address.toLowerCase()){
                            delete base.inferencePool[entries[i][0]]
                          }
                        }
                      })
              
                      socket.on('mint', async (data: any) => {
                        console.log(data.address)
                        base.mintPool[data.address] = true
                      })
              
                      socket.on('ping', async (data: any, callback: any) => {
                        callback({status: 'ok'})
                      })
              
                      socket.on('collect', async (data: any) => {
              
                          console.log('Received response:', data);
                          const res = await axios('http://127.0.0.1:5000')
                          console.log(res.data)
              
                        const attributes = []
              
                        const defend = Math.random() > 0.5 ? true : false
              
                          // category
                          attributes.push({
                            display_type: "category",
                            trait_type: "Category",
                            value: res.data[defend ? 'armor' : 'weapon'].category
                          })
              
                          // main stats
                          attributes.push(...base.formatStatString(res.data[defend ? 'armor' : 'weapon'].main_stats[0], true))
              
                          // sub stats
                          const sub_stats = res.data[defend ? 'armor' : 'weapon'].stats
              
                          // tier
                          sub_stats.map((stats: any) => {
                            attributes.push(...base.formatStatString(stats, false))
                          })
              
                          // type
                          attributes.push({
                            display_type: "tier",
                            trait_type: "tier",
                            value: res.data[defend ? 'armor' : 'weapon'].tier
                          })
              
                          attributes.push({
                            display_type: "type",
                            trait_type: "type",
                            value: res.data[defend ? 'armor' : 'weapon'].type
                          })
              
                          console.log(attributes)
                          const { inferenceId, seconds, prompt }: any = await base.getInferenceWithItem(res.data[defend ? 'armor' : 'weapon'].name)
              
                          base.inferencePool[inferenceId] = {address: data.address, seconds: base.getCurrentSecond(), prompt: res.data.armor.name, data: res.data.armor, attributes: attributes, awaitingMint: false }
                      })
                  } 
              })
        }
    }
}

(() => {
    let PORT = 3000
    let lootbox = SocketProcessInferencePool(//  ☼
            Inference(
                Server(
                    Time(
                        Strings(
                            Upload(
                                Stream({
                                        //  ★
                                    }
                                )
                            )
                        )
                    )
                )
            )
        )
    

    lootbox.initETHAuthProof()
    lootbox.boot()

    lootbox.httpServer.listen(PORT, () => {
        lootbox.processInferencePool()
        lootbox.processMintPool()
        console.log(`Listening on port ${PORT}`);
    })
})()