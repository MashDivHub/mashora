import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'subtle', 'success', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'xl', 'icon', 'icon-sm'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = { args: { children: 'Button', variant: 'default' } }
export const Secondary: Story = { args: { children: 'Secondary', variant: 'secondary' } }
export const Outline: Story = { args: { children: 'Outline', variant: 'outline' } }
export const Ghost: Story = { args: { children: 'Ghost', variant: 'ghost' } }
export const Destructive: Story = { args: { children: 'Delete', variant: 'destructive' } }
export const Success: Story = { args: { children: 'Confirm', variant: 'success' } }
export const Small: Story = { args: { children: 'Small', size: 'sm' } }
export const Large: Story = { args: { children: 'Large', size: 'lg' } }
