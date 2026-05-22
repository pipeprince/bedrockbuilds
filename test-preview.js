import * as cheerio from 'cheerio';

async function test() {
  const devUrl = `https://minecraft.wiki/w/Bedrock_Edition_1.19.80/Development_versions`;
  const devRes = await fetch(devUrl, {
    headers: { 'User-Agent': 'MinecraftVersionBot/1.0 (pterodactyl-panel) PHP/Laravel' }
  });
  const devHtml = await devRes.text();
  const $dev = cheerio.load(devHtml);
  
  let previewServerVersion = null;
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
    console.log("Matches:", previewMatches);
    if (previewMatches.length > 0) {
       previewServerVersion = previewMatches[previewMatches.length - 1];
    }
  }
  console.log("Found:", previewServerVersion);
}
test();
