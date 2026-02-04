# AsciiArtDisplay Component

A modular, extensible component for displaying colored ASCII art with optional animation effects.

## Architecture

This component has been refactored into a modular structure to support easy extension with various animation effects:

```
AsciiArtDisplay/
├── index.tsx                 # Main component (orchestrator)
├── types.ts                  # TypeScript interfaces and types
├── utils.ts                  # ANSI parsing utilities
├── AsciiCharacterGrid.ts     # Grid data structure builder
├── AsciiCharacter.tsx        # Individual character renderer
├── transformers.ts           # Character transformation functions
├── useAsciiAnimations.ts     # Animation effects hook
└── README.md                 # This file
```

## Basic Usage

```tsx
import { AsciiArtDisplay } from './components/AsciiArtDisplay';

<AsciiArtDisplay
  asciiArt={coloredAsciiString}
  charactersPerLine={80}
  pixelWidth={300}
  alt="Album cover art"
/>
```

## With Animations

```tsx
import { AsciiArtDisplay, dotTransformer, matrixTransformer } from './components/AsciiArtDisplay';

<AsciiArtDisplay
  asciiArt={coloredAsciiString}
  charactersPerLine={80}
  pixelWidth={300}
  
  // Enable hover effect (characters change on mouse over)
  enableHoverEffect={true}
  hoverTransformer={dotTransformer}
  
  // Enable Matrix-style column ripple effect
  enableMatrixRipple={true}
  rippleInterval={3000}
  
  // Animation duration
  effectDuration={500}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asciiArt` | `string` | required | The ASCII art with ANSI color codes |
| `charactersPerLine` | `number` | required | Max characters per line for font sizing |
| `pixelWidth` | `number` | required | Available width in pixels |
| `alt` | `string` | `undefined` | Alt text for accessibility |
| `height` | `number \| string` | `undefined` | Container height |
| `sx` | `SxProps<Theme>` | `undefined` | MUI sx prop for styling |
| `enableHoverEffect` | `boolean` | `false` | Enable character transformation on hover |
| `enableMatrixRipple` | `boolean` | `false` | Enable periodic column ripple effects |
| `hoverTransformer` | `CharTransformer` | `dotTransformer` | Function to transform hovered characters |
| `rippleInterval` | `number` | `3000` | Milliseconds between ripple effects |
| `effectDuration` | `number` | `500` | Duration of effect animations in ms |

## Built-in Transformers

The component includes several pre-built character transformers:

```typescript
import {
  dotTransformer,           // Transforms to '.'
  randomCharTransformer,    // Random printable ASCII
  matrixTransformer,        // Matrix-style katakana
  specificCharTransformer,  // Specific character
  customSetTransformer,     // Random from custom set
  identityTransformer,      // No change
} from './components/AsciiArtDisplay';

// Example: Transform to a star
<AsciiArtDisplay
  enableHoverEffect={true}
  hoverTransformer={specificCharTransformer('★')}
/>

// Example: Random from custom set
<AsciiArtDisplay
  enableHoverEffect={true}
  hoverTransformer={customSetTransformer('.,;:!?')}
/>
```

## Creating Custom Transformers

Transformers are simple functions that take a character and return a new one:

```typescript
import { CharTransformer } from './components/AsciiArtDisplay';

// Simple transformer
const exclamationTransformer: CharTransformer = () => '!';

// Context-aware transformer
const contextTransformer: CharTransformer = (original, context) => {
  // Access original character data
  const isUpperCase = original.char === original.char.toUpperCase();
  return isUpperCase ? '█' : '▒';
};

// Use it
<AsciiArtDisplay
  enableHoverEffect={true}
  hoverTransformer={contextTransformer}
/>
```

## Advanced: Custom Animation Effects

You can access the animation hook directly for custom effects:

```typescript
import { useAsciiAnimations, buildCharacterGrid } from './components/AsciiArtDisplay';

function MyCustomComponent({ asciiArt }) {
  const grid = useMemo(() => buildCharacterGrid(asciiArt), [asciiArt]);
  
  const { charOverrides, applyEffect, triggerColumnRipple } = useAsciiAnimations(grid, {
    enableHoverEffect: false,
    enableMatrixRipple: false,
  });
  
  // Trigger custom effects
  const handleClick = () => {
    // Transform a specific character
    applyEffect(5, 10, () => '★', 1000);
    
    // Ripple down column 20
    triggerColumnRipple(20, () => '░');
  };
  
  // Render with overrides...
}
```

## Performance Notes

- Individual characters are rendered as memoized components
- Only characters with active effects re-render
- Character grid is memoized and only rebuilds when ASCII art changes
- Effects use timers that are properly cleaned up on unmount
- Maximum of one active effect per character position

## Color Support

The component supports both 8-bit and 24-bit RGB ANSI color codes:

- 8-bit: `\x1b[31m` (red)
- 24-bit RGB: `[38;2;255;0;0m` (red)

Colors are automatically parsed and applied to characters.

## Future Extensions

Potential additions to this architecture:

- Wave effects across entire grid
- Character rotation/scaling animations
- Color fade animations
- Particle effects spawning from characters
- Sound-reactive animations
- Different easing functions for transformations
- Effect priority system for stacking multiple effects
