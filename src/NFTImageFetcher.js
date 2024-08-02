import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Bonanza_abi } from './NFT_abi';
import { MarketPlace_abi } from './MarketPlace_abi';
import './NFTImageFetcher.css';
import axios from 'axios';

const nftContractAddress = '0xcae1a5ca6449Cb7BaFFD6c3B07b0E7b0ba5bc9D8';
const marketPlaceContractAddress = '0x2476752f48A5D040026D3E1e1f7E753710702A5e';
const pinataApiKey = 'd412d28403144441fa5a'; // Replace with your Pinata API key
const pinataSecretApiKey = '69836f8f0767011e1d8375728effcbfe055ae19f844042c591f56b0da5ca72dd';
const NFTImageFetcher = () => {
    const [signerAddress, setSignerAddress] = useState(null);
    const [nftContract, setNftContract] = useState(null);
    const [marketPlaceContract, setMarketPlaceContract] = useState(null);
    const [nfts, setNfts] = useState([]);
    const [assets, setAssets] = useState([]);
    const [error, setError] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [signer, setSigner] = useState(null);
    const [price, setPrice] = useState('');
    const [activeTab, setActiveTab] = useState('mint'); // 'mint', 'myNFTs', 'listedNFTs'
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountChange);
        }

        if (nftContract) {
            fetchAssets();
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountChange);
            }
        };
    }, [signerAddress, nftContract, marketPlaceContract]);

    const handleAccountChange = async (accounts) => {
        if (accounts.length > 0) {
            const newSignerAddress = accounts[0];
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const nftContract = new ethers.Contract(nftContractAddress, Bonanza_abi, signer);
            const marketContract = new ethers.Contract(marketPlaceContractAddress, MarketPlace_abi, signer);
            setSigner(signer);
            setNftContract(nftContract);
            setMarketPlaceContract(marketContract);
            setSignerAddress(newSignerAddress);
            setIsConnected(true);
        } else {
            setIsConnected(false);
            setSignerAddress(null);
            setSigner(null);
            setNftContract(null);
        }
    };

    const connectToMetaMask = async () => {
        if (window.ethereum) {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                setSigner(signer);
                const nftContract = new ethers.Contract(nftContractAddress, Bonanza_abi, signer);
                const marketContract = new ethers.Contract(marketPlaceContractAddress, MarketPlace_abi, signer);
                setNftContract(nftContract);
                setMarketPlaceContract(marketContract);
                const address = await signer.getAddress();
                setSignerAddress(address);
                setIsConnected(true);
            } catch (error) {
                console.error('Error connecting to Ethereum provider:', error);
                setError('Error connecting to Ethereum provider. Please check your MetaMask and refresh the page.');
            }
        } else {
            setError('MetaMask is not installed');
        }
    };

    const uploadToIPFS = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const metadata = JSON.stringify({
            name: file.name,
            keyvalues: {
                exampleKey: 'exampleValue'
            }
        });

        formData.append('pinataMetadata', metadata);

        const options = JSON.stringify({
            cidVersion: 0,
        });

        formData.append('pinataOptions', options);

        try {
            const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
                maxContentLength: 'Infinity',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                    'pinata_api_key': pinataApiKey,
                    'pinata_secret_api_key': pinataSecretApiKey
                }
            });
            console.log('Image uploaded to IPFS:', res.data.IpfsHash); // Debugging log
            return res.data.IpfsHash;
        } catch (error) {
            console.error('Error uploading file to IPFS:', error);
            setError('Error uploading file to IPFS');
            return null;
        }
    };

    const createMetadata = async (imageHash, price) => {
        const metadata = {
            name: 'NFT Name',
            description: 'NFT Description',
            image: `ipfs://${imageHash}`,
            price: price,
        };

        try {
            const res = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadata, {
                headers: {
                    'Content-Type': 'application/json',
                    'pinata_api_key': pinataApiKey,
                    'pinata_secret_api_key': pinataSecretApiKey
                }
            });
            console.log('Metadata uploaded to IPFS:', res.data.IpfsHash); // Debugging log
            return `ipfs://${res.data.IpfsHash}`;
        } catch (error) {
            console.error('Error uploading metadata to IPFS:', error);
            setError('Error uploading metadata to IPFS');
            return null;
        }
    };

    const mintAndListNFT = async (price) => {
        if (!selectedFile) {
            setError('Please select a file to upload');
            return;
        }

        try {
            const imageHash = await uploadToIPFS(selectedFile);
            if (!imageHash) {
                return;
            }

            const tokenURI = await createMetadata(imageHash, price);
            if (!tokenURI) {
                return;
            }

            if (!nftContract) {
                setError('NFT contract not initialized.');
                return;
            }

            const transaction = await nftContract.safeMint(tokenURI);
            const receipt = await transaction.wait();
            console.log('Token minted successfully!', receipt); // Debugging log

            const tokenId = receipt.events[0].args.tokenId.toNumber();
            console.log('Minted Token ID:', tokenId);

            if (!marketPlaceContract) {
                setError('Marketplace contract not initialized.');
                return;
            }

            const listTransaction = await marketPlaceContract.listToken(tokenId, ethers.utils.parseEther(price));
            await listTransaction.wait();
            console.log('Token listed successfully!', receipt); // Debugging log

            setError('');
            fetchAssets(); // Fetch updated assets after minting and listing
        } catch (error) {
            console.error('Error minting and listing token:', error);
            setError(`Error minting and listing token`);
        }
    };

    const fetchTokenURIs = async () => {
        if (nftContract && marketPlaceContract) {
            try {
                const ids = await marketPlaceContract.getListedTokenIds();
                const nftDataPromises = ids.map(async (id) => {
                    try {
                        const tokenId = id.toNumber(); // Convert BigNumber to number

                        let uri = await nftContract.tokenURI(tokenId);
                        uri = uri.replace("ipfs://", "")
                        uri = "https://gateway.pinata.cloud/ipfs/" + uri;
                        const response = await fetch(uri);

                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }

                        const contentType = response.headers.get('content-type');
                        if (!contentType || !contentType.includes('application/json')) {
                            const errorText = await response.text();
                            throw new Error(`Expected JSON, got: ${contentType}\nResponse: ${errorText}`);
                        }

                        const metadata = await response.json();
                        const imageUri = metadata.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
                        const price = await fetchPrice(tokenId);
                        return { id: tokenId, imageUri, price };
                    } catch (fetchError) {
                        console.error(`Error fetching metadata for token ID ${id}: ${fetchError.message}`);
                        setError(`Error fetching metadata for token ID ${id}: ${fetchError.message}`);
                        return null; // Return null in case of an error
                    }
                });

                const nftData = await Promise.all(nftDataPromises);
                setNfts(nftData.filter(nft => nft !== null)); // Filter out null values
                setError('');
            } catch (contractError) {
                console.error(`Error fetching token URIs: ${contractError.message}`);
                setError(`Error fetching token URIs: ${contractError.message}`);
            }
        } else {
            setError('Contract instance not initialized.');
        }
    };

    const fetchPrice = async (id) => {
        if (marketPlaceContract) {
            try {
                const nftPrice = await marketPlaceContract.listings(id);
                return ethers.utils.formatEther(nftPrice.price); // Convert price to a readable format
            } catch (contractError) {
                console.error(`Error fetching token prices: ${contractError.message}`);
                setError(`Error fetching token prices: ${contractError.message}`);
            }
        } else {
            setError('MarketPlace contract instance not initialized.');
        }
    };

    const buyToken = async (id, price) => {
        if (marketPlaceContract) {
            try {
                const tx = await marketPlaceContract.buyToken(id, { value: ethers.utils.parseEther(price) });
                await tx.wait();
                alert('Purchase successful!');
            } catch (contractError) {
                console.error(`Error during purchase: ${contractError.message}`);
                setError(`Error during purchase: ${contractError.message}`);
            }
        } else {
            setError('MarketPlace contract instance not initialized.');
        }
    };

    const fetchAssets = async () => {
        if (nftContract && signerAddress) {
            try {
                console.log(signerAddress)
                const ids = await nftContract.tokensOfOwner(signerAddress);
                const assetDataPromises = ids.map(async (id) => {
                    try {
                        const tokenId = id.toNumber(); // Convert BigNumber to number

                        let uri = await nftContract.tokenURI(tokenId);
                        console.log(uri);
                        uri = uri.replace("ipfs://", "")
                        uri = "https://gateway.pinata.cloud/ipfs/" + uri;
                        console.log(uri);

                        const response = await fetch(uri);

                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }

                        const contentType = response.headers.get('content-type');
                        if (!contentType || !contentType.includes('application/json')) {
                            const errorText = await response.text();
                            throw new Error(`Expected JSON, got: ${contentType}\nResponse: ${errorText}`);
                        }

                        const metadata = await response.json();
                        console.log(metadata);
                        const imageUri = metadata.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
                        return { id: tokenId, imageUri };
                    } catch (fetchError) {
                        console.error(`Error fetching metadata for token ID ${id}: ${fetchError.message}`);
                        setError(`Error fetching metadata for token ID ${id}: ${fetchError.message}`);
                        return null; // Return null in case of an error
                    }
                });

                const assetData = await Promise.all(assetDataPromises);
                setAssets(assetData.filter(asset => asset !== null)); // Filter out null values
                setError('');
            } catch (contractError) {
                console.error(`Error fetching asset URIs: ${contractError.message}`);
                setError(`Error fetching asset URIs: ${contractError.message}`);
            }
        } else {
            setError('Contract instance not initialized or signer address not available.');
        }
    };

    useEffect(() => {
        fetchTokenURIs();
        fetchAssets();

    }, [nftContract, marketPlaceContract, signerAddress]);

    const toggleTab = (tab) => {
        setActiveTab(tab);
    };

    return (
        <>
            <div className="container">
                <div className="header">
                    <div className="top-section">
                        <h1>PICARTS</h1>
                        <div className="connect-button-container">
                            {!isConnected ? (
                                <button onClick={connectToMetaMask} className="connect-button">Connect to MetaMask</button>
                            ) : (
                                <p>Connected as {signerAddress}</p>
                            )}
                        </div>
                    </div>
                    <div className="tabs">
                        <button
                            className={activeTab === 'mint' ? 'active-tab' : ''}
                            onClick={() => toggleTab('mint')}
                        >
                            Mint
                        </button>
                        <button
                            className={activeTab === 'listedNFTs' ? 'active-tab' : ''}
                            onClick={() => toggleTab('listedNFTs')}
                        >
                            NFT MARKETPLACE
                        </button>
                        <button
                            className={activeTab === 'myNFTs' ? 'active-tab' : ''}
                            onClick={() => toggleTab('myNFTs')}
                        >
                            My NFTs
                        </button>
                    </div>
                </div>

                <div className="content">
                    {activeTab === 'mint' && (
                        <div className="mint-section">
                            <h2>Mint NFT</h2>
                            <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} />
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="Enter Price in Ether"
                            />
                            <button onClick={() => mintAndListNFT(price)} className="mint-button">Mint</button>
                            {error && <p style={{ color: 'red' }}>{error}</p>}
                        </div>
                    )}

                    {activeTab === 'myNFTs' && (
                        <div className="user-nfts">
                            {error && <p style={{ color: 'red' }}>{error}</p>}
                            <div>
                                {assets.length > 0 ? (
                                    assets.map((asset) => (
                                        <div key={asset.id}>
                                            <h2>Token ID: {asset.id}</h2>
                                            <img src={asset.imageUri} alt={`NFT ${asset.id}`} />
                                        </div>
                                    ))
                                ) : (
                                    <p>You don't own any NFTs yet.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'listedNFTs' && (
                        <div className="minted-nfts">
                            {error && <p style={{ color: 'red' }}>{error}</p>}
                            <div>
                                {nfts.length > 0 ? (
                                    nfts.map((nft) => (
                                        <div key={nft.id}>
                                            <h2>Token ID: {nft.id}</h2>
                                            <img src={nft.imageUri} alt={`NFT ${nft.id}`} />
                                            <h2>Price: {nft.price ? `${nft.price} ETH` : 'Loading...'}</h2>
                                            <button onClick={() => buyToken(nft.id, nft.price)} className="mint-button">BUY</button>
                                        </div>
                                    ))
                                ) : (
                                    <p>No NFTs listed.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default NFTImageFetcher;
