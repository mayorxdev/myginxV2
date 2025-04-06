import type { AppProps } from "next/app";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/styles/globals.css";

// Only import on server side
let startSyncProcess: () => boolean;
if (typeof window === 'undefined') {
  import('@/startup').then(module => {
    startSyncProcess = module.startSyncProcess;
    // Call the function immediately when imported on server side
    startSyncProcess();
  }).catch(err => {
    console.error('Failed to import startup module:', err);
  });
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
