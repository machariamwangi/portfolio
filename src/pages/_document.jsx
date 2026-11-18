import { Html, Head, Main, NextScript } from 'next/document';

// Apply saved preferences before the stylesheets paint the exported page.
const initializePreferences = `(function () {
  try {
    if (sessionStorage.getItem('em-feature-dismissed') === '1') {
      document.documentElement.dataset.featureDismissed = 'true';
    }
  } catch (error) {}
  try {
    var saved = localStorage.getItem('em-theme');
    if (saved !== 'dark' && saved !== 'light') return;
    document.documentElement.dataset.theme = saved;
    var meta = document.querySelector('meta[name="theme-color"]');
    meta.content = meta.dataset[saved];
  } catch (error) {}
})();`;

export default function Document({ __NEXT_DATA__ }) {
  const home = __NEXT_DATA__.page === '/';
  const lightColor = '#f8f7f2';
  const darkColor = '#142320';
  return (
    <Html lang="en" data-page={home ? 'home' : 'interior'} data-theme={home ? 'dark' : 'light'} suppressHydrationWarning>
      <Head>
        <meta name="theme-color" content={home ? darkColor : lightColor} data-dark={darkColor} data-light={lightColor} />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16 32x32 48x48" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <script dangerouslySetInnerHTML={{ __html: initializePreferences }} />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/editorial.css" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
