import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

const brand: MantineColorsTuple = [
  '#e8f3ee',
  '#d3e6dc',
  '#a8cdb9',
  '#7ab396',
  '#539c79',
  '#368c64',
  '#245c49',
  '#1c4d3d',
  '#143e31',
  '#0c2f25',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  defaultRadius: 'md',
  radius: { md: '12px' },
  headings: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    sizes: {
      h1: { fontSize: '2.25rem', lineHeight: '1.2', fontWeight: '700' },
      h2: { fontSize: '1.25rem', lineHeight: '1.35', fontWeight: '600' },
    },
  },
  colors: { brand },
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#f5f7f6',
    '--mantine-color-text': '#1c2923',
    '--mantine-color-dimmed': '#5c6b63',
  },
  dark: {},
});
