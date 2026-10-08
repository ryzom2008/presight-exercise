import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

const brand: MantineColorsTuple = [
  '#edf7f3',
  '#d5eee5',
  '#a9e4d4',
  '#7acdbb',
  '#4caa98',
  '#288777',
  '#176b63',
  '#12584f',
  '#153d3a',
  '#182d29',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  defaultRadius: 'md',
  radius: { md: '4px' },
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
    '--mantine-color-default': '#FCFCF8',
    '--mantine-color-default-border': '#A8BDB2',
    '--mantine-color-default-hover': '#EDF3F0',
    '--mantine-color-body': '#EDF3F0',
    '--mantine-color-text': '#182D29',
    '--mantine-color-dimmed': '#52685E',
  },
  dark: {},
});
