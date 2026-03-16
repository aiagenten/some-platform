'use client'

import { useState } from 'react'

type Props = {
  caption: string
  imageUrl: string | null
  platform: string
  brandName: string
  brandLogo?: string | null
}

const TABS = [
  { key: 'instagram', label: 'Instagram', icon: '📸' },
  { key: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { key: 'facebook', label: 'Facebook', icon: '📘' },
]

export default function PlatformPreview({ caption, imageUrl, platform, brandName, brandLogo }: Props) {
  const [activeTab, setActiveTab] = useState(platform || 'instagram')

  const truncatedCaption = caption?.length > 300 ? caption.substring(0, 300) + '...' : caption
  const displayName = brandName || 'Brand Name'
  const avatar = brandLogo || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=80`

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Plattform-preview</h3>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {activeTab === 'instagram' && (
          <InstagramPreview
            caption={truncatedCaption}
            imageUrl={imageUrl}
            displayName={displayName}
            avatar={avatar}
          />
        )}
        {activeTab === 'linkedin' && (
          <LinkedInPreview
            caption={truncatedCaption}
            imageUrl={imageUrl}
            displayName={displayName}
            avatar={avatar}
          />
        )}
        {activeTab === 'facebook' && (
          <FacebookPreview
            caption={truncatedCaption}
            imageUrl={imageUrl}
            displayName={displayName}
            avatar={avatar}
          />
        )}
      </div>
    </div>
  )
}

function InstagramPreview({
  caption, imageUrl, displayName, avatar
}: { caption: string; imageUrl: string | null; displayName: string; avatar: string }) {
  return (
    <div className="max-w-[400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
        <span className="text-sm font-semibold text-gray-900">{displayName.toLowerCase().replace(/\s+/g, '')}</span>
        <span className="ml-auto text-gray-400">•••</span>
      </div>

      {/* Image — 1:1 aspect ratio */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3">
        <div className="flex items-center gap-4 mb-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <svg className="w-6 h-6 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>

        {/* Caption */}
        <div className="text-sm">
          <span className="font-semibold mr-1">{displayName.toLowerCase().replace(/\s+/g, '')}</span>
          <span className="text-gray-800 whitespace-pre-wrap">{caption}</span>
        </div>
      </div>
    </div>
  )
}

function LinkedInPreview({
  caption, imageUrl, displayName, avatar
}: { caption: string; imageUrl: string | null; displayName: string; avatar: string }) {
  return (
    <div className="max-w-[500px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{displayName}</p>
          <p className="text-xs text-gray-500">Bedrift • 1t</p>
          <p className="text-xs text-gray-400">🌐</p>
        </div>
        <span className="text-gray-400">•••</span>
      </div>

      {/* Text */}
      <div className="px-4 pb-3">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{caption}</p>
      </div>

      {/* Image — 16:9 aspect ratio for LinkedIn */}
      {imageUrl && (
        <div className="aspect-video bg-gray-100 relative overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Engagement bar */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <span className="flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-blue-500 inline-flex items-center justify-center text-[8px] text-white">👍</span>
            <span className="w-4 h-4 rounded-full bg-red-500 inline-flex items-center justify-center text-[8px] text-white">❤️</span>
          </span>
          <span className="ml-1">24</span>
          <span className="ml-auto">3 kommentarer</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around border-t border-gray-100 py-1">
        {['👍 Liker', '💬 Kommenter', '🔄 Del', '📤 Send'].map((action) => (
          <button
            key={action}
            className="flex-1 py-2 text-xs text-gray-600 hover:bg-gray-50 transition rounded font-medium"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

function FacebookPreview({
  caption, imageUrl, displayName, avatar
}: { caption: string; imageUrl: string | null; displayName: string; avatar: string }) {
  return (
    <div className="max-w-[500px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{displayName}</p>
          <p className="text-xs text-gray-500">1 t · 🌐</p>
        </div>
        <span className="text-gray-400">•••</span>
      </div>

      {/* Text */}
      <div className="px-4 pb-3">
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{caption}</p>
      </div>

      {/* Image — ~4:3 for Facebook */}
      {imageUrl && (
        <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Engagement */}
      <div className="px-4 py-2">
        <div className="flex items-center text-xs text-gray-500 pb-2 border-b border-gray-100">
          <span>👍❤️ 42</span>
          <span className="ml-auto">8 kommentarer · 2 delinger</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around py-1 px-2">
        {['👍 Liker', '💬 Kommenter', '↗️ Del'].map((action) => (
          <button
            key={action}
            className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-50 transition rounded font-medium"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}
