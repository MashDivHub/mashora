import type { Preview } from '@storybook/react'
import '../src/theme/tokens.css'
import '../src/theme/globals.css'

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'hsl(0 0% 100%)' },
        { name: 'dark', value: 'hsl(240 10% 3.9%)' },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const bg = context.globals.backgrounds?.value
      const isDark = bg === 'hsl(240 10% 3.9%)'
      return (
        <div className={isDark ? 'dark' : ''} style={{ padding: '2rem' }}>
          <Story />
        </div>
      )
    },
  ],
}

export default preview
