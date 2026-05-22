import fs from 'fs';
import path from 'path';
const DIST_DIR = './dist';
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const SOURCE_LOGO = '/root/.gemini/antigravity/brain/fa2e5b14-26b4-4f4b-8b9a-1cc83c8850e0/bedrockbuilds_logo_1779428009110.png';
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}
try {
  if (fs.existsSync(SOURCE_LOGO)) {
    fs.copyFileSync(SOURCE_LOGO, path.join(ASSETS_DIR, 'logo.png'));
    console.log('[Build] Logo copied successfully to dist/assets/logo.png');
  } else {
    console.warn('[Build] Warning: Source logo image not found at expected path. Skipping logo copy.');
  }
} catch (e) {
  console.error('[Build] Failed to copy logo:', e.message);
}
console.log('[Build] Distribution directory setup completed.');
