# MadFill - Collaborative Storytelling Game

[![Production Ready](https://img.shields.io/badge/Production-Ready-brightgreen.svg)](https://madfill.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black)](https://nextjs.org/)
[![Base Network](https://img.shields.io/badge/Base-L2-blue)](https://base.org/)
[![Farcaster](https://img.shields.io/badge/Farcaster-Mini_App-purple)](https://warpcast.com/)

MadFill is a Farcaster mini-app that combines collaborative storytelling with blockchain gaming. Players participate in Mad Libs-style games where they fill in story templates, challenge existing stories, and collect NFT templates. The application operates on Base Layer 2 blockchain with two main game pools: Pool 1 for story creation and Pool 2 for story challenges, plus an NFT system for template ownership.

## 🚀 Live Application

- **Production URL**: [https://madfill.vercel.app](https://madfill.vercel.app)
- **Farcaster Frame**: Integrated with Warpcast mini-app ecosystem
- **Network**: Base Layer 2 (Chain ID: 8453)

## ✨ Features

### Core Game Mechanics
- **Pool 1**: Collaborative story creation with entry fees and prize distribution
- **Pool 2**: Community voting on story improvements with rewards
- **NFT Templates**: Mintable story templates with dynamic pricing

### Blockchain Integration
- **Smart Contracts**: FillInStoryV3 and MadFillTemplateNFT on Base L2
- **Wallet Support**: MetaMask, Coinbase Wallet, and Farcaster native wallet
- **Real-time Pricing**: Chainlink price feeds for ETH/USD conversion

### Farcaster Native
- **Mini App SDK**: Native integration with Farcaster ecosystem
- **Social Features**: Profile integration and seamless sharing
- **Frame Support**: Interactive frames for social engagement

## 🛠 Technology Stack

### Frontend
- **Framework**: Next.js 14.2.5 with React 18
- **Styling**: Tailwind CSS with custom dark theme
- **UI Components**: Radix UI + shadcn/ui component library
- **State Management**: React hooks + TanStack Query

### Blockchain
- **Network**: Base Layer 2 (Ethereum L2)
- **Smart Contracts**: Solidity with OpenZeppelin standards
- **Web3 Library**: Ethers.js v6
- **Price Feeds**: Chainlink for real-time ETH/USD pricing

### Infrastructure
- **Deployment**: Vercel with automatic deployments
- **Analytics**: Google Analytics + Vercel Analytics
- **Performance**: Built-in monitoring and optimization
- **Testing**: Jest + React Testing Library

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- MetaMask or compatible Web3 wallet
- Base network RPC access

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/jarno3636/madfill.git
cd madfill
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env.local` file:
```bash
cp .env.example .env.local
```

Required environment variables:
```env
# Contract Addresses (Base Mainnet)
NEXT_PUBLIC_FILLIN_ADDRESS=0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b
NEXT_PUBLIC_MADFILL_NFT_ADDRESS=0x0F22124A86F8893990fA4763393E46d97F4AF8E0c

# RPC Configuration
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_CHAIN_ID=8453

# App Configuration
NEXT_PUBLIC_APP_URL=https://madfill.vercel.app
NEXT_PUBLIC_APP_NAME=MadFill
```

Optional API keys:
```env
NEYNAR_API_KEY=your_neynar_api_key_here
NEXT_PUBLIC_GA_ID=your_google_analytics_id
```

### 4. Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Type Checking
```bash
npm run type-check
```

## 🏗 Build & Deployment

### Production Build
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

The application is configured for automatic deployments via GitHub integration.

## 📱 Farcaster Integration

### Manifest Configuration
The app includes a Farcaster manifest at `public/.well-known/farcaster.json` for native integration.

### SDK Features
- Native wallet connection
- User profile integration
- Seamless sharing within Farcaster
- Frame-compatible design

## 🔐 Smart Contract Integration

### Contract Addresses (Base Mainnet)
- **FillInStoryV3**: `0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b`
- **MadFillTemplateNFT**: `0x0F22124A86F8893990fA4763393E46d97F4AF8E0c`

### Key Functions
- `createPool1()`: Create new story rounds
- `joinPool1()`: Join existing rounds
- `claimPool1()`: Claim winnings
- `mintTemplate()`: Create NFT templates

## 📊 Performance & Monitoring

### Built-in Analytics
- Google Analytics integration
- Vercel Analytics for performance
- Error tracking and reporting
- Custom performance monitoring

### Security Features
- Content Security Policy headers
- XSS protection
- Rate limiting for contract calls
- Input validation and sanitization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Community

- **GitHub Issues**: Report bugs and request features
- **Farcaster**: Follow updates on Warpcast
- **Documentation**: Comprehensive guides and API docs

## 🔮 Roadmap

- [ ] Pool 2 challenge system implementation
- [ ] Enhanced NFT marketplace features
- [ ] Multi-language template support
- [ ] Advanced analytics dashboard
- [ ] Mobile app development

---

**Made with ❤️ for the Farcaster and Base communities**