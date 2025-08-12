import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Layout from '../components/Layout';
import { useMiniWallet } from '../hooks/useMiniWallet';
import { useMiniAppReady } from '../hooks/useMiniAppReady';
import { useToast } from '../components/Toast';

export default function MYO() {
  const { isReady } = useMiniAppReady();
  const { address, isConnected, connect, isLoading: walletLoading } = useMiniWallet();
  const { addToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Template creation form state
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateTheme, setTemplateTheme] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Adventure');
  const [storyParts, setStoryParts] = useState(['']);
  const [mintPrice, setMintPrice] = useState('0.01');

  const categories = {
    'Adventure': { emoji: '🗺️', description: 'Epic journeys and quests' },
    'Comedy': { emoji: '😂', description: 'Funny and hilarious stories' },
    'Sci-Fi': { emoji: '🚀', description: 'Future technology and space' },
    'Fantasy': { emoji: '🧙', description: 'Magic and mythical creatures' },
    'Mystery': { emoji: '🔍', description: 'Puzzles and detective stories' }
  };

  const addStoryPart = () => {
    setStoryParts([...storyParts, '']);
  };

  const updateStoryPart = (index, value) => {
    const newParts = [...storyParts];
    newParts[index] = value;
    setStoryParts(newParts);
  };

  const removeStoryPart = (index) => {
    if (storyParts.length > 1) {
      const newParts = storyParts.filter((_, i) => i !== index);
      setStoryParts(newParts);
    }
  };

  const handleMintTemplate = async () => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Required',
        message: 'Please connect your wallet to mint NFT templates'
      });
      return;
    }

    if (!templateTitle || !templateTheme || storyParts.some(part => !part.trim())) {
      addToast({
        type: 'error', 
        title: 'Missing Fields',
        message: 'Please fill in all template fields'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Here you would integrate with your NFT minting contract
      // Simulating the process for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      addToast({
        type: 'success',
        title: 'NFT Minted!',
        message: 'Your template has been successfully minted as an NFT'
      });
      
      // Reset form
      setTemplateTitle('');
      setTemplateTheme('');
      setStoryParts(['']);
      
    } catch (error) {
      console.error('Error minting NFT:', error);
      addToast({
        type: 'error',
        title: 'Minting Failed', 
        message: 'There was an error minting your NFT template'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading MadFill...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        {/* Header */}
        <div className="relative py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-8xl mb-6">🎨</div>
            <h1 className="text-5xl font-bold text-white mb-4">
              Make Your Own Templates
            </h1>
            <p className="text-xl text-purple-200 mb-8">
              Create amazing story templates and mint them as NFTs! Let your creativity inspire others to build epic collaborative stories.
            </p>
            
            {!isConnected && (
              <div className="mb-8">
                <Button
                  onClick={connect}
                  disabled={walletLoading}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3 px-6 rounded-lg"
                >
                  {walletLoading ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              </div>
            )}

            {isConnected && address && (
              <div className="mb-8 bg-green-900/20 p-4 rounded-lg border border-green-500/30 max-w-md mx-auto">
                <p className="text-green-300 text-sm">
                  Connected: {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 pb-20">
          {/* Template Creator */}
          <Card className="bg-white/10 backdrop-blur border-purple-500/30">
            <CardHeader>
              <h2 className="text-3xl font-bold text-white text-center">
                Create Your Template
              </h2>
            </CardHeader>
            
            <CardContent className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Template Form */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Template Title
                    </label>
                    <input
                      type="text"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      placeholder="e.g., The Great Adventure"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Theme
                    </label>
                    <input
                      type="text"
                      value={templateTheme}
                      onChange={(e) => setTemplateTheme(e.target.value)}
                      placeholder="e.g., Space Adventure"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-purple-300 focus:border-yellow-500 focus:outline-none"
                    >
                      {Object.entries(categories).map(([key, category]) => (
                        <option key={key} value={key} className="bg-purple-900 text-white">
                          {category.emoji} {key}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Story Parts
                    </label>
                    <p className="text-purple-200 text-sm mb-3">
                      Each part will be separated by blanks for users to fill
                    </p>
                    {storyParts.map((part, index) => (
                      <div key={index} className="mb-3 flex gap-2">
                        <textarea
                          value={part}
                          onChange={(e) => updateStoryPart(index, e.target.value)}
                          placeholder={`Story part ${index + 1}...`}
                          className="flex-1 px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none h-24 resize-none"
                        />
                        {storyParts.length > 1 && (
                          <Button
                            onClick={() => removeStoryPart(index)}
                            variant="outline"
                            className="px-3 py-1 text-red-300 border-red-300 hover:bg-red-500/20"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      onClick={addStoryPart}
                      variant="outline"
                      className="w-full py-2 border-dashed border-purple-400 text-purple-300 hover:border-yellow-500 hover:text-yellow-400"
                    >
                      + Add Another Part
                    </Button>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Mint Price (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={mintPrice}
                      onChange={(e) => setMintPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-purple-300 focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Preview Section */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-white">Preview</h3>
                  
                  <Card className="bg-white/5 border-purple-400/30">
                    <CardContent className="p-4">
                      <h4 className="text-white font-medium mb-2">{templateTitle || 'Your Template'}</h4>
                      <p className="text-purple-300 text-sm mb-3">{templateTheme}</p>
                      <div className="space-y-2">
                        {storyParts.map((part, index) => (
                          <p key={index} className="text-purple-200 leading-relaxed">
                            {part || <span className="text-purple-400 italic">Story part {index + 1}...</span>}
                            {index < storyParts.length - 1 && <span className="text-yellow-400 mx-2">[blank]</span>}
                          </p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleMintTemplate}
                    disabled={isLoading || !isConnected || !templateTitle}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
                  >
                    {isLoading ? 'Minting NFT...' : `Mint NFT Template (${mintPrice} ETH)`}
                  </Button>
                  
                  {!isConnected && (
                    <p className="text-yellow-400 text-sm text-center">
                      Connect your wallet to mint NFT templates
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}