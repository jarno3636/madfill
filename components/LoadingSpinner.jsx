export default function LoadingSpinner({ 
  size = 'md', 
  color = 'white', 
  className = '',
  text = ''
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    white: 'border-white border-t-transparent',
    blue: 'border-blue-500 border-t-transparent',
    purple: 'border-purple-500 border-t-transparent',
    yellow: 'border-yellow-500 border-t-transparent',
    green: 'border-green-500 border-t-transparent'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className={`
          ${sizeClasses[size]} 
          ${colorClasses[color]}
          border-2 rounded-full animate-spin
        `}
      />
      {text && (
        <p className={`mt-2 text-sm ${color === 'white' ? 'text-white' : `text-${color}-500`}`}>
          {text}
        </p>
      )}
    </div>
  );
}

// Overlay spinner for full page loading
export function LoadingOverlay({ show, text = 'Loading...', children }) {
  if (!show) return children;

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <LoadingSpinner size="lg" text={text} />
        </div>
      </div>
    </div>
  );
}

// Skeleton loader for content
export function SkeletonLoader({ className = '', children }) {
  return (
    <div className={`animate-pulse ${className}`}>
      {children || (
        <div className="space-y-3">
          <div className="h-4 bg-white/20 rounded w-3/4"></div>
          <div className="h-4 bg-white/20 rounded w-1/2"></div>
          <div className="h-4 bg-white/20 rounded w-2/3"></div>
        </div>
      )}
    </div>
  );
}