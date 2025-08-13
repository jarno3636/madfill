// pages/profile.jsx
'use client'

import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useWindowSize } from 'react-use'
import dynamic from 'next/dynamic'
import { ethers } from 'ethers'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniWallet } from '@/hooks/useMiniWallet'
import { useContracts } from '@/hooks/useContracts'
import { useUserPreferences, useStoryDrafts } from '@/hooks/useLocalStorage'
import { useToast } from '@/components/Toast'
import { useNotifications } from '@/hooks/useNotifications'
import LoadingSpinner from '@/components/LoadingSpinner'
import ChainSwitcher from '@/components/ChainSwitcher'
import { formatAddress } from '@/lib/validation'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

// ---------- chain/env ----------
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442'

// Minimal ABI slice we actually use on this page (ownerOf, totalSupply, tokenURI, balanceOf)
const TEMPLATE_ABI = [
  { inputs:[{ internalType:'uint256', name:'tokenId', type:'uint256' }], name:'ownerOf', outputs:[{ internalType:'address', name:'', type:'address' }], stateMutability:'view', type:'function' },
  { inputs:[], name:'totalSupply', outputs:[{ internalType:'uint256', name:'', type:'uint256' }], stateMutability:'view', type:'function' },
  { inputs:[{ internalType:'uint256', name:'tokenId', type:'uint256' }], name:'tokenURI', outputs:[{ internalType:'string', name:'', type:'string' }], stateMutability:'view', type:'function' },
  { inputs:[{ internalType:'address', name:'owner', type:'address' }], name:'balanceOf', outputs:[{ internalType:'uint256', name:'', type:'uint256' }], stateMutability:'view', type:'function' }
]

// hard cap so we don't brute force huge collections in browser
const NFT_SCAN_CAP = Number(process.env.NEXT_PUBLIC_NFT_SCAN_CAP || 500)

export default function Profile() {
  useMiniAppReady()

  const router = useRouter()
  const { address, isConnected, disconnect } = useMiniWallet()
  const { contracts, getUserNFTs } = useContracts() || {}

  const { preferences, updatePreference, resetPreferences } = useUserPreferences()
  const { drafts, clearAllDrafts } = useStoryDrafts()
  const { addToast } = useToast()
  const { permission, requestPermission, isSupported } = useNotifications()

  const [userStats, setUserStats] = useState(null)
  const [userNFTs, setUserNFTs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('stats')
  const [showConfetti, setShowConfetti] = useState(false)

  const { width, height } = useWindowSize()

  // ----- SEO / Frames -----
  const pageUrl = absoluteUrl('/profile')
  const ogImage = buildOgUrl({ screen: 'profile', user: address ? formatAddress(address) : 'anon' })

  // ----- data loads -----
  useEffect(() => {
    if (isConnected && address) {
      loadUserData()
    } else {
      setLoading(false)
    }
  }, [isConnected, address, contracts])

  // Fallback NFT fetch if hook cannot supply
  const fetchUserNftsDirect = async (userAddr) => {
    try {
      if (!NFT_ADDRESS || !ethers.isAddress(NFT_ADDRESS)) return []
      const provider = new ethers.JsonRpcProvider(BASE_RPC)
      const nft = new ethers.Contract(NFT_ADDRESS, TEMPLATE_ABI, provider)

      const totalSupply = Number(await nft.totalSupply().catch(() => 0n))
      if (!Number.isFinite(totalSupply) || totalSupply <= 0) return []

      const bal = Number(await nft.balanceOf(userAddr).catch(() => 0n))
      if (bal === 0) return []

      // Brute force scan up to caps; in production you’d index off-chain
      const maxScan = Math.min(totalSupply, NFT_SCAN_CAP)
      const owned = []
      for (let tokenId = 1; tokenId <= maxScan; tokenId++) {
        // small yield
        /* eslint-disable no-await-in-loop */
        try {
          const owner = await nft.ownerOf(tokenId)
          if (owner && owner.toLowerCase() === userAddr.toLowerCase()) {
            owned.push(tokenId)
            if (owned.length >= bal) break
          }
        } catch {
          // gaps are OK
        }
      }
      return owned
    } catch {
      return []
    }
  }

  const loadUserData = async () => {
    try {
      setLoading(true)

      // TODO: Replace mock stats with on-chain/DB stats when available
      const mockStats = {
        storiesCreated: 5,
        storiesContributed: 23,
        nftsMinted: 3,
        totalEarnings: '1.25',
        joinDate: '2024-01-15',
        rank: 42,
        favoriteTheme: 'Space Adventure'
      }
      setUserStats(mockStats)

      // Prefer hook… fallback to direct read using the provided NFT contract+ABI
      let ids = []
      try {
        if (getUserNFTs) {
          ids = await getUserNFTs()
        }
      } catch { /* ignore and fallback */ }

      if (!ids || ids.length === 0) {
        ids = await fetchUserNftsDirect(address)
      }

      setUserNFTs(ids || [])
    } catch (error) {
      console.error('Error loading user data:', error)
      addToast('Failed to load profile data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ----- actions -----
  const triggerConfetti = () => {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 1500)
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      addToast('Wallet disconnected', 'info')
      router.push('/')
    } catch (error) {
      console.error('Error disconnecting:', error)
      addToast('Failed to disconnect wallet', 'error')
    }
  }

  const handleNotificationToggle = async () => {
    if (permission === 'granted') {
      const next = !preferences.notifications
      updatePreference('notifications', next)
      addToast(next ? 'Notifications enabled' : 'Notifications disabled', 'info')
      if (next) triggerConfetti()
    } else {
      const granted = await requestPermission()
      if (granted) {
        updatePreference('notifications', true)
        addToast('Notifications enabled', 'info')
        triggerConfetti()
      }
    }
  }

  const handleClearDrafts = () => {
    if (typeof window !== 'undefined' && window.confirm('Clear all story drafts? This cannot be undone.')) {
      clearAllDrafts()
      addToast('All drafts cleared', 'success')
      triggerConfetti()
    }
  }

  const handleResetPreferences = () => {
    if (typeof window !== 'undefined' && window.confirm('Reset preferences to default?')) {
      resetPreferences()
      addToast('Preferences reset to default', 'success')
    }
  }

  if (!isConnected) {
    return (
      <Layout>
        <SEO
          title="Profile — MadFill"
          description="Connect your wallet to view your MadFill profile, NFTs, drafts and preferences."
          url={pageUrl}
          image={ogImage}
        />
        <Head>
          {/* Farcaster Frame meta */}
          <meta name="fc:frame" content="vNext" />
          <meta name="fc:frame:image" content={ogImage} />
          <meta name="fc:frame:button:1" content="Open Profile" />
          <meta name="fc:frame:button:1:action" content="link" />
          <meta name="fc:frame:button:1:target" content={pageUrl} />
          <link rel="canonical" href={pageUrl} />
        </Head>

        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
          <div className="card text-center max-w-md">
            <h1 className="text-2xl font-bold text-white mb-4">Profile</h1>
            <p className="text-purple-200 mb-6">
              Please connect your wallet to view your profile
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <SEO
        title="Profile — MadFill"
        description="View your MadFill stats, NFTs, drafts and preferences."
        url={pageUrl}
        image={ogImage}
      />

      <Head>
        {/* Farcaster Frame / Mini App meta */}
        <meta name="fc:frame" content="vNext" />
        <meta name="fc:frame:image" content={ogImage} />
        <meta name="fc:frame:button:1" content="Open Profile" />
        <meta name="fc:frame:button:1:action" content="link" />
        <meta name="fc:frame:button:1:target" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      {showConfetti && <Confetti width={width} height={height} />}

      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push('/')}
              className="text-purple-200 hover:text-white transition-colors"
              aria-label="Back to home"
            >
              ← Back to Home
            </button>

            <button
              onClick={handleDisconnect}
              className="text-red-400 hover:text-red-300 transition-colors"
              aria-label="Disconnect wallet"
            >
              Disconnect Wallet
            </button>
          </div>

          {/* Profile Header */}
          <div className="card mb-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {formatAddress(address)[2].toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Your Profile</h1>
                <p className="text-purple-200">{formatAddress(address)}</p>
                {userStats && (
                  <p className="text-yellow-400 text-sm">
                    Rank #{userStats.rank} • Joined {new Date(userStats.joinDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Chain Switcher */}
            <ChainSwitcher className="mb-4" />
          </div>

          {/* Navigation Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1">
              {[
                { key: 'stats', label: '📊 Stats' },
                { key: 'nfts', label: '🎨 My NFTs' },
                { key: 'drafts', label: '📝 Drafts' },
                { key: 'settings', label: '⚙️ Settings' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-2 rounded-md transition-all ${
                    activeTab === tab.key
                      ? 'bg-yellow-500 text-black font-semibold'
                      : 'text-white hover:bg-white/10'
                  }`}
                  aria-pressed={activeTab === tab.key}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center">
              <LoadingSpinner size="xl" text="Loading profile..." />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {/* Stats Tab */}
              {activeTab === 'stats' && userStats && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="card text-center">
                    <div className="text-3xl mb-2">📖</div>
                    <h3 className="text-xl font-bold text-white mb-2">Stories Created</h3>
                    <p className="text-3xl text-yellow-400 font-bold">{userStats.storiesCreated}</p>
                  </div>

                  <div className="card text-center">
                    <div className="text-3xl mb-2">✍️</div>
                    <h3 className="text-xl font-bold text-white mb-2">Contributions</h3>
                    <p className="text-3xl text-yellow-400 font-bold">{userStats.storiesContributed}</p>
                  </div>

                  <div className="card text-center">
                    <div className="text-3xl mb-2">🎨</div>
                    <h3 className="text-xl font-bold text-white mb-2">NFTs Minted</h3>
                    <p className="text-3xl text-yellow-400 font-bold">
                      {(userNFTs?.length || 0)}
                    </p>
                  </div>

                  <div className="card text-center">
                    <div className="text-3xl mb-2">💰</div>
                    <h3 className="text-xl font-bold text-white mb-2">Total Earnings</h3>
                    <p className="text-3xl text-yellow-400 font-bold">{userStats.totalEarnings} ETH</p>
                  </div>

                  <div className="card text-center">
                    <div className="text-3xl mb-2">🏆</div>
                    <h3 className="text-xl font-bold text-white mb-2">Current Rank</h3>
                    <p className="text-3xl text-yellow-400 font-bold">#{userStats.rank}</p>
                  </div>

                  <div className="card text-center">
                    <div className="text-3xl mb-2">🎭</div>
                    <h3 className="text-xl font-bold text-white mb-2">Favorite Theme</h3>
                    <p className="text-lg text-yellow-400 font-bold">{userStats.favoriteTheme}</p>
                  </div>
                </div>
              )}

              {/* NFTs Tab */}
              {activeTab === 'nfts' && (
                <div className="card">
                  <h2 className="text-2xl font-bold text-white mb-6">Your Story NFTs</h2>

                  {userNFTs.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">🎨</div>
                      <h3 className="text-xl font-bold text-white mb-2">No NFTs Yet</h3>
                      <p className="text-purple-200 mb-6">
                        Create and complete stories to mint your first NFT!
                      </p>
                      <button
                        onClick={() => router.push('/')}
                        className="btn-primary"
                      >
                        Create Your First Story
                      </button>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-6">
                      {userNFTs.map((nftId) => (
                        <div
                          key={nftId}
                          onClick={() => router.push(`/nft/${nftId}`)}
                          className="card-hover cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/nft/${nftId}`) }}
                          aria-label={`Open NFT ${nftId}`}
                        >
                          <div className="aspect-square bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg mb-4 flex items-center justify-center">
                            <span className="text-white text-2xl font-bold">#{nftId}</span>
                          </div>
                          <h3 className="text-white font-semibold">Story NFT #{nftId}</h3>
                          <p className="text-purple-200 text-sm">Collaborative Story</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Drafts Tab */}
              {activeTab === 'drafts' && (
                <div className="card">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Story Drafts</h2>
                    {drafts.length > 0 && (
                      <button
                        onClick={handleClearDrafts}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        Clear All Drafts
                      </button>
                    )}
                  </div>

                  {drafts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📝</div>
                      <h3 className="text-xl font-bold text-white mb-2">No Drafts Saved</h3>
                      <p className="text-purple-200">
                        Your story drafts will appear here automatically as you create them
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {drafts.map((draft) => (
                        <div key={draft.id} className="bg-white/10 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-white font-semibold">{draft.theme}</h3>
                            <span className="text-purple-200 text-sm">
                              {new Date(draft.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-purple-200 text-sm mb-3">
                            Entry Fee: {draft.entryFee} ETH
                          </p>
                          <button
                            onClick={() => router.push('/?loadDraft=' + draft.id)}
                            className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm"
                          >
                            Load Draft →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="card">
                  <h2 className="text-2xl font-bold text-white mb-6">Preferences</h2>

                  <div className="space-y-6">
                    {/* Notifications */}
                    <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                      <div>
                        <h3 className="text-white font-medium">Browser Notifications</h3>
                        <p className="text-purple-200 text-sm">
                          Get notified about story updates and new contributions
                        </p>
                      </div>
                      <button
                        onClick={handleNotificationToggle}
                        disabled={!isSupported}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          preferences.notifications && permission === 'granted'
                            ? 'bg-green-500 text-black'
                            : 'bg-gray-500 text-white'
                        } disabled:opacity-50`}
                        aria-disabled={!isSupported}
                      >
                        {!isSupported ? 'Not Supported' :
                          permission === 'granted' && preferences.notifications ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    {/* Default Entry Fee (local pref only) */}
                    <div className="p-4 bg-white/10 rounded-lg">
                      <h3 className="text-white font-medium mb-2">Default Entry Fee</h3>
                      <input
                        type="number"
                        step="0.001"
                        value={preferences.defaultEntryFee}
                        onChange={(e) => updatePreference('defaultEntryFee', e.target.value)}
                        className="input-primary w-32"
                        aria-label="Default entry fee"
                      />
                      <p className="text-purple-200 text-sm mt-1">
                        Your preferred entry fee for new story pools
                      </p>
                    </div>

                    {/* Auto Connect */}
                    <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                      <div>
                        <h3 className="text-white font-medium">Auto Connect Wallet</h3>
                        <p className="text-purple-200 text-sm">
                          Automatically connect your wallet when visiting the app
                        </p>
                      </div>
                      <button
                        onClick={() => updatePreference('autoConnect', !preferences.autoConnect)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          preferences.autoConnect
                            ? 'bg-green-500 text-black'
                            : 'bg-gray-500 text-white'
                        }`}
                        aria-pressed={Boolean(preferences.autoConnect)}
                      >
                        {preferences.autoConnect ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    {/* Reset Button */}
                    <div className="pt-4 border-t border-white/20">
                      <button
                        onClick={handleResetPreferences}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        Reset All Preferences to Default
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
