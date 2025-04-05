import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="icon" type="image/svg+xml" href="/icon1.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Disable right click
              document.addEventListener('contextmenu', (e) => {
                const target = e.target as HTMLElement;
                // Allow right click only on elements with data-allow-context-menu attribute
                if (!target.closest('[data-allow-context-menu="true"]')) {
                  e.preventDefault();
                  return false;
                }
              });

              // Disable keyboard shortcuts
              document.addEventListener('keydown', (e) => {
                // Disable F12
                if (e.key === 'F12') {
                  e.preventDefault();
                  return false;
                }

                // Disable Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
                if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
                  e.preventDefault();
                  return false;
                }

                // Disable Ctrl+U (view source)
                if (e.ctrlKey && e.key === 'u') {
                  e.preventDefault();
                  return false;
                }
              });

              // Disable drag and select
              document.addEventListener('dragstart', (e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('[data-allow-drag="true"]')) {
                  e.preventDefault();
                  return false;
                }
              });

              document.addEventListener('selectstart', (e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('input, textarea, [data-allow-select="true"]')) {
                  e.preventDefault();
                  return false;
                }
              });
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
