import type { AppProps } from "next/app";
import { ThemeProvider, DefaultTheme } from "styled-components";
import Header from "../src/components/header";
import PageTransitions from "../src/components/pageTransitions";
import GlobalStyle from "../src/styles/globalstyles";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { AuthProvider } from "src/auth/useAuth";
import { ApolloProvider } from "@apollo/client";
import { useApollo } from "src/apollo";

const App = ({ Component, pageProps }: AppProps) => {
  const router = useRouter();
  const client = useApollo();
  const [routingPageOffset, setRoutingPageOffset] = useState(0);

  useEffect(() => {
    const pageChange = () => {
      setRoutingPageOffset(window.scrollY);
    };

    router.events.on("routeChangeStart", pageChange);
  }, [router.events]);

  return (
    <AuthProvider>
      <ApolloProvider client={client}>
        <ThemeProvider theme={theme}>
          <Header />
          <PageTransitions
            route={router.asPath}
            routingPageOffset={routingPageOffset}
          >
            <Component {...pageProps} />
          </PageTransitions>
          <GlobalStyle />
        </ThemeProvider>
      </ApolloProvider>
    </AuthProvider>
  );
};

export default App;

const theme: DefaultTheme = {
  colors: {
    primary: "#111",
    secondary: "#0070f3",
  },
};
