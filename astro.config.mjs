// @ts-check
import { defineConfig, passthroughImageService } from "astro/config";
import vue from "@astrojs/vue";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  adapter: cloudflare({ imageService: "passthrough" }),
  site: "https://ooru.build",

  // The site uses plain <img> (no astro:assets), so skip sharp entirely. This
  // keeps sharp + its fs/child_process deps out of the Cloudflare Worker bundle
  // (which otherwise fails to deploy: "Could not resolve fs/child_process").
  image: { service: passthroughImageService() },

  integrations: [
    tailwind(),
    // Treat <model-viewer> (and any custom element) as a native element so Vue
    // islands can render it instead of trying to resolve it as a component.
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.includes("-"),
        },
      },
    }),
  ],

  vite: {
    define: {
      __DEBUG__: JSON.stringify(process.env.NODE_ENV !== "production"),
    },
  },
});
