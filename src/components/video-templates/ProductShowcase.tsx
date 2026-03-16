import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { ProductShowcaseConfig } from './types'
import { DEFAULT_BRAND } from './types'

export const ProductShowcase: React.FC<{ config: ProductShowcaseConfig }> = ({ config }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const brand = config.brand || DEFAULT_BRAND
  const products = config.products || []
  const productDuration = products.length > 0 ? Math.floor((durationInFrames - 60) / products.length) : durationInFrames

  if (products.length === 0) {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: '#fff', fontSize: 40 }}>Legg til produkter</p>
      </AbsoluteFill>
    )
  }

  // Determine which product to show
  const currentProductIndex = Math.min(
    Math.floor(frame / productDuration),
    products.length - 1
  )
  const productFrame = frame - currentProductIndex * productDuration
  const product = products[currentProductIndex]

  // Show CTA at the end
  const showCTA = frame > durationInFrames - 60

  // Product image animation
  const imgScale = interpolate(productFrame, [0, 20], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const imgOpacity = interpolate(productFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Price tag animation
  const priceScale = interpolate(productFrame, [15, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Name animation
  const nameOpacity = interpolate(productFrame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const nameY = interpolate(productFrame, [10, 25], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // CTA animation
  const ctaOpacity = interpolate(frame, [durationInFrames - 60, durationInFrames - 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const ctaScale = interpolate(frame, [durationInFrames - 60, durationInFrames - 40], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${brand.background}, ${brand.primary}15)`,
      }}
    >
      {!showCTA ? (
        // Product view
        <>
          {/* Product image */}
          <div
            style={{
              position: 'absolute',
              top: '10%',
              left: '5%',
              right: '5%',
              height: '55%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: imgOpacity,
              transform: `scale(${imgScale})`,
            }}
          >
            {product.imageUrl ? (
              <Img
                src={product.imageUrl}
                style={{
                  maxWidth: '90%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 16,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '80%',
                  height: '80%',
                  backgroundColor: '#f3f4f6',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 80 }}>📦</span>
              </div>
            )}
          </div>

          {/* Product info */}
          <div
            style={{
              position: 'absolute',
              bottom: '10%',
              left: 0,
              right: 0,
              textAlign: 'center',
              padding: '0 40px',
            }}
          >
            <h2
              style={{
                color: brand.text,
                fontSize: 44,
                fontWeight: 800,
                margin: 0,
                opacity: nameOpacity,
                transform: `translateY(${nameY}px)`,
              }}
            >
              {product.name}
            </h2>
            {product.description && (
              <p
                style={{
                  color: `${brand.text}99`,
                  fontSize: 24,
                  marginTop: 12,
                  opacity: nameOpacity,
                }}
              >
                {product.description}
              </p>
            )}
            {/* Price tag */}
            <div
              style={{
                display: 'inline-block',
                marginTop: 20,
                transform: `scale(${priceScale})`,
              }}
            >
              <span
                style={{
                  backgroundColor: brand.accent,
                  color: '#fff',
                  fontSize: 36,
                  fontWeight: 800,
                  padding: '12px 30px',
                  borderRadius: 50,
                }}
              >
                {product.price}
              </span>
            </div>
          </div>

          {/* Product counter */}
          <div
            style={{
              position: 'absolute',
              top: 30,
              right: 30,
              backgroundColor: `${brand.primary}dd`,
              color: '#fff',
              padding: '6px 16px',
              borderRadius: 20,
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {currentProductIndex + 1}/{products.length}
          </div>
        </>
      ) : (
        // CTA screen
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ctaOpacity,
            transform: `scale(${ctaScale})`,
          }}
        >
          <div style={{ textAlign: 'center', padding: '0 40px' }}>
            {config.logoUrl && (
              <Img src={config.logoUrl} style={{ height: 60, marginBottom: 30 }} />
            )}
            <h2 style={{ color: '#fff', fontSize: 52, fontWeight: 800, margin: 0 }}>
              {config.ctaText || 'Kjøp nå!'}
            </h2>
            {config.ctaUrl && (
              <p style={{ color: '#ffffffaa', fontSize: 24, marginTop: 16 }}>
                {config.ctaUrl}
              </p>
            )}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
