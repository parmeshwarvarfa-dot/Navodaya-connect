import { ScrollViewStyleReset } from "expo-router/html";
import React, { type PropsWithChildren } from "react";

/**
 * Root HTML shell for Navodaya Connect web client.
 * Injects Google Fonts Inter, global typography configuration,
 * and preserves ALL icon fonts (@expo/vector-icons like Ionicons, Feather, MaterialIcons)
 * while ensuring clean modern typography without Times New Roman.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover, user-scalable=no"
        />
        <ScrollViewStyleReset />

        {/* High-Performance Font Preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />

        <style
          id="navodaya-global-typography-engine"
          dangerouslySetInnerHTML={{
            __html: `
              /* Universal Font Aliases for Expo React Native Fonts */
              @font-face {
                font-family: 'Inter_400Regular';
                font-style: normal;
                font-weight: 400;
                src: local('Inter Regular'), local('Inter'),
                     url('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2') format('woff2');
              }
              @font-face {
                font-family: 'Inter_500Medium';
                font-style: normal;
                font-weight: 500;
                src: local('Inter Medium'), local('Inter'),
                     url('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2') format('woff2');
              }
              @font-face {
                font-family: 'Inter_600SemiBold';
                font-style: normal;
                font-weight: 600;
                src: local('Inter SemiBold'), local('Inter'),
                     url('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2') format('woff2');
              }
              @font-face {
                font-family: 'Inter_700Bold';
                font-style: normal;
                font-weight: 600;
                src: local('Inter SemiBold'), local('Inter Bold'), local('Inter'),
                     url('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2') format('woff2');
              }

              /* Smooth rendering */
              *, *::before, *::after {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                box-sizing: border-box;
              }

              /* Root document typography - inherited by normal text naturally */
              html, body, #root, [data-testid="root"] {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              }

              input, textarea, select {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              }

              /* CRITICAL: Explicitly protect all @expo/vector-icons and custom icon fonts from being overridden! */
              [style*="font-family: Ionicons"], [style*="fontFamily: Ionicons"], [style*="font-family: 'Ionicons'"], [style*="font-family:ionicons"] {
                font-family: Ionicons !important;
              }
              [style*="font-family: Feather"], [style*="fontFamily: Feather"], [style*="font-family: 'Feather'"] {
                font-family: Feather !important;
              }
              [style*="font-family: MaterialIcons"], [style*="fontFamily: MaterialIcons"], [style*="font-family: 'MaterialIcons'"] {
                font-family: MaterialIcons !important;
              }
              [style*="font-family: MaterialCommunityIcons"], [style*="fontFamily: MaterialCommunityIcons"] {
                font-family: MaterialCommunityIcons !important;
              }
              [style*="font-family: FontAwesome"], [style*="fontFamily: FontAwesome"] {
                font-family: FontAwesome !important;
              }
              [style*="font-family: FontAwesome5"], [style*="fontFamily: FontAwesome5"] {
                font-family: FontAwesome5 !important;
              }
              [style*="font-family: AntDesign"], [style*="fontFamily: AntDesign"] {
                font-family: AntDesign !important;
              }
              [style*="font-family: Entypo"], [style*="fontFamily: Entypo"] {
                font-family: Entypo !important;
              }
              [style*="font-family: Octicons"], [style*="fontFamily: Octicons"] {
                font-family: Octicons !important;
              }
              [style*="font-family: SimpleLineIcons"], [style*="fontFamily: SimpleLineIcons"] {
                font-family: SimpleLineIcons !important;
              }

              /* Clean executive typography - eliminate chunky, clunky bold weights */
              [style*="font-weight: 700"], [style*="font-weight: 800"], [style*="font-weight: 900"],
              [style*="fontWeight: 700"], [style*="fontWeight: 800"], [style*="fontWeight: 900"],
              [style*="font-weight: bold"], b, strong {
                letter-spacing: -0.015em;
              }

              /* Transparent backgrounds for floating actions */
              .param-ai-floating-btn {
                background-color: transparent !important;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
