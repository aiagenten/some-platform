'use client'

import { useState, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, RefreshCw, Loader2, Pencil, X, Check } from 'lucide-react'

export type CarouselSlide = {
  slide_index: number
  headline: string
  subtitle: string
  cta_text: string
  text_content: string
  image_suggestion: string
  image_url: string | null
  overlay_image_url: string | null
}

type Props = {
  slides: CarouselSlide[]
  onSlidesChange: (slides: CarouselSlide[]) => void
  activeSlide: number
  onActiveSlideChange: (index: number) => void
  onRegenerateSlideImage?: (slideIndex: number) => void
  regeneratingSlide?: number | null
  maxSlides?: number
}

function SortableSlide({
  slide,
  index,
  isActive,
  onClick,
  onRemove,
  onRegenerate,
  isRegenerating,
  canRemove,
}: {
  slide: CarouselSlide
  index: number
  isActive: boolean
  onClick: () => void
  onRemove: () => void
  onRegenerate: () => void
  isRegenerating: boolean
  canRemove: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `slide-${slide.slide_index}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex-shrink-0 w-32 group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
        isActive
          ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-200'
          : 'border-slate-200 hover:border-slate-300'
      } ${isDragging ? 'shadow-2xl' : ''}`}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 z-10 p-0.5 bg-black/40 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5 text-white" />
      </div>

      {/* Slide number */}
      <div className="absolute top-1 right-1 z-10 w-5 h-5 bg-black/60 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
        {index + 1}
      </div>

      {/* Thumbnail */}
      <div className="aspect-square bg-slate-100">
        {slide.image_url ? (
          <img src={slide.image_url} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-dashed border-slate-300 rounded-lg mx-auto mb-1" />
              <span className="text-[9px]">Ingen bilde</span>
            </div>
          </div>
        )}
      </div>

      {/* Headline preview */}
      <div className="p-1.5 bg-white">
        <p className="text-[10px] font-medium text-slate-700 truncate">
          {slide.headline || `Slide ${index + 1}`}
        </p>
      </div>

      {/* Action buttons on hover */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onRegenerate() }}
          disabled={isRegenerating}
          className="p-1 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors disabled:opacity-50"
          title="Regenerer bilde"
        >
          {isRegenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </button>
        {canRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="p-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            title="Fjern slide"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function CarouselEditor({
  slides,
  onSlidesChange,
  activeSlide,
  onActiveSlideChange,
  onRegenerateSlideImage,
  regeneratingSlide,
  maxSlides = 10,
}: Props) {
  const [editingSlide, setEditingSlide] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ headline: '', subtitle: '', cta_text: '', text_content: '' })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = slides.findIndex(s => `slide-${s.slide_index}` === active.id)
    const newIndex = slides.findIndex(s => `slide-${s.slide_index}` === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(slides, oldIndex, newIndex).map((s, i) => ({ ...s, slide_index: i }))
    onSlidesChange(reordered)

    // Update active slide to follow the dragged item
    if (activeSlide === oldIndex) onActiveSlideChange(newIndex)
    else if (activeSlide > oldIndex && activeSlide <= newIndex) onActiveSlideChange(activeSlide - 1)
    else if (activeSlide < oldIndex && activeSlide >= newIndex) onActiveSlideChange(activeSlide + 1)
  }, [slides, onSlidesChange, activeSlide, onActiveSlideChange])

  const addSlide = () => {
    if (slides.length >= maxSlides) return
    const newSlide: CarouselSlide = {
      slide_index: slides.length,
      headline: '',
      subtitle: '',
      cta_text: '',
      text_content: '',
      image_suggestion: '',
      image_url: null,
      overlay_image_url: null,
    }
    onSlidesChange([...slides, newSlide])
    onActiveSlideChange(slides.length)
  }

  const removeSlide = (index: number) => {
    if (slides.length <= 3) return
    const updated = slides.filter((_, i) => i !== index).map((s, i) => ({ ...s, slide_index: i }))
    onSlidesChange(updated)
    if (activeSlide >= updated.length) onActiveSlideChange(updated.length - 1)
    else if (activeSlide > index) onActiveSlideChange(activeSlide - 1)
  }

  const startEditing = (index: number) => {
    const slide = slides[index]
    setEditForm({
      headline: slide.headline,
      subtitle: slide.subtitle,
      cta_text: slide.cta_text,
      text_content: slide.text_content,
    })
    setEditingSlide(index)
  }

  const saveEditing = () => {
    if (editingSlide === null) return
    const updated = slides.map((s, i) =>
      i === editingSlide ? { ...s, ...editForm } : s
    )
    onSlidesChange(updated)
    setEditingSlide(null)
  }

  const activeSlideData = slides[activeSlide]

  return (
    <div className="space-y-4">
      {/* Slide count selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          Karusell ({slides.length} slides)
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">3-{maxSlides} slides</span>
          {slides.length < maxSlides && (
            <button
              onClick={addSlide}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all border border-indigo-100"
            >
              <Plus className="w-3 h-3" />
              Legg til slide
            </button>
          )}
        </div>
      </div>

      {/* Sortable slide thumbnails */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map(s => `slide-${s.slide_index}`)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {slides.map((slide, index) => (
              <SortableSlide
                key={`slide-${slide.slide_index}`}
                slide={slide}
                index={index}
                isActive={activeSlide === index}
                onClick={() => onActiveSlideChange(index)}
                onRemove={() => removeSlide(index)}
                onRegenerate={() => onRegenerateSlideImage?.(index)}
                isRegenerating={regeneratingSlide === index}
                canRemove={slides.length > 3}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Active slide editor */}
      {activeSlideData && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-700">
              Slide {activeSlide + 1} av {slides.length}
              {activeSlide === 0 && <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Hook</span>}
              {activeSlide === slides.length - 1 && <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">CTA</span>}
            </h4>
            {editingSlide === activeSlide ? (
              <div className="flex gap-1">
                <button onClick={saveEditing} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingSlide(null)} className="p-1.5 bg-slate-400 text-white rounded-lg hover:bg-slate-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => startEditing(activeSlide)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white rounded-lg hover:bg-slate-100 transition-all border border-slate-200"
              >
                <Pencil className="w-3 h-3" />
                Rediger
              </button>
            )}
          </div>

          {editingSlide === activeSlide ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Overskrift</label>
                <input
                  type="text"
                  value={editForm.headline}
                  onChange={(e) => setEditForm(f => ({ ...f, headline: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Overskrift for denne sliden..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Undertekst</label>
                <input
                  type="text"
                  value={editForm.subtitle}
                  onChange={(e) => setEditForm(f => ({ ...f, subtitle: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Undertekst..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CTA-knapp</label>
                <input
                  type="text"
                  value={editForm.cta_text}
                  onChange={(e) => setEditForm(f => ({ ...f, cta_text: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="F.eks. 'Les mer', 'Swipe →'"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tekst</label>
                <textarea
                  value={editForm.text_content}
                  onChange={(e) => setEditForm(f => ({ ...f, text_content: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Tekst for denne sliden..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {activeSlideData.headline && (
                <p className="text-sm font-semibold text-slate-800">{activeSlideData.headline}</p>
              )}
              {activeSlideData.subtitle && (
                <p className="text-xs text-slate-600">{activeSlideData.subtitle}</p>
              )}
              {activeSlideData.text_content && (
                <p className="text-xs text-slate-500 mt-1">{activeSlideData.text_content}</p>
              )}
              {activeSlideData.cta_text && (
                <span className="inline-block mt-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {activeSlideData.cta_text}
                </span>
              )}
              {!activeSlideData.headline && !activeSlideData.text_content && (
                <p className="text-xs text-slate-400 italic">Ingen innhold enda. Klikk Rediger for å legge til.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
