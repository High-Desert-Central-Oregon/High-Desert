import { fileURLToPath } from 'node:url';
const appRoot = fileURLToPath(new URL('../../../', import.meta.url));
export default {
  define: { 'process.env': {} },
  root: fileURLToPath(new URL('./', import.meta.url)),
  resolve: { alias: { '@': appRoot } },
  css: { postcss: appRoot },
  server: { host: '127.0.0.1', port: 8769, strictPort: true, fs: { allow: [appRoot] } },
};
