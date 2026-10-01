// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // The edge functions run in Deno and are not part of the app bundle.
    ignores: ["dist/*", "supabase/functions/*/index.ts", "supabase/functions/_shared/expo-push.ts"],
  }
]);
