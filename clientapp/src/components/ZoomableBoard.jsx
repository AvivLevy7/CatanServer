import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

/**
 * Pinch-to-zoom / drag-to-pan viewport for the game board. Fills its parent and
 * starts at 1x so the whole island is visible; double-tap resets.
 */
export default function ZoomableBoard({ children }) {
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
        {children}
      </TransformComponent>
    </TransformWrapper>
  );
}
