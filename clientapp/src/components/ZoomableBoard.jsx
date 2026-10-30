import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

/**
 * Pinch-to-zoom / drag-to-pan viewport for the game board. It is the full-screen
 * background of the game, so the island itself is inset (`padClass`) to keep it clear
 * of the floating HUD while the draggable surface still covers the whole viewport.
 */
export default function ZoomableBoard({ children, padClass = '' }) {
  return (
    <TransformWrapper
      minScale={1}
      maxScale={4}
      initialScale={1}
      centerOnInit
      limitToBounds
      doubleClick={{ mode: 'reset' }}
      wheel={{ step: 0.15 }}
      pinch={{ step: 5 }}
      panning={{ velocityDisabled: true }}
    >
      <TransformComponent
        wrapperClass="!h-full !w-full"
        contentClass="!h-full !w-full flex items-center justify-center"
      >
        <div className={`flex h-full w-full items-center justify-center ${padClass}`}>{children}</div>
      </TransformComponent>
    </TransformWrapper>
  );
}
