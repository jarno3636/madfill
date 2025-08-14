// pages/myo.jsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { ethers } from 'ethers';
import { useWindowSize } from 'react-use';

import Layout from '@/components/Layout';
import SEO from '@/components/SEO';
import { absoluteUrl, buildOgUrl } from '@/lib/seo';
import { useMiniWallet } from '@/hooks/useMiniWallet';
import { useMiniAppReady } from '@/hooks/useMiniAppReady';
import { useToast } from '@/components/Toast';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Client-only confetti
const Confetti = dynamic(() => import('react-confetti'), { ssr: false });

// ---- Chain / Contract ----
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';
const BASE_CHAIN_ID = 8453n;
const BASE_CHAIN_ID_HEX = '0x2105';
const TEMPLATE_ADDR =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442'; // fallback

// Minimal ABI used on this page
const ABI = [
  { inputs: [], name: 'MAX_PARTS', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_PART_BYTES', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_TOTAL_BYTES', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getMintPriceWei', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'theme', type: 'string' },
      { name: 'parts', type: 'string[]' },
    ],
    name: 'mintTemplate',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

// ---------- helpers ----------
const utf8BytesLen = (str) => new TextEncoder().encode(str || '').length;

// Split a single “composer” line by [[blank]] markers into contract parts[].
// Example: "The [[blank]] fox jumps over the [[blank]] dog"
// -> ["The ", " fox jumps over the ", " dog"]  (blanks = parts.length-1)
function splitIntoPartsByBlanks(input) {
  if (!input) return [''];
  return String(input).split(/\[\[blank\]\]/g);
}

function countBlanks(parts) {
  return Math.max(0, (parts?.length || 0) - 1);
}

// UI: pretty preview replacing blanks with slots
function renderPreview(parts) {
  const n = parts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(parts[i] || '');
    if (i < n - 1) {
      out.push(' ');
      out.push('[  ______  ]');
      out.push(' ');
    }
  }
  return out.join('');
}

const backgrounds = [
  { key: 'midnight', cls: 'from-slate-900 via-indigo-900 to-violet-900' },
  { key: 'sunset', cls: 'from-pink-600 via-fuchsia-700 to-purple-800' },
  { key: 'ocean', cls: 'from-cyan-700 via-sky-700 to-indigo-800' },
  { key: 'matrix', cls: 'from-emerald-800 via-teal-800 to-slate-900' },
];

export default function MYO() {
  useMiniAppReady();
  const { addToast } = useToast();
  const { address, isConnected, connect, isLoading: walletLoading } = useMiniWallet();
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimer = useRef(null);

  // Network observe + switch
  const [isOnBase, setIsOnBase] = useState(true);

  // Form (simplified + more intuitive)
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');
  const [composer, setComposer] = useState(''); // one text area with [[blank]] markers
  const [bgKey, setBgKey] = useState('midnight');

  // Limits & price
  const [maxParts, setMaxParts] = useState(16);
  const [maxPartBytes, setMaxPartBytes] = useState(256);
  const [maxTotalBytes, setMaxTotalBytes] = useState(2048);
  const [mintPriceWei, setMintPriceWei] = useState(0n);
  const [usdApprox, setUsdApprox] = useState(null);

  // Derived
  const parts = useMemo(() => splitIntoPartsByBlanks(composer).map((p) => p.replace(/\s+/g, ' ')), [composer]);
  const blanks = useMemo(() => countBlanks(parts), [parts]);
  const totalBytes = useMemo(
    () => utf8BytesLen(title) + utf8BytesLen(theme) + utf8BytesLen(description) + parts.reduce((s, p) => s + utf8BytesLen(p), 0),
    [title, theme, description, parts]
  );
  const mintPriceEth = useMemo(() => Number(ethers.formatEther(mintPriceWei || 0n)), [mintPriceWei]);

  // Observe chain (browser only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prov = (typeof window !== 'undefined' && window.ethereum) || null;
        if (prov) {
          const provider = new ethers.BrowserProvider(prov);
          try {
            const net = await provider.getNetwork();
            if (!cancelled) setIsOnBase(net?.chainId === BASE_CHAIN_ID);
          } catch {
            if (!cancelled) setIsOnBase(true);
          }
          const onChain = () => location.reload();
          prov.on?.('chainChanged', onChain);
          return () => prov.removeListener?.('chainChanged', onChain);
        } else {
          if (!cancelled) setIsOnBase(true);
        }
      } catch {
        if (!cancelled) setIsOnBase(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const switchToBase = useCallback(async () => {
    const prov = (typeof window !== 'undefined' && window.ethereum) || null;
    if (!prov) {
      addToast({ type: 'error', title: 'No Wallet', message: 'No wallet provider found.' });
      return;
    }
    try {
      await prov.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] });
      setIsOnBase(true);
    } catch (e) {
      if (e?.code === 4902) {
        try {
          await prov.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: BASE_CHAIN_ID_HEX,
                chainName: 'Base',
                rpcUrls: [BASE_RPC],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          });
          setIsOnBase(true);
        } catch {
          addToast({ type: 'error', title: 'Switch Failed', message: 'Could not add/switch to Base.' });
        }
      } else {
        addToast({ type: 'error', title: 'Switch Failed', message: e?.message || 'Could not switch to Base.' });
      }
    }
  }, [addToast]);

  // Read on-chain limits + price
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!TEMPLATE_ADDR) return;
        const provider = new ethers.JsonRpcProvider(BASE_RPC);
        const ct = new ethers.Contract(TEMPLATE_ADDR, ABI, provider);
        const [mp, mpb, mtb, price] = await Promise.all([
          ct.MAX_PARTS().catch(() => 16n),
          ct.MAX_PART_BYTES().catch(() => 256n),
          ct.MAX_TOTAL_BYTES().catch(() => 2048n),
          ct.getMintPriceWei().catch(() => 0n),
        ]);
        if (cancelled) return;
        setMaxParts(Number(mp));
        setMaxPartBytes(Number(mpb));
        setMaxTotalBytes(Number(mtb));
        setMintPriceWei(BigInt(price || 0n));
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // USD approx
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (mintPriceWei === 0n) {
        setUsdApprox(null);
        return;
      }
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const j = await r.json();
        const ethUsd = Number(j?.ethereum?.usd || 0);
        if (!aborted && ethUsd > 0) {
          const eth = Number(ethers.formatEther(mintPriceWei));
          setUsdApprox(eth * ethUsd);
        }
      } catch {
        setUsdApprox(null);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [mintPriceWei]);

  // Insert [[blank]] at cursor
  const textAreaRef = useRef(null);
  const insertBlankAtCursor = useCallback(() => {
    const el = textAreaRef.current;
    if (!el) {
      setComposer((s) => (s || '') + '[[blank]]');
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const next = `${before}[[blank]]${after}`;
    setComposer(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + '[[blank]]'.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  // Validate form
  const validate = () => {
    const errs = [];
    if (!title.trim()) errs.push('Add a title.');
    if (!theme.trim()) errs.push('Add a theme.');
    if (!description.trim()) errs.push('Add a short description.');
    if (parts.length < 2) errs.push('Add at least one [[blank]] to your template.');
    if (parts.length > maxParts) errs.push(`Too many blanks: maximum parts is ${maxParts} (blanks = parts-1).`);
    if (parts.some((p) => utf8BytesLen(p) > maxPartBytes)) errs.push(`Each fixed segment must be ≤ ${maxPartBytes} bytes.`);
    if (totalBytes > maxTotalBytes) errs.push(`Template too large: ≤ ${maxTotalBytes} bytes total.`);
    if (!mintPriceWei || mintPriceWei === 0n) errs.push('On-chain mint price unavailable. Try again in a moment.');
    return errs;
  };

  // Estimate gas & check funds
  const checkFundsAndEstimate = async (signer, ct, value) => {
    const addr = await signer.getAddress();
    const balance = await signer.provider.getBalance(addr);
    let gasCost = 0n;
    try {
      const gas = await ct.mintTemplate.estimateGas(
        String(title).slice(0, 128),
        String(description).slice(0, 2048),
        String(theme).slice(0, 128),
        parts,
        { value }
      );
      const feeData = await signer.provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? 0n;
      gasCost = gas * gasPrice;
    } catch {
      // fallback: 200k gas at current price
      const feeData = await signer.provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? 0n;
      gasCost = 200_000n * gasPrice;
    }

    const needed = value + gasCost;
    if (balance < needed) {
      const shortEth = Number(ethers.formatEther(needed - balance));
      throw new Error(
        `Insufficient funds: need ~${shortEth.toFixed(6)} ETH more (mint + gas).`
      );
    }
  };

  const [isMinting, setIsMinting] = useState(false);

  const handleMint = async () => {
    const errs = validate();
    if (errs.length) {
      addToast({ type: 'error', title: 'Fix the following', message: errs.join(' ') });
      return;
    }

    try {
      if (!isConnected) {
        addToast({ type: 'error', title: 'Wallet required', message: 'Connect your wallet to mint.' });
        return;
      }

      setIsMinting(true);

      const prov = (typeof window !== 'undefined' && window.ethereum) || null;
      if (!prov) throw new Error('No wallet provider found');
      await prov.request?.({ method: 'eth_requestAccounts' });

      const browserProvider = new ethers.BrowserProvider(prov);
      const net = await browserProvider.getNetwork();
      if (net?.chainId !== BASE_CHAIN_ID) await switchToBase();

      const signer = await browserProvider.getSigner();
      const ct = new ethers.Contract(TEMPLATE_ADDR, ABI, signer);

      // Trust contract price; refresh in case it changed
      const onChainPrice = await ct.getMintPriceWei().catch(() => mintPriceWei);
      const value = BigInt(onChainPrice || mintPriceWei || 0n);

      // Funds check (includes gas)
      await checkFundsAndEstimate(signer, ct, value);

      const tx = await ct.mintTemplate(
        String(title).slice(0, 128),
        String(description).slice(0, 2048),
        String(theme).slice(0, 128),
        parts,
        { value }
      );
      await tx.wait();

      addToast({ type: 'success', title: 'Minted 🎉', message: 'Your template NFT was minted successfully.' });
      setShowConfetti(true);
      clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setShowConfetti(false), 1800);

      // Reset composer but keep cosmetic selections
      setTitle('');
      setTheme('');
      setDescription('');
      setComposer('');
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Mint failed',
        message: e?.shortMessage || e?.reason || e?.message || 'Transaction failed.',
      });
      setShowConfetti(false);
    } finally {
      setIsMinting(false);
    }
  };

  useEffect(() => () => clearTimeout(confettiTimer.current), []);

  // ---- SEO / Farcaster ----
  const pageUrl = absoluteUrl('/myo');
  const ogImage = buildOgUrl({ screen: 'myo', title: 'Make Your Own' });

  const bgCls = useMemo(
    () => backgrounds.find((b) => b.key === bgKey)?.cls || backgrounds[0].cls,
    [bgKey]
  );

  // ---------- UI ----------
  return (
    <Layout>
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Create Template" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <SEO
        title="Make Your Own Templates — MadFill"
        description="Type your prompt, drop [[blank]] wherever players will fill in. Mint as an NFT on Base."
        url={pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      <div className={`min-h-screen bg-gradient-to-br ${bgCls}`}>
        {/* Header */}
        <div className="relative py-14 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="text-7xl mb-4">🎨</div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">Make Your Own Template</h1>
            <p className="text-purple-100 mt-3">
              Type your story and insert <code className="px-1.5 py-0.5 rounded bg-white/10">[[blank]]</code> anywhere you want a blank.
              Words you leave in place become fixed. At least one blank is required.
            </p>

            <div className="mt-5 text-purple-100 text-sm">
              Mint price (from contract):{' '}
              <span className="font-semibold text-white">
                {mintPriceWei === 0n ? '—' : `${mintPriceEth.toFixed(5)} ETH`}
              </span>
              {usdApprox != null && <span className="ml-1 opacity-80">(~${usdApprox.toFixed(2)} USD)</span>}
            </div>

            {!isConnected ? (
              <div className="mt-6">
                <Button
                  onClick={connect}
                  disabled={walletLoading}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold px-6 py-3 rounded-lg"
                >
                  {walletLoading ? 'Connecting…' : 'Connect Wallet'}
                </Button>
              </div>
            ) : (
              <div className="mt-6 inline-flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
                <span className="opacity-80">Connected</span>
                <span className="font-mono bg-black/30 px-2 py-1 rounded">
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </span>
                {!isOnBase && (
                  <Button onClick={switchToBase} className="bg-cyan-600 hover:bg-cyan-500 h-8 px-3 text-sm">
                    Switch to Base
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader>
              <h2 className="text-2xl md:text-3xl font-bold text-white text-center">Compose &amp; Mint</h2>
            </CardHeader>

            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left: Inputs */}
                <div className="lg:col-span-3 space-y-5">
                  <div>
                    <label className="block text-white text-sm font-medium mb-1">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., The Great Adventure"
                      className="w-full px-4 py-2.5 rounded-lg bg-white/15 text-white placeholder-purple-200 border border-white/20 focus:border-yellow-400 focus:outline-none"
                    />
                    <div className="text-xs text-purple-200 mt-1">{utf8BytesLen(title)} bytes</div>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1">Theme</label>
                    <input
                      type="text"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      placeholder="e.g., Space Adventure"
                      className="w-full px-4 py-2.5 rounded-lg bg-white/15 text-white placeholder-purple-200 border border-white/20 focus:border-yellow-400 focus:outline-none"
                    />
                    <div className="text-xs text-purple-200 mt-1">{utf8BytesLen(theme)} bytes</div>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your template for NFT metadata"
                      className="w-full px-4 py-3 rounded-lg bg-white/15 text-white placeholder-purple-200 border border-white/20 focus:border-yellow-400 focus:outline-none h-24 resize-none"
                    />
                    <div className="text-xs text-purple-200 mt-1">{utf8BytesLen(description)} bytes</div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-white text-sm font-medium">Story Composer</label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={insertBlankAtCursor}
                          className="bg-fuchsia-600 hover:bg-fuchsia-500 h-8 px-3 text-sm"
                          title="Insert [[blank]] at cursor"
                        >
                          + [[blank]]
                        </Button>
                        <span className="text-xs text-purple-100">Blanks: {blanks}</span>
                      </div>
                    </div>
                    <textarea
                      ref={textAreaRef}
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      placeholder="Type your story and insert [[blank]] where players will fill in…"
                      className="mt-2 w-full px-4 py-3 rounded-lg bg-white/15 text-white placeholder-purple-200 border border-white/20 focus:border-yellow-400 focus:outline-none min-h-[140px]"
                    />
                    <div className="text-xs text-purple-200 mt-1">
                      Total payload bytes (title + theme + description + parts): <b>{totalBytes}</b> / {maxTotalBytes}
                    </div>
                    <div className="text-xs text-purple-200 mt-1">
                      Tip: To reduce blanks, replace <code className="bg-white/10 px-1 rounded">[[blank]]</code> with your own word.
                    </div>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1">Preview Background</label>
                    <div className="flex flex-wrap gap-2">
                      {backgrounds.map((b) => (
                        <button
                          key={b.key}
                          type="button"
                          onClick={() => setBgKey(b.key)}
                          className={`h-9 px-3 rounded-lg border ${
                            bgKey === b.key ? 'border-yellow-400' : 'border-white/20'
                          } bg-gradient-to-br ${b.cls} text-white text-sm`}
                          aria-pressed={bgKey === b.key}
                          title={b.key}
                        >
                          {b.key}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Preview + Mint */}
                <div className="lg:col-span-2 space-y-5">
                  <h3 className="text-white font-semibold">Preview</h3>
                  <div className={`rounded-2xl border border-white/20 p-5 bg-gradient-to-br ${bgCls}`}>
                    <div className="bg-black/40 rounded-xl p-4 ring-1 ring-white/10">
                      <div className="text-white font-bold text-lg">{title || 'Your Template'}</div>
                      <div className="text-purple-200 text-sm">{theme || 'Theme'}</div>
                      <div className="mt-3 text-purple-100 leading-relaxed break-words">
                        {renderPreview(parts) || 'Type your story and add [[blank]]…'}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleMint}
                    disabled={
                      isMinting ||
                      !isConnected ||
                      !title.trim() ||
                      !theme.trim() ||
                      !description.trim() ||
                      parts.length < 2 ||
                      !mintPriceWei
                    }
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
                    type="button"
                  >
                    {isMinting
                      ? 'Minting…'
                      : `Mint NFT Template (${mintPriceWei ? `${mintPriceEth.toFixed(5)} ETH` : '—'}${
                          usdApprox != null ? ` ~ $${usdApprox.toFixed(2)}` : ''
                        })`}
                  </Button>

                  {!isConnected && (
                    <p className="text-yellow-300/90 text-xs text-center">Connect your wallet to mint.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ / Help inline */}
          <div className="mt-6 text-purple-100/90 text-sm space-y-2">
            <div>• <b>How do I leave a blank?</b> Insert <code className="bg-white/10 px-1 rounded">[[blank]]</code> anywhere in your sentence.</div>
            <div>• <b>Can I pre-fill some words?</b> Yes — just type them normally. Only the <code className="bg-white/10 px-1 rounded">[[blank]]</code> spots become fill-ins.</div>
            <div>• <b>Why did it say “needed a blank”?</b> The contract requires at least one blank (parts ≥ 2). Add one <code className="bg-white/10 px-1 rounded">[[blank]]</code>.</div>
            <div>• <b>Insufficient funds?</b> We check mint price + an estimated gas cost. Add a little more ETH on Base and retry.</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
