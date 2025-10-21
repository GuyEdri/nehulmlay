// frontend/src/rtlCache.js
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";

// Cache ל-RTL כך ש-MUI יעבוד RTL אמיתי (margin/padding/left/right מתהפכים)
const rtlCache = createCache({
  key: "mui-rtl",
  stylisPlugins: [prefixer, rtlPlugin],
});

export default rtlCache;

