# MadFill - Farcaster Mini App

# MadFill – Farcaster Mini App + Web Game

MadFill is a **social, on-chain word game** that blends **Mad Libs-style storytelling** with **crypto prize pools** and **NFT collectibles**, playable both inside **Farcaster** as a Mini App and on the open web.

---

## 🎯 What is MadFill?
MadFill lets players **fill in the blanks** of a story template and compete for **prizes on Base**.  
It has two main gameplay modes plus a template minting system:

### 1. Pool 1 – Paid Round Creation & Play
- Create a **MadFill round** (sentence/story template with blanks).
- Set an **entry fee** (in BASE) and a duration.
- Players **pay to submit words**.
- **Random winner** chosen from all entrants at the end.
- Winner **claims the pooled prize** on-chain.

### 2. Pool 2 – Community Challenges & Voting
- Challenge an **existing winning card** with your own twist.
- Community votes (small BASE fee per vote).
- Winning side’s voters get **randomly chosen prize distribution**.

### 3. MyO – Make Your Own Templates
- Mint your own **MadFill Template NFTs** via the `MadFillTemplateNFT` contract.
- Templates can be reused, remixed, and shared.
- Collectible & tradable on-chain.

---

## 🚀 Core Features
- Fully **on-chain gameplay** using the `FillInStoryV3` contract.
- **Farcaster Mini App** integration for in-app play:
  - Frame metadata for seamless Warpcast experience.
  - Clickable buttons & preview images without leaving the app.
- **Wallet Connect & Network Switching** for Base.
- Live **BASE-USD** pool value updates.
- Premium, fun **visual design** with gradients, animations, and stickers.
- **Social sharing** via Warpcast and Twitter/X.
- Farcaster profile & avatar integration.

---

## 🕹 Game Flow

**Creating a Paid Round (Pool 1)**
1. Select a template & name your round.
2. Set entry fee and duration.
3. Pay BASE to create.
4. Players join by paying fee & submitting words.
5. Winner randomly selected from entrants.

**Community Challenge (Pool 2)**
1. Pick a winning card to challenge.
2. Submit your alternate/funnier entry.
3. Voting opens (BASE fee per vote).
4. Winning side’s voters have a chance to win prizes.

**Minting Templates**
1. Create your own story template.
2. Mint as NFT.
3. Share on Farcaster or web for others to play.

---

## 📱 Farcaster Mini App Integration
MadFill uses Farcaster’s Mini App spec:
- **Manifest** (`.well-known/farcaster.json`) declares app name, icon, splash, and URLs.
- Frame meta tags (`fc:frame`, `fc:frame:image`, etc.) allow in-app play.
- Warpcast share links embed the game’s preview images and buttons.

Example frame flow:
- Player sees **image preview** in cast.
- Clicks **Play Now** → Opens in Mini App view.
- Interacts without leaving Warpcast.

---

## 🛠 Tech Stack
- **Frontend**: Next.js + Tailwind CSS
- **Blockchain**: Solidity (Base network)
- **Wallet**: wagmi + ethers.js
- **Farcaster**: Frames + Mini App manifest
- **Hosting**: Vercel

---

## 📂 Repository Structure

```plaintext
madfill/
├── abi/                      # Smart contract ABIs
│   ├── FillInStoryV3_ABI.json
│   ├── MadFillTemplateNFT_ABI.json
│
├── components/               # Reusable UI components
│   ├── Layout.jsx
│   ├── ShareBar.jsx
│   ├── CompareCards.jsx
│   └── ...
│
├── data/                     # Static data files (templates, categories)
│   ├── templates.js
│
├── lib/                      # Utility functions & API helpers
│   ├── seo.js                # SEO + Farcaster frame helpers
│   ├── neynar.js             # Farcaster API integration
│   ├── price.js              # BASE-USD price fetch
│
├── pages/
│   ├── index.jsx              # Home (create Pool 1 rounds)
│   ├── active.jsx             # Active rounds listing
│   ├── challenge.jsx          # Pool 2 challenge entry
│   ├── vote.jsx               # Voting UI for Pool 2
│   ├── myo.jsx                # MyO minting page
│   ├── myrounds.jsx           # User's rounds and participation
│   ├── round/[id].jsx         # Single round details & claim UI
│   ├── api/                   # API routes for OG images, webhook, etc.
│   │   ├── frame/             # Frame API endpoints for Farcaster
│   │   ├── og.js              # Dynamic OG image generation
│   │   └── webhook.js         # Webhook handling
│
├── public/                    # Static assets
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── og/                    # Farcaster/OG images
│       ├── app-icon-1024.png
│       ├── app-splash-200.png
│       ├── cover-1200x630.jpg
│
├── styles/
│   ├── globals.css            # Tailwind global styles
│
├── .well-known/
│   ├── farcaster.json         # Mini App manifest
│
├── package.json
└── README.md                  # Project documentation

🔗 Useful Links
	•	Live App: https://madfill.vercel.app
	•	Farcaster Mini App Manifest: https://madfill.vercel.app/.well-known/farcaster.json
	•	Contracts:
	•	FillInStoryV3: 0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b
	•	MadFillTemplateNFT: 0x0F22124A86F8893990fA4763393E46d97F4
