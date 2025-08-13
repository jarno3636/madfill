// hooks/useContracts.js
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useMiniWallet } from './useMiniWallet'

// ---------- env / chain ----------
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '8453')

// Support either env var name for the NFT
const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS ||
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442'

// FillInStory V3 (Pool1) address
const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

// ---------- dynamic ABIs (SSR-safe) ----------
async function loadABIs() {
  try {
    const [fillAbi, nftAbi] = await Promise.all([
      import('../abi/FillInStoryV3_ABI.json'),
      import('../abi/MadFillTemplateNFT_ABI.json'),
    ])
    return {
      fill: fillAbi.default || fillAbi,
      nft: nftAbi.default || nftAbi,
    }
  } catch (e) {
    console.error('ABI load failed; falling back to minimal ABIs:', e)
    // Minimal fallbacks (enough for read + basic tx)
    return {
      fill: [
        'function createPool1(string name,string theme,string[] parts,string word,string username,uint256 entryFee,uint256 duration,uint256 blankIndex) payable',
        'function joinPool1(uint256 poolId,string word,string username,uint256 blankIndex) payable',
        'function getPool1Info(uint256 poolId) view returns (string,string,string[],uint256,uint256,address,address[],address,uint256,uint256)',
        'function pool1Count() view returns (uint256)',
        'function claimPool1(uint256 poolId)',
        'event Pool1Created(uint256 indexed id,address indexed creator,string name)',
      ],
      nft: [
        'function totalSupply() view returns (uint256)',
        'function ownerOf(uint256 tokenId) view returns (address)',
        'function balanceOf(address owner) view returns (uint256)',
        'function tokenURI(uint256 tokenId) view returns (string)',
      ],
    }
  }
}

// ---------- main hook ----------
export function useContracts() {
  const { address, isConnected } = useMiniWallet()

  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [contracts, setContracts] = useState(null)
  const [abis, setAbis] = useState(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load ABIs once (client)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const a = await loadABIs()
      if (!cancelled) setAbis(a)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Init provider/signer + contracts
  useEffect(() => {
    if (!abis) return
    let cancelled = false

    ;(async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Read-only JSON-RPC provider (always available)
        const readProvider = new ethers.JsonRpcProvider(BASE_RPC)
        if (!cancelled) setProvider(readProvider)

        let nextSigner = null

        // If user is connected and has an injected/mini provider, get a signer
        if (isConnected && typeof window !== 'undefined' && window.ethereum) {
          try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum)
            const net = await browserProvider.getNetwork().catch(() => null)
            if (net && Number(net.chainId) !== CHAIN_ID) {
              // try to switch silently; if it fails, continue read-only
              try {
                await window.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
                })
              } catch (_) {
                /* noop */
              }
            }
            nextSigner = await browserProvider.getSigner().catch(() => null)
          } catch (e) {
            console.warn('Signer init failed (continuing read-only):', e)
          }
        }

        const contractProvider = nextSigner || readProvider

        const fillInStory = new ethers.Contract(
          FILLIN_ADDRESS,
          abis.fill,
          contractProvider
        )

        const madFillNFT = new ethers.Contract(
          NFT_ADDRESS,
          abis.nft,
          contractProvider
        )

        if (!cancelled) {
          setSigner(nextSigner)
          setContracts({ fillInStory, madFillNFT })
        }
      } catch (e) {
        console.error('Contracts init failed:', e)
        if (!cancelled) setError(e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [abis, isConnected])

  // ---------- shared error surface ----------
  const handleContractError = useCallback((err, op) => {
    console.error(`${op} failed:`, err)
    let msg = 'Transaction failed'
    if (err?.shortMessage) msg = err.shortMessage
    else if (err?.reason) msg = err.reason
    else if (err?.data?.message) msg = err.data.message
    else if (err?.message) msg = err.message
    throw new Error(msg)
  }, [])

  // ---------- reads ----------
  const getPool1Info = useCallback(
    async (poolId) => {
      if (!contracts?.fillInStory) throw new Error('Contracts not ready')
      try {
        const info = await contracts.fillInStory.getPool1Info(BigInt(poolId))
        // V3 layout (using named OR index fallback)
        return {
          name: info.name_ ?? info[0],
          theme: info.theme_ ?? info[1],
          parts: info.parts_ ?? info[2],
          feeBase: info.feeBase_ ?? info[3], // on-chain base fee (wei)
          deadline: Number(info.deadline_ ?? info[4]),
          creator: info.creator_ ?? info[5],
          participants: info.participants_ ?? info[6],
          winner: info.winner_ ?? info[7],
          claimed: Boolean(info.claimed_ ?? info[8]),
          poolBalance: info.poolBalance_ ?? info[9],
        }
      } catch (e) {
        handleContractError(e, 'Get Pool1 Info')
      }
    },
    [contracts?.fillInStory, handleContractError]
  )

  const getPool1Count = useCallback(async () => {
    if (!contracts?.fillInStory) throw new Error('Contracts not ready')
    try {
      const n = await contracts.fillInStory.pool1Count()
      return Number(n)
