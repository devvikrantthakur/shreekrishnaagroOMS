import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import JavaScriptObfuscator from 'javascript-obfuscator';

function obfuscateAppBundlePlugin() {
  let isDev = false;
  return {
    name: 'obfuscate-app-bundle',
    enforce: 'post',
    configResolved(config) {
      isDev = config.command === 'serve';
    },
    transform(code, id) {
      // In dev mode (npm run dev), obfuscate application source files so raw code is never visible in DevTools Sources
      if (
        isDev &&
        !id.includes('node_modules') &&
        (id.endsWith('.jsx') || id.endsWith('.js')) &&
        (id.includes('/src/') || id.includes('\\src\\'))
      ) {
        try {
          const result = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: false,
            deadCodeInjection: false,
            disableConsoleOutput: false,
            identifierNamesGenerator: 'hexadecimal',
            renameGlobals: false,
            reservedNames: ['$RefreshReg$', '$RefreshSig$', 'React'],
            simplify: true,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.8,
            transformObjectKeys: true,
          });
          return {
            code: result.getObfuscatedCode(),
            map: null,
          };
        } catch {
          return null;
        }
      }
      return null;
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.code) continue;
        // Skip pure third-party/virtual vendor chunks so only application code is obfuscated
        const moduleIds = Object.keys(chunk.modules || {});
        const hasAppModule = moduleIds.some(
          (id) => !id.startsWith('\0') && !id.includes('node_modules')
        );
        if (!hasAppModule) continue;

        const result = JavaScriptObfuscator.obfuscate(chunk.code, {
          compact: true,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          disableConsoleOutput: true,
          identifierNamesGenerator: 'hexadecimal',
          renameGlobals: false,
          selfDefending: false,
          simplify: true,
          splitStrings: false,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayEncoding: ['base64'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayThreshold: 0.8,
          transformObjectKeys: true,
          unicodeEscapeSequence: false,
        });
        chunk.code = result.getObfuscatedCode();
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), obfuscateAppBundlePlugin()],
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none',
  },
  build: {
    chunkSizeWarningLimit: 3000,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
        inlineDynamicImports: true,
      },
    },
  },
  css: {
    devSourcemap: false,
  },
  server: {
    sourcemapIgnoreList: () => true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
