import { 
  FacebookShareButton, 
  TwitterShareButton, 
  TelegramShareButton,
  FacebookIcon,
  TwitterIcon,
  TelegramIcon
} from 'react-share'

export default function ShareBar({ 
  url, 
  title = 'Check out MadFill!', 
  hashtags = ['MadFill', 'Base', 'Farcaster'],
  className = ''
}) {
  const shareUrl = url || 'https://madfill.vercel.app'
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-purple-200 mr-2">Share:</span>
      
      <TwitterShareButton
        url={shareUrl}
        title={title}
        hashtags={hashtags}
        className="hover:scale-110 transition-transform"
      >
        <TwitterIcon size={32} round />
      </TwitterShareButton>
      
      <FacebookShareButton
        url={shareUrl}
        quote={title}
        className="hover:scale-110 transition-transform"
      >
        <FacebookIcon size={32} round />
      </FacebookShareButton>
      
      <TelegramShareButton
        url={shareUrl}
        title={title}
        className="hover:scale-110 transition-transform"
      >
        <TelegramIcon size={32} round />
      </TelegramShareButton>
      
      <button
        onClick={() => {
          if (navigator.share) {
            navigator.share({
              title: title,
              url: shareUrl
            })
          } else {
            navigator.clipboard.writeText(shareUrl)
            // You could show a toast here
            console.log('URL copied to clipboard')
          }
        }}
        className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white hover:scale-110 transition-all"
        title="Share or Copy Link"
      >
        📋
      </button>
    </div>
  )
}