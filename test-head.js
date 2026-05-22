async function test() {
  const url1 = "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.0.03.zip";
  const res1 = await fetch(url1, { method: 'HEAD' });
  console.log("Valid stable response:", res1.status);
}
test();
