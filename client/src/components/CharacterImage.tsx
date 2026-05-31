import { useState, useEffect } from 'react';

interface Props {
  imageUrl: string;
  characterName?: string;
  className?: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#3b82f6'];

// Prepend Vite's base path (e.g. /-anime-character-quiz/) to local image paths
// so they resolve correctly on GitHub Pages. Remote URLs are used as-is.
function resolveUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
}

export default function CharacterImage({ imageUrl, characterName = '?', className = '' }: Props) {
  const [imgError, setImgError] = useState(false);
  const color = COLORS[characterName.charCodeAt(0) % COLORS.length];
  const resolvedUrl = resolveUrl(imageUrl);
  const showPlaceholder = !imageUrl || imgError;

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!showPlaceholder && (
        <img
          key={resolvedUrl}
          src={resolvedUrl}
          alt={characterName}
          className="w-full h-full object-contain"
          style={{ backgroundColor: '#111' }}
          onError={() => setImgError(true)}
        />
      )}
      {showPlaceholder && (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${color}55, ${color}22)` }}
        >
          <span
            className="font-bold text-white/40 select-none leading-none"
            style={{ fontSize: 'clamp(4rem, 20vmin, 12rem)' }}
          >
            {characterName.charAt(0)}
          </span>
        </div>
      )}
    </div>
  );
}
