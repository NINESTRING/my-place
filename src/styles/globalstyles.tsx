import { createGlobalStyle } from "styled-components";

const hue = 223;
const starHue = 38;

const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after { box-sizing: border-box; }
  
  :root {
    --bg: #{hsl(${hue},10%,90%)};
    --fg: #{hsl(${hue},10%,10%)};
    --primary: #{hsl(${hue},90%,55%)};
    --yellow: #{hsl(${starHue},90%,55%)};
    --yellow-t: #{hsla(${starHue},90%,55%,0)};
    --bezier: cubic-bezier(0.42,0,0.58,1);
    --trans-dur: 0.3s;
    /* font-size: calc(24px + (30 - 24) * (100vw - 320px) / (1280 - 320)); */
  }

  html,
  body {
    margin: 0;
    padding: 0;
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.75;

    color: ${({ theme }) => theme.colors.primary};
    font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
      Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;

    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  body::-webkit-scrollbar {
  display: none; /* for Chrome, Safari, and Opera */
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    font-weight: bold;
    line-height: 1;
    color: inherit;
  }
  h1 {
    font-size: 2.5rem;
  }
  h2,
  h3,
  h4 { 
    margin-bottom: 36px; 
  }
  p {
    line-height: 1.75;
    
    & + p {
      margin-top: 2rem;
    } 
  }
  img { max-width: 100%; }
  blockquote,
  figure { margin: 0; }
  form { position: relative; }


  a {
    color: inherit;
    text-decoration: none;
  }

  button,
  a {
    outline: none;
    &::-moz-focus-inner { border: 0; }
    &:not(:disabled) { cursor: pointer; }
  }

  svg {
    width: 100%;
    height: 100%;
  }

`;

export default GlobalStyle;
