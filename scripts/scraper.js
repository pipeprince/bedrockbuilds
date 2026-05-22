import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
const DB_PATH = './data/db.json';
const OUTPUT_DIR = './dist/api/v1';
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
let db = { versions: {} };
if (fs.existsSync(DB_PATH)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!db.versions) db.versions = {};
  } catch (e) {
    console.error('Failed to parse db.json, starting fresh:', e.message);
  }
}
function extractVersion(versionText) {
  const matches = versionText.match(/\d+\.\d+(?:\.\d+)*/);
  return matches ? matches[0] : null;
}
function extractUpdateTitle(versionText) {
  const matches = versionText.match(/\((.*?)\)/);
  if (matches) {
    const title = matches[1];
    if (title.includes('Guide') || title.includes('Beta') || title.includes('Release')) {
      const remainingText = versionText.substring(versionText.indexOf(')') + 1);
      const nextMatches = remainingText.match(/\((.*?)\)/);
      if (nextMatches) {
        return nextMatches[1];
      }
      return null;
    }
    return title;
  }
  return null;
}
function isVersionAtLeast(version, minimum) {
  const vParts = version.split('.').map(Number);
  const mParts = minimum.split('.').map(Number);
  const maxLen = Math.max(vParts.length, mParts.length);
  for (let i = 0; i < maxLen; i++) {
    const v = vParts[i] || 0;
    const m = mParts[i] || 0;
    if (v > m) return true;
    if (v < m) return false;
  }
  return true;
}
async function scrapeVersionDetails(version, updateTitle) {
  console.log(`[Scraper] Scraping details for version ${version}...`);
  const url = `https://minecraft.wiki/w/Bedrock_Edition_${version}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MinecraftVersionBot/1.0 PHP/Laravel'
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }
    const htmlContent = await res.text();
    const $ = cheerio.load(htmlContent);
    let serverVersion = 'N/A';
    const infobox = $('.infobox-rows');
    if (infobox.length > 0) {
      infobox.find('tr').each((_, row) => {
        const headerText = $(row).find('th').text().trim();
        if (headerText.includes('Server version')) {
          const links = $(row).find('td a');
          if (links.length > 0) {
            serverVersion = $(links.last()).text().trim();
          } else {
            serverVersion = $(row).find('td').text().trim();
          }
        }
      });
    }
    let description = '';
    const contentDiv = $('.mw-parser-output');
    const toc = $('#toc');
    if (contentDiv.length > 0) {
      let paragraphs = [];
      if (toc.length > 0) {
        let node = toc.prev();
        while (node.length > 0) {
          if (node.is('p')) {
            node.find('sup').remove();
            const text = node.text().trim();
            if (text) paragraphs.push(text);
          }
          node = node.prev();
        }
        paragraphs = paragraphs.reverse();
      } else {
        contentDiv.find('> p').each((_, p) => {
          $(p).find('sup').remove();
          const text = $(p).text().trim();
          if (text) paragraphs.push(text);
        });
      }
      for (const text of paragraphs) {
        if (text && !text.startsWith('Bedrock Edition') && !text.startsWith('This article')) {
          description = text;
          break;
        }
      }
    }
    if (!description) {
      description = `Minecraft Bedrock Edition version ${version}.`;
    }
    const versionToUse = serverVersion !== 'N/A' ? serverVersion : version;
    const downloadUrls = {
      linux: `https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-${versionToUse}.zip`,
      windows: `https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-${versionToUse}.zip`
    };

    let previewServerVersion = null;
    let previewDownloadUrls = null;
    try {
      const devUrl = `https://minecraft.wiki/w/Bedrock_Edition_${version}/Development_versions`;
      const devRes = await fetch(devUrl, {
        headers: { 'User-Agent': 'MinecraftVersionBot/1.0 PHP/Laravel' }
      });
      if (devRes.ok) {
        const devHtml = await devRes.text();
        const $dev = cheerio.load(devHtml);
        const devToc = $dev('#toc');
        if (devToc.length > 0) {
          const previewMatches = [];
          $dev('#toc .toctext').each((_, el) => {
            const text = $dev(el).text().trim();
            if (text.startsWith('Preview ') || text.startsWith('Beta ')) {
              const match = text.match(/(?:Preview|Beta)\s+(\d+\.\d+\.\d+(?:\.\d+)?)/);
              if (match) previewMatches.push(match[1]);
            }
          });
          if (previewMatches.length > 0) {
            previewServerVersion = previewMatches[previewMatches.length - 1];
          }
        }
      }
    } catch (e) {
      console.error(`[Scraper] Failed to fetch preview details for ${version}`);
    }

    if (previewServerVersion) {
      let linuxPreviewUrl = `https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-${previewServerVersion}.zip`;
      try {
        const checkRes = await fetch(linuxPreviewUrl, { method: 'HEAD' });
        if (!checkRes.ok && !previewServerVersion.startsWith('1.')) {
          const altVersion = '1.' + previewServerVersion;
          const altLinuxUrl = `https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-${altVersion}.zip`;
          const altRes = await fetch(altLinuxUrl, { method: 'HEAD' });
          if (altRes.ok) {
            previewServerVersion = altVersion;
            linuxPreviewUrl = altLinuxUrl;
          }
        }
      } catch (e) {
        // ignore
      }

      previewDownloadUrls = {
        linux: linuxPreviewUrl,
        windows: `https://www.minecraft.net/bedrockdedicatedserver/bin-win-preview/bedrock-server-${previewServerVersion}.zip`
      };
    }

    const result = {
      version_number: version,
      update_title: updateTitle || 'Standard Update',
      description,
      server_version: serverVersion,
      download_urls: downloadUrls,
      scraped_preview: true
    };

    if (previewServerVersion) {
      result.preview_server_version = previewServerVersion;
      result.preview_download_urls = previewDownloadUrls;
    }

    return result;
  } catch (e) {
    console.error(`[Scraper] Failed to scrape details for ${version}:`, e.message);
    return {
      version_number: version,
      update_title: updateTitle || 'Standard Update',
      description: `Failed to load details for version ${version}.`,
      server_version: 'N/A',
      download_urls: {
        linux: `https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-${version}.zip`,
        windows: `https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-${version}.zip`
      }
    };
  }
}
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  console.log('[Scraper] Fetching Bedrock Edition version history...');
  const apiUrl = "https://minecraft.wiki/api.php?action=parse&page=Bedrock_Edition_version_history&format=json";
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'MinecraftVersionBot/1.0 PHP/Laravel'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    const data = await response.json();
    const htmlContent = data.parse.text['*'];
    const $ = cheerio.load(htmlContent);
    const versionsList = [];
    const tables = $('table.wikitable');
    tables.each((_, table) => {
      $(table).find('tr').each((i, row) => {
        if (i === 0) return;
        const cols = $(row).find('td, th');
        if (cols.length >= 2) {
          const versionText = $(cols.get(0)).text().trim();
          const versionNumber = extractVersion(versionText);
          if (versionNumber && isVersionAtLeast(versionNumber, "1.1")) {
            const updateTitle = extractUpdateTitle(versionText);
            versionsList.push({
              version_number: versionNumber,
              title: updateTitle || 'Standard Release'
            });
          }
        }
      });
    });
    const seen = new Set();
    const uniqueVersions = [];
    for (const v of versionsList) {
      if (!seen.has(v.version_number)) {
        seen.add(v.version_number);
        uniqueVersions.push(v);
      }
    }
    uniqueVersions.sort((a, b) => {
      const aParts = a.version_number.split('.').map(Number);
      const bParts = b.version_number.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) {
          return bVal - aVal;
        }
      }
      return 0;
    });
    console.log(`[Scraper] Found ${uniqueVersions.length} versions. Syncing details...`);
    const finalVersions = [];
    let scrapeCount = 0;
    for (let i = 0; i < uniqueVersions.length; i += 30) {
      const chunk = uniqueVersions.slice(i, i + 30);
      const promises = chunk.map(async (v) => {
        const cached = db.versions[v.version_number];
        if (cached && cached.server_version && cached.server_version !== 'N/A' && cached.server_version !== 'Error' && cached.scraped_preview) {
          return cached;
        } else {
          const details = await scrapeVersionDetails(v.version_number, v.title);
          db.versions[v.version_number] = details;
          return details;
        }
      });
      const results = await Promise.all(promises);
      finalVersions.push(...results);
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    console.log('[Scraper] DB Cache saved.');
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'versions.json'),
      JSON.stringify({ success: true, count: finalVersions.length, last_updated: new Date().toISOString(), data: finalVersions }, null, 2),
      'utf-8'
    );
    const stable = finalVersions.find(v => v.server_version && v.server_version !== 'N/A');
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'latest.json'),
      JSON.stringify({ success: true, last_updated: new Date().toISOString(), data: stable || null }, null, 2),
      'utf-8'
    );
    const detailsDir = path.join(OUTPUT_DIR, 'details');
    if (!fs.existsSync(detailsDir)) {
      fs.mkdirSync(detailsDir, { recursive: true });
    }
    for (const v of finalVersions) {
      fs.writeFileSync(
        path.join(detailsDir, `${v.version_number}.json`),
        JSON.stringify({ success: true, last_updated: new Date().toISOString(), data: v }, null, 2),
        'utf-8'
      );
    }
    console.log('[Scraper] Public Static JSON APIs generated successfully!');
  } catch (e) {
    console.error('[Scraper] Critical Scraper Error:', e);
    process.exit(1);
  }
}
main();
