import 'dotenv/config'
import * as ethers from 'ethers'
import { ValidateSequenceWalletProof } from '@0xsequence/auth'
import { commons, v2 } from '@0xsequence/core'
import { ETHAuth } from '@0xsequence/ethauth'
import { trackers } from '@0xsequence/sessions'
import { Session } from '@0xsequence/auth'

import { abi } from './abi'

var prompts = process.env.strings!.split(',')

import express from 'express';
import { createServer } from 'http';
import { Server as socketIoServer } from 'socket.io';
import cors from 'cors';

import api from 'api'
import axios from 'axios'
import { Readable } from 'stream'
import CID from 'cids'

//@ts-ignore
import Hypercore from 'hypercore'

// Create a Hypercore instance for the Hyperbee
const core = new Hypercore(`./hypercore-storage`, {
    valueEncoding: 'json'
})

const sdk = api('@scenario-api/v1.0#fydhn73iklq3ujnso')
const pinataSDK = require('@pinata/sdk')
const pinata = new pinataSDK({ pinataJWTKey: process.env.pinata_jwt_key})

sdk.auth(`Basic ${process.env.scenario_api_key}`)

const app = express()

const CLIENT_URL = process.env.client_url
const modelId = process.env.model_id

app.get('/metadata/:token_id', async (req, res) => {
  try {
    const timeout = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 400);
    });

    const block = await Promise.race([
        core.get(req.params.token_id),
        timeout
    ]);

    res.send(block);
  } catch (error) {
      console.error(error);
      res.sendStatus(400);
  }
})

const httpServer = createServer(app)
const io = new socketIoServer(httpServer, {
  cors: {
    origin: CLIENT_URL
  }
})

const corsOptions = {
    origin: CLIENT_URL,
}
  
app.use(cors(corsOptions))

const loggedIn: any = {}
const rpcUrl = 'https://nodes.sequence.app/bsc'
const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
const contractAddress = '0xc8a3e4268e9fccaeedb26c0fb22e7653c76d2771'

// create an EIP-6492-aware ETHAuth proof validator
const validator = ValidateSequenceWalletProof(
  () => new commons.reader.OnChainReader(provider),
  new trackers.remote.RemoteConfigTracker('https://sessions.sequence.app'),
  v2.DeployedWalletContext
)

const ethauth = new ETHAuth(validator)

io.use(async (socket, next) => {
    const token = socket.handshake.query.token as string
    const address = socket.handshake.query.address as string;
    await ethauth.configJsonRpcProvider(rpcUrl)
    try {
        const proof = await ethauth.decodeProof(token)
        loggedIn[socket.id] = {address: address, socket: null }
        console.log(`proof for address ${proof.address} is valid`)
        next()
      } catch (err) {
        console.log(`invalid proof -- do not trust address: ${err}`)
        next(new Error('Authentication error'))
      }
})

function toSnakeCase(str: any) {
  return str.toLowerCase().replace(/\s+/g, '_');
}

function formatStatString(str: any, main = true) {
  if(str == null ) return []
  const regex = /^(.*?)\s*([+-]?\d+)(-)?(\d+)?(%?)$/;
  const matches = str.match(regex);
  let formattedResult = [];

  if (matches) {
      let [_, stat_name, firstValue, rangeIndicator, secondValue, percentageSymbol] = matches;
      const baseDisplayType = toSnakeCase(stat_name);
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
              "value": parseInt(firstValue, 10) + (isPercentage ? '%' : '')
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

function getCurrentSecond() {
  // Create a new Date object representing the current time
  const now = new Date()

  // Get the current second
  return now.getSeconds()
}

const inferencePool: any = {};

io.on('connection', (socket: any) => {
  console.log(socket.id)
    if(loggedIn[socket.id]) {
        loggedIn[socket.id] = {address: loggedIn[socket.id].address, socket: socket }
        // console.log(loggedIn[socket.id])
        socket.on('disconnect', () => {
            console.log('Client disconnected')
            delete loggedIn[socket.id]
        })

        socket.on('collect', async (data: any) => {

            console.log('Received response:', data);
            // const { inferenceId, seconds, prompt }: any = await getInference(getCurrentSecond())
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
            attributes.push(...formatStatString(res.data[defend ? 'armor' : 'weapon'].main_stats[0], true))

            // sub stats
            const sub_stats = res.data[defend ? 'armor' : 'weapon'].stats

            // tier
            sub_stats.map((stats: any) => {
              attributes.push(...formatStatString(stats, false))
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
            const { inferenceId, seconds, prompt }: any = await getInferenceWithItem(res.data[defend ? 'armor' : 'weapon'].name)
            inferencePool[inferenceId] = {address: data.address, seconds: getCurrentSecond(), prompt: res.data.armor.name, data: res.data.armor, attributes: attributes }

            // const prompt = 'test'
          // inferencePool['LMQs1yiUTQmxhnTlBTfLrw'] = {address: data.address, seconds: getCurrentSecond(), prompt: res.data.armor.name, data: res.data.armor }
        })
    }
})

httpServer.listen(3000, () => {
    console.log('Listening on port 3000');
})

async function getInference(seconds: any) {
  return new Promise( async (res) => {
    const { data } = await sdk.postModelsInferencesByModelId({
      parameters: {
        type: 'txt2img',
        prompt: prompts[seconds] + ' single object on white background no people'
      }
    }, {modelId: modelId})
    res({inferenceId: data.inference.id, prompt: prompts[seconds], seconds })
  })
}

async function getInferenceWithItem(prompt: any) {
  return new Promise( async (res) => {
    const { data } = await sdk.postModelsInferencesByModelId({
      parameters: {
        type: 'txt2img',
        prompt: prompt + ' single object on black background no people'
      }
    }, {modelId: modelId})
    res({inferenceId: data.inference.id, prompt: prompt, seconds: getCurrentSecond() })
  })
}

function isValidKey(data: any) {
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

const wait = async (ms: any) => new Promise((res) => setTimeout(res, ms))

async function processInferencePool() {
  while (true) {
      await wait(1000 * 10); // check for status every 10 seconds
      const entries = Object.entries(inferencePool)
      let urls: any = []
      let listOfAddresses: any = []
      let times: any = []
      let prompts: any = []

      const promises = entries.map(([id,obj]: any) => 
          getInferenceStatus(id, obj.address, obj.seconds, obj.prompt).then(async ({ status, url, address, seconds, prompt } : any) => {
              if (status == 'succeeded') {
                  // delete inferencePool[id]

                  // TODO: do cleanup of this logic with objects                 
                  prompts.push(prompt)
                  urls.push(url)
                  times.push(seconds)
                  listOfAddresses.push(address)
              } else {
                console.log(status)
              }
          })
      );

      await Promise.all(promises)

      if(urls.length > 0){

        const provider = new ethers.providers.JsonRpcProvider('https://nodes.sequence.app/bsc-testnet');

        const contract = new ethers.Contract(contractAddress, abi, provider);
        let totalSupply

        // try {
        //     // Call the totalSupply function
        //     totalSupply = await contract.totalSupply();
        //     console.log(`Total Supply: ${totalSupply.toString()}`);
        // } catch (error) {
        //     console.error(`Error in fetching total supply: ${error}`);
        // }


        // Process URLs after all getInferenceStatus calls are done
        const MetadataPromises = urls.map((url: any, i: any) => upload(url, times[i], prompts[i], ))
        const metadatas = await Promise.all(MetadataPromises);
        // const finalCID = await uploadDirectory(totalSupply, metadatas)
        const ids = Object.keys(loggedIn)

        let mintTxs = []

        // Create your server EOA
        const walletEOA = new ethers.Wallet(String(process.env.PKEY), provider);

        // Open a Sequence session, this will find or create
        // a Sequence wallet controlled by your server EOA
        const session = await Session.singleSigner({
            signer: walletEOA
        })

        const signer = session.account.getSigner(97)
        console.log(signer.account.address)

        for(let j = 0; j < listOfAddresses.length; j++){

          // // Craft your transaction
          const erc721Interface = new ethers.utils.Interface([
            'function collect(address address_)'
          ])

          const data = erc721Interface.encodeFunctionData(
            'collect', [listOfAddresses[j]]
          )

          const txn = {
            to: contractAddress,
            data
          }

          // Send the transaction
          mintTxs.push(txn)
        }

        let txnResponse: any;
        try{
          // txnResponse = await signer.sendTransaction([...mintTxs])
          // console.log(txnResponse)
        }catch(err) {
          console.log(err)
        } 

        // for (let i = totalSupply+1; i <= totalSupply + listOfAddresses.length; i++) {
        //   const res = await fetch(`https://metadata.sequence.app/tokens/bsc-testnet/${contractAddress}/${i}/refresh`)
        //   console.log(res)
        // }

        for(let i = 0; i < ids.length; i++){
          const socket = loggedIn[ids[i]]
          // console.log(socket)
          for(let j = 0; j < listOfAddresses.length; j++){
            // TODO: do more to cleanup lists
            // if addressess align with sockets, remove and emit
            if(listOfAddresses[j] == socket.address && socket.socket) {
              const index = listOfAddresses.indexOf(socket.address);
              if (index > -1) { // only splice array when item is found
                listOfAddresses.splice(index, 1) // 2nd parameter means remove one item only
              }
              // console.log(finalCID)
              // console.log(socket.socket.id)
              const entries: any = Object.entries(inferencePool)
              // console.log(entries)
              // console.log(entries[0][1].data)
              
              delete inferencePool[entries[0][0]]

              entries[0][1].data.url = metadatas[0].image
              
              // socket.socket.emit(`loot`, txnResponse.hash)
              socket.socket.emit(`loot`, entries[0])
              break
            }
          }
        }
      }
  }
}

// TODO: test with directory 
// with multiple processed inferences 
// in the same 10 second span
async function uploadDirectory(totalSupply: number, metadatas: any) {
  const folder = 'loot'
  const files = []

  for(let i = totalSupply+1; i <= totalSupply+metadatas.length; i++){
    files.push(new File([JSON.stringify(metadatas[i], null, 2)], i+'.json', { type: 'application/json' }))
  }

  const data = new FormData();
  
  Array.from(files).forEach((file) => {
    data.append('file', file, `${folder}/${file.name}`)
  })
  
  const pinataMetadata = JSON.stringify({
      name: `${folder}`
  })

  data.append('pinataMetadata', pinataMetadata)
  
  const req = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.pinata_jwt_key}`,
          
      },
      body: data
  }
    
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', req)
  const resData = await res.json()
  
  // Convert to CID object
  const cidV0 = new CID(resData.IpfsHash)

  // Convert to CIDv1 in Base32
  const cidV1Base32 = cidV0.toV1().toString('base32')

  return `https://${cidV1Base32}.ipfs.nftstorage.link`
}

async function upload(url: any, seconds: any, prompt: any) {
  const metadata = await uploadToIPFS(url, pinata, seconds, prompt)
  return metadata
}

async function getInferenceStatus(id: any, address: any, seconds: any, prompt: any) {
  console.log('getting inference status for: ',id)
  return new Promise(async (res) => {
    const { data } = await sdk.getModelsInferencesByModelIdAndInferenceId({
      modelId, 
      inferenceId: id
    })
    if(isValidKey(data)){
      res({ status: data.inference.status, seconds: seconds, prompt: prompt, url: data.inference.images[0].url, address: address })
    } else {
      res({ status: data.inference.status, seconds: seconds, prompt: prompt, url: null, address: address })
    }
  })
}

function bufferToStream(buffer: any) {
  const readable = new Readable();
  readable._read = () => {} // _read is required but you can noop it
  readable.push(buffer)
  readable.push(null)
  return readable
}

async function uploadToIPFS(url: any, pinata: any, seconds: any, prompt: any) {
  try {
  
    const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer'
    })

    // Convert the downloaded data to a stream
    const fileStream = bufferToStream(response.data)

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

    // await core.append(metadata)

    return metadata
  } catch (error) {
      console.error('Error uploading file to IPFS:', error)
      throw error
  }
}

processInferencePool()