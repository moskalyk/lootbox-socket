"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
// Strings
const Strings = (base) => {
    base.toSnakeCase = (str) => {
        return str.toLowerCase().replace(/\s+/g, '_');
    };
    base.removeCharacter = (str, charToRemove) => {
        return str.replace(new RegExp(charToRemove, 'g'), '');
    };
    base.isValidKey = (data) => {
        try {
            // Check if 'data' is an object and has 'inference' property
            if (typeof data === 'object' && data !== null && 'inference' in data) {
                // Check if 'inference' has 'images' property which is an array
                if (Array.isArray(data.inference.images) && data.inference.images.length > 0) {
                    // Check if the first element of 'images' array has 'url' property
                    return 'url' in data.inference.images[0];
                }
            }
        }
        catch (error) {
            console.error("An error occurred:", error);
        }
        return false;
    };
    base.formatStatString = (str, main = true) => {
        if (str == null)
            return [];
        const regex = /^(.*?)\s*([+-]?\d+)(-)?(\d+)?(%?)$/;
        const matches = str.match(regex);
        let formattedResult = [];
        if (matches) {
            let [_, stat_name, firstValue, rangeIndicator, secondValue, percentageSymbol] = matches;
            stat_name = base.removeCharacter(stat_name, ':');
            const baseDisplayType = base.toSnakeCase(stat_name);
            const isPercentage = percentageSymbol === '%';
            if (rangeIndicator === '-') {
                formattedResult.push({
                    "display_type": main ? baseDisplayType + "_min" : "sub_stats_" + baseDisplayType + "_min",
                    "trait_type": stat_name + " Minimum",
                    "value": parseInt(firstValue, 10) + (isPercentage ? '%' : '')
                });
                formattedResult.push({
                    "display_type": main ? baseDisplayType + "_max" : "sub_stats_" + baseDisplayType + "_max",
                    "trait_type": stat_name + " Maximum",
                    "value": parseInt(secondValue, 10) + (isPercentage ? '%' : '')
                });
            }
            else {
                formattedResult.push({
                    "display_type": main ? baseDisplayType : "sub_stats_" + baseDisplayType,
                    "trait_type": stat_name,
                    "value": parseInt(firstValue, 10) + (isPercentage ? '%' : '')
                });
            }
        }
        return formattedResult;
    };
    return base;
};
// Stream
const stream_1 = require("stream");
const Stream = (base) => {
    base.bufferToStream = (buffer) => {
        const readable = new stream_1.Readable();
        readable._read = () => { }; // _read is required but you can noop it
        readable.push(buffer);
        readable.push(null);
        return readable;
    };
    return base;
};
// Inference
const api_1 = __importDefault(require("api"));
const modelId = process.env.model_id;
const sdk = (0, api_1.default)('@scenario-api/v1.0#fydhn73iklq3ujnso');
sdk.auth(`Basic ${process.env.scenario_api_key}`);
const Inference = (base) => {
    return Object.assign(Object.assign({}, base), { getInferenceWithItem: (prompt) => __awaiter(void 0, void 0, void 0, function* () {
            return new Promise((res) => __awaiter(void 0, void 0, void 0, function* () {
                const { data } = yield sdk.postModelsInferencesByModelId({
                    parameters: {
                        type: 'txt2img',
                        qualityBoostScale: 4,
                        scheduler: 'EulerDiscreteScheduler',
                        numSamples: 1,
                        prompt: prompt + ' single object on black background no people'
                    }
                }, { modelId: modelId });
                res({ inferenceId: data.inference.id, prompt: prompt, seconds: base.getCurrentSecond() });
            }));
        }), getInferenceStatus: (id, address, seconds, prompt) => {
            console.log('getting inference status for: ', id);
            return new Promise((res) => __awaiter(void 0, void 0, void 0, function* () {
                const { data } = yield sdk.getModelsInferencesByModelIdAndInferenceId({
                    modelId,
                    inferenceId: id
                });
                if (base.isValidKey(data)) {
                    res({ status: data.inference.status, seconds: seconds, prompt: prompt, url: data.inference.images[0].url, address: address });
                }
                else {
                    res({ status: data.inference.status, seconds: seconds, prompt: prompt, url: null, address: address });
                }
            }));
        } });
};
// ProcessInferencePool
const ProcessInferencePool = (base) => {
    base.inferencePool = {};
    return Object.assign(Object.assign({}, base), { processInferencePool: () => __awaiter(void 0, void 0, void 0, function* () {
            while (true) {
                yield base.wait(1000 * 10); // check for status every 10 seconds
                const entries = Object.entries(base.inferencePool);
                let urls = [];
                let listOfAddresses = [];
                let times = [];
                let prompts = [];
                const promises = entries.map(([id, obj]) => {
                    if (obj.awaitingMint == false) {
                        console.log(obj.address);
                        return base.getInferenceStatus(id, obj.address, obj.seconds, obj.prompt).then(({ status, url, address, seconds, prompt }) => __awaiter(void 0, void 0, void 0, function* () {
                            console.log(status);
                            if (status == 'succeeded' && !listOfAddresses.includes(address)) {
                                // TODO: do cleanup of this logic with objects                 
                                prompts.push(prompt);
                                urls.push(url);
                                times.push(seconds);
                                listOfAddresses.push(address);
                            }
                            else {
                                console.log('status else');
                                console.log(status);
                            }
                        }));
                    }
                });
                yield Promise.all(promises);
                if (urls.length > 0) {
                    // Process URLs after all getInferenceStatus calls are done
                    const MetadataPromises = urls.map((url, i) => base.upload(url, times[i], prompts[i]));
                    const metadatas = yield Promise.all(MetadataPromises);
                    const ids = Object.keys(base.loggedIn);
                    for (let i = 0; i < ids.length; i++) {
                        const socket = base.loggedIn[ids[i]];
                        for (let j = 0; j < listOfAddresses.length; j++) {
                            // TODO: do more to cleanup lists
                            // if addressess align with sockets, remove and emit
                            if (listOfAddresses[j].toLowerCase() == socket.address.toLowerCase() && socket.socket) {
                                const index = listOfAddresses.indexOf(socket.address);
                                if (index > -1) { // only splice array when item is found
                                    listOfAddresses.splice(index, 1); // 2nd parameter means remove one item only
                                }
                                const entries = Object.entries(base.inferencePool);
                                const filteredEntries = entries.filter((entry) => !entry[1].awaitingMint);
                                for (let k = 0; k < filteredEntries.length; k++) {
                                    if (filteredEntries[k][1].address.toLowerCase() == socket.address.toLowerCase()) {
                                        filteredEntries[k][1].data.url = metadatas[k].image;
                                        base.inferencePool[filteredEntries[k][0]].awaitingMint = true;
                                        socket.socket.emit(`loot`, filteredEntries[k]);
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }) });
};
// Upload
const cids_1 = __importDefault(require("cids"));
const pinataSDK = require('@pinata/sdk');
const pinata = new pinataSDK({ pinataJWTKey: process.env.pinata_jwt_key });
const Upload = (base) => {
    base.uploadToIPFS = (url, pinata, seconds, prompt) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield (0, axios_1.default)({
                method: 'get',
                url: url,
                responseType: 'arraybuffer'
            });
            // Convert the downloaded data to a stream
            const fileStream = base.bufferToStream(response.data);
            // Pinata upload options
            const options = {
                pinataMetadata: {
                    name: 'loot',
                    keyvalues: {
                        sourceGeneration: 'scenario.gg',
                        time: seconds,
                        prompt: prompt,
                        aesthetic: JSON.stringify(['medieval', 'compute', 'single-object', 'no people'])
                    }
                },
                pinataOptions: {
                    cidVersion: 0
                }
            };
            // Upload the file to IPFS using Pinata
            const res = yield pinata.pinFileToIPFS(fileStream, options);
            // Convert to CID object
            const cidV0 = new cids_1.default(res.IpfsHash);
            // Convert to CIDv1 in Base32
            const cidV1Base32 = cidV0.toV1().toString('base32');
            const metadata = {
                name: 'Lootbox: ' + prompt,
                description: 'A free lootbox mini-game available for use in any game that requires collectible rewards',
                image: `https://${cidV1Base32}.ipfs.nftstorage.link`
            };
            return metadata;
        }
        catch (error) {
            console.error('Error uploading file to IPFS:', error);
            throw error;
        }
    });
    return Object.assign(Object.assign({}, base), { null: (buffer) => {
            console.log('todo');
        }, upload: (url, seconds, prompt) => __awaiter(void 0, void 0, void 0, function* () {
            const metadata = yield base.uploadToIPFS(url, pinata, seconds, prompt);
            return metadata;
        }) });
    return base;
};
// Time
const Time = (base) => {
    return Object.assign(Object.assign({}, base), { wait: (ms) => __awaiter(void 0, void 0, void 0, function* () { return new Promise((res) => setTimeout(res, ms)); }), getCurrentSecond: () => {
            const now = new Date();
            return now.getSeconds();
        } });
};
// Server 
const http_1 = require("http");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const CLIENT_URL = process.env.client_url;
const corsOptions = {
    origin: CLIENT_URL,
};
const Server = (base) => {
    base.app = (0, express_1.default)();
    base.httpServer = (0, http_1.createServer)(base.app);
    base.app.use((0, cors_1.default)(corsOptions));
    return Object.assign({}, base);
};
// SocketMintPool
const socket_io_1 = require("socket.io");
const ethers = __importStar(require("ethers"));
const auth_1 = require("@0xsequence/auth");
const core_1 = require("@0xsequence/core");
const ethauth_1 = require("@0xsequence/ethauth");
const sessions_1 = require("@0xsequence/sessions");
const auth_2 = require("@0xsequence/auth");
const axios_1 = __importDefault(require("axios"));
const AWS = require('aws-sdk');
const rpcUrl = 'https://nodes.sequence.app/arbitrum-nova';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const contractAddress = '0xdc85610fd15b64d1b48db4ebaabc61ee2f62fb6d';
const abi_1 = require("./abi");
const SocketProcessInferencePool = (base) => {
    base.loggedIn = {};
    base.io = new socket_io_1.Server(base.httpServer, {
        cors: {
            origin: CLIENT_URL
        }
    });
    base.validator = (0, auth_1.ValidateSequenceWalletProof)(() => new core_1.commons.reader.OnChainReader(provider), new sessions_1.trackers.remote.RemoteConfigTracker('https://sessions.sequence.app'), core_1.v2.DeployedWalletContext);
    base.ethauth = new ethauth_1.ETHAuth(base.validator);
    base.mintPool = {};
    base.listOfAddresses = [];
    base.inferencePool = {};
    AWS.config.update({
        accessKeyId: process.env.accessKeyId,
        secretAccessKey: process.env.secretAccessKey,
        region: 'us-east-2'
    });
    base.s3 = new AWS.S3();
    return Object.assign(Object.assign({}, base), { processInferencePool: () => __awaiter(void 0, void 0, void 0, function* () {
            while (true) {
                yield base.wait(1000 * 10); // check for status every 10 seconds
                const entries = Object.entries(base.inferencePool);
                let urls = [];
                // let listOfAddresses: any = []
                let times = [];
                let prompts = [];
                const promises = entries.map(([id, obj]) => {
                    if (obj.awaitingMint == false) {
                        return base.getInferenceStatus(id, obj.address, obj.seconds, obj.prompt).then(({ status, url, address, seconds, prompt }) => __awaiter(void 0, void 0, void 0, function* () {
                            console.log(status);
                            console.log(address);
                            if (status == 'succeeded') {
                                // TODO: do cleanup of this logic with objects   
                                console.log('added to lists');
                                prompts.push(prompt);
                                urls.push(url);
                                times.push(seconds);
                                base.listOfAddresses.push(address);
                            }
                            else {
                                console.log('status else');
                                console.log(status);
                            }
                        }));
                    }
                });
                yield Promise.all(promises);
                if (urls.length > 0) {
                    // Process URLs after all getInferenceStatus calls are done
                    const MetadataPromises = urls.map((url, i) => base.upload(url, times[i], prompts[i]));
                    const metadatas = yield Promise.all(MetadataPromises);
                    const ids = Object.keys(base.loggedIn);
                    for (let i = 0; i < ids.length; i++) {
                        const socket = base.loggedIn[ids[i]];
                        for (let j = 0; j < base.listOfAddresses.length; j++) {
                            // TODO: do more to cleanup lists
                            // if addressess align with sockets, remove and emit
                            console.log(socket.address);
                            console.log('here');
                            console.log(base.listOfAddresses);
                            console.log(base.listOfAddresses[j]);
                            console.log(base.listOfAddresses[j].toLowerCase());
                            console.log(socket.address.toLowerCase());
                            if (base.listOfAddresses[j].toLowerCase() == socket.address.toLowerCase() && socket.socket) {
                                const index = base.listOfAddresses.indexOf(socket.address);
                                if (index > -1) { // only splice array when item is found
                                    base.listOfAddresses.splice(index, 1); // 2nd parameter means remove one item only
                                }
                                const entries = Object.entries(base.inferencePool);
                                const filteredEntries = entries.filter((entry) => !entry[1].awaitingMint);
                                for (let k = 0; k < filteredEntries.length; k++) {
                                    if (filteredEntries[k][1].address.toLowerCase() == socket.address.toLowerCase()) {
                                        filteredEntries[k][1].data.url = metadatas[k].image;
                                        base.inferencePool[filteredEntries[k][0]].awaitingMint = true;
                                        socket.socket.emit(`loot`, filteredEntries[k]);
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }), processMintPool: () => __awaiter(void 0, void 0, void 0, function* () {
            while (true) {
                yield base.wait(1000 * 4); // check for status every 10 seconds
                const mints = Object.entries(base.mintPool);
                const entries = Object.entries(base.inferencePool);
                console.log(mints);
                console.log(entries);
                if (mints.length > 0) {
                    const directory = [];
                    for (let i = 0; i < mints.length; i++) {
                        // get token supply
                        const provider = new ethers.providers.JsonRpcProvider('https://nodes.sequence.app/arbitrum-nova');
                        const contract = new ethers.Contract(contractAddress, abi_1.abi, provider);
                        let totalSupply;
                        try {
                            // Call the totalSupply function
                            totalSupply = yield contract.totalSupply();
                            console.log(`Total Supply: ${totalSupply.toString()}`);
                        }
                        catch (error) {
                            console.error(`Error in fetching total supply: ${error}`);
                        }
                        // // Create your server EOA
                        const walletEOA = new ethers.Wallet(String(process.env.PKEY), provider);
                        // // Open a Sequence session, this will find or create
                        // // a Sequence wallet controlled by your server EOA
                        try {
                            // Call the totalSupply function
                            const session = yield auth_2.Session.singleSigner({
                                signer: walletEOA,
                                projectAccessKey: '9q8Y4eTF3moQnahjXCDBwtZCAAAAAAAAA'
                            });
                            //   const signer = session.account.getSigner()
                            let mintTxs = [];
                            const signer = session.account.getSigner(42170);
                            console.log(signer.account.address);
                            for (let j = 0; j < entries.length; j++) {
                                console.log(entries);
                                console.log(mints);
                                if (mints[i][0].toLowerCase() == entries[j][1].address.toLowerCase()) {
                                    console.log('minting');
                                    console.log(entries);
                                    delete base.inferencePool[entries[j][0]];
                                    console.log('mint pool');
                                    console.log(base.mintPool);
                                    console.log(base.mintPool[entries[j][1].address.toLowerCase()]);
                                    console.log(entries[j][1].address.toLowerCase());
                                    delete base.mintPool[entries[j][1].address.toLowerCase()];
                                    const metadata = {
                                        name: 'Lootbox: ' + entries[j][1].data.name,
                                        description: 'A free lootbox mini-game available for use in any game that requires collectible rewards',
                                        image: entries[j][1].data.url,
                                        attributes: entries[j][1].attributes
                                    };
                                    // add to array
                                    console.log(metadata);
                                    // create interface from partial abi
                                    const collectibleInterface = new ethers.utils.Interface([
                                        'function collect(address to)'
                                    ]);
                                    // create calldata
                                    const data = collectibleInterface.encodeFunctionData('collect', [mints[i][0]]);
                                    const txn = {
                                        to: contractAddress,
                                        data
                                    };
                                    // Send the transaction
                                    mintTxs.push(txn);
                                    directory.push(metadata);
                                }
                            }
                            //   console.log(signer.account.address)
                            let txnResponse;
                            directory.map((collectible, i) => __awaiter(void 0, void 0, void 0, function* () {
                                const jsonBuffer = Buffer.from(JSON.stringify(collectible));
                                const params = {
                                    Bucket: 'sequence-lootbox-demo',
                                    Key: `${Number(totalSupply) + i}.json`,
                                    Body: jsonBuffer
                                };
                                console.log(yield base.s3.upload(params).promise());
                            }));
                            console.log(directory);
                            try {
                                txnResponse = yield signer.sendTransaction([...mintTxs]);
                                console.log(txnResponse);
                            }
                            catch (err) {
                                console.log(err);
                            }
                        }
                        catch (error) {
                            console.error(`Error: ${error}`);
                        }
                    }
                }
            }
        }), initETHAuthProof: () => {
            base.io.use((socket, next) => __awaiter(void 0, void 0, void 0, function* () {
                const token = socket.handshake.query.token;
                console.log(token);
                // const address = socket.handshake.query.address as string;
                yield base.ethauth.configJsonRpcProvider(rpcUrl);
                try {
                    const proof = yield base.ethauth.decodeProof(token);
                    // only allow for 1 socket
                    const sockets = Object.entries(base.loggedIn);
                    for (let i = 0; i < sockets.length; i++) {
                        console.log(sockets[i]);
                        // }
                        if (sockets[i][1].hasOwnProperty('address') && sockets[i][1].address == proof.address) {
                            next(new Error('Duplicate Socket'));
                        }
                    }
                    base.loggedIn[socket.id] = { address: proof.address, socket: null };
                    console.log(`proof for address ${proof.address} is valid`);
                    next();
                }
                catch (err) {
                    console.log(`invalid proof -- do not trust address: ${err}`);
                    next(new Error('Authentication error'));
                }
            }));
        }, boot: () => {
            base.io.on('connection', (socket) => {
                if (base.loggedIn[socket.id]) { // check for duplicate sockets
                    base.loggedIn[socket.id] = { address: base.loggedIn[socket.id].address, socket: socket };
                    // console.log(loggedIn[socket.id])
                    socket.on('disconnect', () => {
                        console.log('Client disconnected');
                        console.log(socket.id);
                        delete base.loggedIn[socket.id];
                    });
                    socket.on('cancel', (data) => __awaiter(void 0, void 0, void 0, function* () {
                        console.log(data.address);
                        const entries = Object.entries(base.inferencePool);
                        for (let i = 0; i < entries.length; i++) {
                            console.log(entries[i]);
                            if (entries[i][1].address.toLowerCase() == data.address.toLowerCase()) {
                                delete base.inferencePool[entries[i][0]];
                            }
                        }
                    }));
                    socket.on('mint', (data) => __awaiter(void 0, void 0, void 0, function* () {
                        console.log(data.address);
                        base.mintPool[data.address.toLowerCase()] = true;
                    }));
                    socket.on('ping', (data, callback) => __awaiter(void 0, void 0, void 0, function* () {
                        callback({ status: 'ok' });
                    }));
                    socket.on('collect', (data) => __awaiter(void 0, void 0, void 0, function* () {
                        console.log('Received response:', data);
                        const res = yield (0, axios_1.default)('http://127.0.0.1:5000');
                        console.log(res.data);
                        const attributes = [];
                        const defend = Math.random() > 0.5 ? true : false;
                        // category
                        attributes.push({
                            display_type: "category",
                            trait_type: "Category",
                            value: res.data[defend ? 'armor' : 'weapon'].category
                        });
                        // main stats
                        attributes.push(...base.formatStatString(res.data[defend ? 'armor' : 'weapon'].main_stats[0], true));
                        // sub stats
                        const sub_stats = res.data[defend ? 'armor' : 'weapon'].stats;
                        // tier
                        sub_stats.map((stats) => {
                            attributes.push(...base.formatStatString(stats, false));
                        });
                        // type
                        attributes.push({
                            display_type: "tier",
                            trait_type: "tier",
                            value: res.data[defend ? 'armor' : 'weapon'].tier
                        });
                        attributes.push({
                            display_type: "type",
                            trait_type: "type",
                            value: res.data[defend ? 'armor' : 'weapon'].type
                        });
                        console.log(attributes);
                        console.log(data.address);
                        console.log('address');
                        console.log(data.proof.proofString.split('.')[1]);
                        const { inferenceId, seconds, prompt } = yield base.getInferenceWithItem(res.data[defend ? 'armor' : 'weapon'].name + "with the aesethic" + res.data[defend ? 'armor' : 'weapon'].category);
                        base.inferencePool[inferenceId] = { address: data.proof.proofString.split('.')[1], seconds: base.getCurrentSecond(), prompt: res.data[defend ? 'armor' : 'weapon'].name, data: res.data[defend ? 'armor' : 'weapon'], attributes: attributes, awaitingMint: false };
                    }));
                }
            });
        } });
};
(() => {
    let PORT = 3000;
    let lootbox = SocketProcessInferencePool(//  ☼
    Inference(Server(Time(Strings(Upload(Stream({
    //  ★
    })))))));
    lootbox.initETHAuthProof();
    lootbox.boot();
    lootbox.httpServer.listen(PORT, () => {
        lootbox.processInferencePool();
        lootbox.processMintPool();
        console.log(`Listening on port ${PORT}`);
    });
})();
