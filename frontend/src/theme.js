// src/theme.js
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  direction: "rtl",
  typography: {
    fontFamily: `"Heebo","Rubik","Arimo","Assistant","Arial",sans-serif`,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { direction: "rtl" },
        body: {
          direction: "rtl",
          textAlign: "right",
          fontFamily: `"Heebo","Rubik","Arimo","Assistant","Arial",sans-serif`,
        },
      },
    },
  },
});

export default theme;

