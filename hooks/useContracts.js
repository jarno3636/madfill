// hooks/useContracts.js
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { useMiniWallet } from './useMiniWallet'

// ------- env / constants -------
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453', 10)

const ADDR = {
  FILL_IN_STORY:
    process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
    '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b',
  MADFILL_NFT:
    process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
    process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS ||
    '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c',
}

// Hard cap when brute-forcing token IDs client-side
const NFT_SCAN_CAP = Number(process.env.NEXT_PUBLIC_NFT_SCAN_CAP || 500)

// ------- ABI loading (dynamic for SSR safety) -------
let FILL_ABI, NFT_ABI

async function loadAbis() {
  if (FILL_ABI && NFT_ABI) return
  try {
    const [fillMod, nftMod] = await Promise.all([
      import('../abi/FillInStoryV3_ABI.json'),
      import('../abi/MadFillTemplateNFT_ABI.json'),
    ])
    FILL_ABI = (fillMod && (fillMod.default || fillMod)) || FILL_ABI
    NFT_ABI = (nftMod && (nftMod.default || nftMod)) || NFT_ABI
  } catch (err) {
    console.warn('Falling back to minimal ABIs:', err)
    // minimal fallback slices
    FILL_ABI = [
      'function createPool1(string name,string theme,string[] parts,string word,string username,uint256 entryFee,uint256 duration,uint256 blankIndex) payable',
      'function joinPool1(uint256 id,string word,string username,uint256 blankIndex) payable',
      'function getPool1Info(uint256 id) view returns (string,string,string[],uint256,uint256,address,address,address,bool,uint256)',
      'function pool1Count() view returns (uint256)',
      'function getPool1Submission(uint256 id,address who) view returns (string username,string word,uint256 ts,uint256 blankIndex)',
      'function getPool1SubmissionsPacked(uint256 id) view returns (address[] addrs,string[] usernames,string[] words,uint256[] blankIndexes)',
      'function getPool1Taken(uint256 id) view returns (bool[])',
      'function claimPool1(uint256 id)',
    ]
    NFT_ABI = [
      'function ownerOf(uint256) view returns (address)',
      'function totalSupply() view returns (uint256)',
      'function tokenURI(uint256) view returns (string)',
      'function balanceOf(address) view returns (uint256)',
      'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
    ]
  }
}

// ------- hook -------
export function useContracts() {
  const { isConnected } = useMiniWallet()

  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [contracts, setContracts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isReady = useMemo(() => !!contracts, [contracts])

  // init provider + contracts
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        await loadAbis()

        // Always have a read provider
        const readProv = new ethers.JsonRpcProvider(BASE_RPC)
        if (!cancelled) setProvider(readProv)

        // Optional signer (only client + wallet)
        let signerLocal = null
        if (typeof window !== 'undefined' && window.ethereum && isConnected) {
          try {
            const browserProv = new ethers.BrowserProvider(window.ethereum)
            const net = await browserProv.getNetwork()
            if (Number(net.chainId) !== CHAIN_ID) {
              // best effort switch
              try {
                await window.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
                })
              } catch (_) {}
            }
            signerLocal = await browserProv.getSigner().catch(() => null)
          } catch (e) {
            console.warn('Signer init failed:', e)
          }
        }
        if (!cancelled) setSigner(signerLocal)

        const providerForContracts = signerLocal || readProv

        const fill = new ethers.Contract(ADDR.FILL_IN_STORY, FILL_ABI, providerForContracts)
        const nft = new ethers.Contract(ADDR.MADFILL_NFT, NFT_ABI, providerForContracts)

        if (!cancelled) setContracts({ fillInStory: fill, madfillNft: nft })
      } catch (e) {
        if (!cancelled) setError(e)
        console.error('useContracts init error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isConnected])

  // ---------- helpers ----------
  const createPool1 = useCallback(
    async (name, theme, parts, word, username, entryFeeEth, durationDays, blankIndex) => {
      if (!contracts?.fillInStory || !signer) throw new Error('Wallet not connected')
      try {
        const feeWei = ethers.parseEther(String(entryFeeEth))
        const duration = BigInt(Math.max(0, Number(durationDays)) * 86400)
        const tx = await contracts.fillInStory.createPool1(
          name,
          theme,
          parts,
          word,
          username,
          feeWei,
          duration,
          Number(blankIndex),
          { value: feeWei }
        )
        const receipt = await tx.wait()
        return { tx, receipt }
      } catch (e) {
        console.error('createPool1 failed:', e)
        throw e
      }
    },
    [contracts, signer]
  )

  const joinPool1 = useCallback(
    async (id, word, username, blankIndex, entryFeeEth) => {
      if (!contracts?.fillInStory || !signer) throw new Error('Wallet not connected')
      try {
        const feeWei = ethers.parseEther(String(entryFeeEth))
        // preflight for clearer reverts
        await contracts.fillInStory.joinPool1.staticCall(
          BigInt(id),
          String(word),
          String(username || ''),
          Number(blankIndex),
          { value: feeWei }
        )
        const tx = await contracts.fillInStory.joinPool1(
          BigInt(id),
          String(word),
          String(username || ''),
          Number(blankIndex),
          { value: feeWei }
        )
        const receipt = await tx.wait()
        return { tx, receipt }
      } catch (e) {
        console.error('joinPool1 failed:', e)
        throw e
      }
    },
    [contracts, signer]
  )

  const getPool1Info = useCallback(
    async (id) => {
      if (!contracts?.fillInStory) throw new Error('Contracts not ready')
      const info = await contracts.fillInStory.getPool1Info(BigInt(id))
      // Support both struct & tuple returns
      return {
        name: info.name_ ?? info[0],
        theme: info.theme_ ?? info[1],
        parts: info.parts_ ?? info[2],
        feeBase: info.feeBase_ ?? info[3],
        deadline: Number(info.deadline_ ?? info[4]),
        creator: info.creator_ ?? info[5],
        participants: info.participants_ ?? info[6],
        winner: info.winner_ ?? info[7],
        claimed: info.claimed_ ?? info[8],
        poolBalance: info.poolBalance_ ?? info[9],
      }
    },
    [contracts]
  )

  const getPool1Count = useCallback(
    async () => {
      if (!contracts?.fillInStory) throw new Error('Contracts not ready')
      const n = await contracts.fillInStory.pool1Count()
      return Number(n)
    },
    [contracts]
  )

  // ------- NFT helpers -------
  const getUserNFTTokenIds = useCallback(
    async (ownerAddress) => {
      if (!ownerAddress || !ethers.isAddress(ownerAddress)) return []
      try {
        // Try fast path if contract supports ERC721Enumerable
        if (contracts?.madfillNft?.tokenOfOwnerByIndex) {
          const bal = Number(await contracts.madfillNft.balanceOf(ownerAddress).catch(() => 0n))
          if (!bal) return []
          const ids = []
          for (let i = 0; i < bal; i++) {
            // eslint-disable-next-line no-await-in-loop
            const tid = await contracts.madfillNft.tokenOfOwnerByIndex(ownerAddress, i).catch(() => null)
            if (tid != null) ids.push(Number(tid))
          }
          return ids
        }

        // Fallback brute force scan up to cap
        const readProv = provider || new ethers.JsonRpcProvider(BASE_RPC)
        const nftRead = new ethers.Contract(ADDR.MADFILL_NFT, NFT_ABI, readProv)
        const totalSupply = Number(await nftRead.totalSupply().catch(() => 0n))
        const maxScan = Math.min(totalSupply, NFT_SCAN_CAP)
        const bal = Number(await nftRead.balanceOf(ownerAddress).catch(() => 0n))
        if (!bal || !maxScan) return []
        const owned = []
        for (let tokenId = 1; tokenId <= maxScan; tokenId++) {
          // eslint-disable-next-line no-await-in-loop
          const who = await nftRead.ownerOf(tokenId).catch(() => null)
          if (who && who.toLowerCase() === ownerAddress.toLowerCase()) {
            owned.push(tokenId)
            if (owned.length >= bal) break
          }
        }
        return owned
      } catch (e) {
        console.error('getUserNFTTokenIds failed:', e)
        return []
      }
    },
    [contracts, provider]
  )

  const getUserNFTs = useCallback(
    async (ownerAddress) => {
      const addr = ownerAddress
      const ids = await getUserNFTTokenIds(addr)
      if (!ids.length) return []
      // Optionally fetch tokenURIs too
      try {
        const nft = contracts?.madfillNft || new ethers.Contract(ADDR.MADFILL_NFT, NFT_ABI, provider || new ethers.JsonRpcProvider(BASE_RPC))
        const withUris = await Promise.all(
          ids.map(async (id) => {
            try {
              const uri = await nft.tokenURI(id)
              return { id, tokenURI: uri }
            } catch {
              return { id, tokenURI: null }
            }
          })
        )
        return withUris
      } catch {
        return ids.map((id) => ({ id, tokenURI: null }))
      }
    },
    [contracts, provider, getUserNFTTokenIds]
  )

  return {
    provider,
    signer,
    contracts,
    loading,
    error,
    isReady,

    // Pool helpers
    createPool1,
    joinPool1,
    getPool1Info,
    getPool1Count,

    // NFT helpers
    getUserNFTTokenIds,
    getUserNFTs,

    // addresses (for reference)
    addresses: ADDR,
  }
}
