// Copyable backend snippets for the Data source screen, carried over from the design prototype.
// Reference material only: the real ingestion lives in backend/src/worker.ts.
export const SNIP_WS = [
  'import WebSocket from "ws";',
  'import { createWebSocketUrl, SchemaVersion } from "@eulerstream/euler-websocket-sdk";',
  '',
  '// Backend only: the API key never leaves the server',
  'function openSocket(uniqueId) {',
  '  const url = createWebSocketUrl({ uniqueId, apiKey: process.env.EULER_API_KEY, features: { schemaVersion: SchemaVersion.v2, bundleEvents: true } });',
  '  const ws = new WebSocket(url);',
  '',
  '  ws.on("message", (raw) => {',
  '    const msg = JSON.parse(raw.toString()); // first message carries room info',
  '    routeEvent(uniqueId, msg);              // same shapes as tiktok-live-connector types',
  '  });',
  '',
  '  ws.on("close", (code) => handleClose(uniqueId, code)); // see close codes',
  '  return ws;',
  '}',
].join('\n');
export const SNIP_JWT = [
  '// 1. Backend (see backend/src/api/app.ts /ws-token): mint a 60s JWT scoped to one creator',
  'const { data } = await client.authentication.createJWT(eulerAccountId, {',
  '  expireAfter: 60,',
  '  metadata: { version: "v2", expireAfter: 60 },',
  '  api: { enabled: false },',
  '  websockets: { enabled: true, config: { allowedCreators: [uniqueId], maxWebSockets: 1 } },',
  '});',
  'return data.token;',
  '',
  '// 2. Browser: connect without exposing the API key',
  'import { createWebSocketUrl, ClientCloseCode } from "@eulerstream/euler-websocket-sdk";',
  '',
  'const url = createWebSocketUrl({',
  '  uniqueId,',
  '  jwtKey: token,',
  '  features: { bundleEvents: true, syntheticPresence: true },',
  '});',
  'const ws = new WebSocket(url);',
  'ws.addEventListener("close", (e) => {',
  '  if (e.code === ClientCloseCode.NOT_LIVE) markOffline(uniqueId);',
  '  if (e.code === ClientCloseCode.INVALID_AUTH || e.code === ClientCloseCode.NO_PERMISSION) refreshJwtAndReconnect();',
  '});',
].join('\n');
export const SNIP_SDK = {
  py: ['# pip install EulerApiSdk', 'import os', 'from EulerApiSdk import AuthenticatedClient', 'from EulerApiSdk.api.tik_tok_live import fetch_webcast_url', '', 'client = AuthenticatedClient(', '    base_url="https://tiktok.eulerstream.com",', '    token=os.environ["EULER_API_KEY"],', ')', '', 'with client as c:', '    response = fetch_webcast_url.sync_detailed(client=c)', '    print(response.status_code, response.parsed)'].join('\n'),
  cs: ['// dotnet add package EulerApiSdk', 'using EulerApiSdk;', 'using EulerApiSdk.Client;', '', 'using var client = new EulerStreamApiClient(', '    host => host.AddTokens(new ApiKeyToken(Environment.GetEnvironmentVariable("EULER_API_KEY"), ClientUtils.ApiKeyHeader.ApiKey, prefix: ""))', ');', '', 'var response = await client.Webcast.FetchWebcastURLAsync("ttlive-node", uniqueId: "nova_shift");', 'Console.WriteLine(response.Ok());'].join('\n'),
  java: ['// implementation \'io.github.isaackogan:euler-api-sdk\'', 'import io.github.isaackogan.EulerStreamApiClient;', '', 'EulerStreamApiClient client = EulerStreamApiClient.builder()', '    .apiKey(System.getenv("EULER_API_KEY"))', '    .build();', '', 'client.webcast().fetchWebcastURL("ttlive-node", null, "nova_shift");'].join('\n'),
  go: ['// go get github.com/EulerStream/Euler-Api-Sdk/go-sdk', 'package main', '', 'import (', '  "context"', '  "fmt"', '  "os"', '', '  eulerstream "github.com/EulerStream/Euler-Api-Sdk/sdk/go"', ')', '', 'func main() {', '  client := eulerstream.NewEulerStreamClient(', '    eulerstream.WithAPIKey(os.Getenv("EULER_API_KEY")),', '  )', '', '  hosts, _, err := client.Analytics.GetHosts(context.Background()).Execute()', '  if err != nil {', '    panic(err)', '  }', '  fmt.Println(hosts)', '}'].join('\n'),
};
export const snipConnector = (handle: string) => '// npm i tiktok-live-connector@2.5.0\nimport { TikTokLiveConnection, WebcastEvent, UserOfflineError } from "tiktok-live-connector";\n\nconst AGENCY = new Set(["tn.vault", "tn.ops.01", "tn.ops.02", "kai.founder"]);\n\nconst connection = new TikTokLiveConnection("' + handle + '", {\n  signApiKey: process.env.EULER_API_KEY,\n  enableExtendedGiftInfo: true, // gift events carry extendedGiftInfo (name, diamond_count)\n});\n\nlet roomId;\nconnection.connect().then((state) => {\n  roomId = state.roomId;\n  console.info(`Connected to roomId ${roomId}`);\n}).catch((err) => {\n  if (err instanceof UserOfflineError) return scheduleRecheck(); // poll get_room_id\n  console.error("Failed to connect", err);\n});\n\n// Chat feeds the moderation panel; msgId is passed as comment_msg_id on mute/ban\nconnection.on(WebcastEvent.CHAT, (data) => {\n  chat.push({ roomId, userId: data.user?.userId, uniqueId: data.user?.uniqueId, comment: data.comment, msgId: data.common?.msgId });\n});\n\nconnection.on(WebcastEvent.GIFT, (data) => {\n  if (data.giftDetails?.giftType === 1 && !data.repeatEnd) return; // streak still running\n  if (!AGENCY.has(data.user?.uniqueId)) return;                    // agency outlay only\n  ledger.insert({\n    roomId,\n    sender: data.user.uniqueId,\n    giftId: data.giftId,\n    gift: data.giftDetails?.giftName,\n    combo: data.repeatCount,\n    coins: (data.extendedGiftInfo?.diamond_count ?? 0) * data.repeatCount,\n    ts: Date.now(),\n  });\n});';
export const snipSdkTs = (handle: string) => 'import EulerStreamApiClient from "tiktok-live-api-sdk";\n\nconst client = new EulerStreamApiClient({ apiKey: process.env.EULER_API_KEY });\n\n// Price every ledger gift from the live catalog\nconst catalog = await client.gifts.listWebcastGifts();\n\n// Resolve a creator before tracking them\nconst user = await client.tikTokUsers.retrieveTikTokUserBasic("' + handle + '");\n\n// Business plan: open one WebSocket per tracked live target\nconst webcast = await client.anchors.fetchWebcastURLByUniqueId("' + handle + '");';
