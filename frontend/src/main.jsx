import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient,QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "light", // or "dark"
  },
});

const queryclient=new QueryClient();
createRoot(document.getElementById('root')).render(
    <QueryClientProvider client={queryclient}>
      <ThemeProvider theme={theme}>
        <CssBaseline /> {/* Reset default CSS */}
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  
)
