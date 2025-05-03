import '@mantine/core/styles.css';
import '../public/index.css';

import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ClerkProvider } from '@clerk/nextjs';
import { MantineProvider } from '@mantine/core';
import { theme } from '../theme';
import AuthIcon from '@/components/AuthIcon/AuthIcon';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider {...pageProps}>
      <MantineProvider theme={theme}>
        <Head>
          <title>Mantine Template</title>
          <meta
            name="viewport"
            content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
          />
          <link rel="shortcut icon" href="/favicon.svg" />
        </Head>
        <AuthIcon />
        <Component {...pageProps} />
      </MantineProvider>
    </ClerkProvider>
  );
}
