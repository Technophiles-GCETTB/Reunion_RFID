/*
  RFID Reunion — ESP8266 Web Server Writer (v2)
  
  Supports:
    GET  /           → Home page (Reader / Writer buttons)
    GET  /reader     → RFID reader mode
    GET  /writer     → RFID writer form (blank)
    GET  /write?id=<objectId>&version=<v>
                     → RFID writer form PRE-FILLED from admin panel click
    API  /api/read   → JSON card data poll
    API  /api/write  → Submit write request
    API  /api/writestatus → Poll write status

  Wiring (NodeMCU):
    MFRC522 SDA  → D8 (GPIO15)
    MFRC522 SCK  → D5 (GPIO14)
    MFRC522 MOSI → D7 (GPIO13)
    MFRC522 MISO → D6 (GPIO12)
    MFRC522 RST  → D3 (GPIO0)
    MFRC522 3.3V → 3.3V
    MFRC522 GND  → GND
*/

#include <MFRC522v2.h>
#include <MFRC522DriverSPI.h>
#include <MFRC522DriverPinSimple.h>
#include <MFRC522Debug.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

// ── CONFIGURE ──────────────────────────────────────────────────────────────
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
// ──────────────────────────────────────────────────────────────────────────

MFRC522DriverPinSimple ss_pin(15);
MFRC522DriverSPI driver{ss_pin};
MFRC522 mfrc522{driver};
MFRC522::MIFARE_Key key;

ESP8266WebServer server(80);

// Block layout
const byte BLOCK_USER_ID_1 = 4;
const byte BLOCK_USER_ID_2 = 5;
const byte BLOCK_VERSION   = 6;

// State
byte  currentMode   = 0; // 0=idle 1=reader 2=writer
String writeUserId      = "";
String writeCardVersion = "";
bool   writePending     = false;
bool   writeSuccess     = false;
bool   writeFailed      = false;
String readUID          = "";
String readUserId       = "";
String readCardVersion  = "";
bool   cardReadReady    = false;

// ── HTML Helpers ──────────────────────────────────────────────────────────

// Shared <head> with styles
String htmlHead(const String& title) {
  return R"(<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>)" + title + R"( — RFID Writer</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#070b10;--panel:#0f1620;--border:#1a2535;--border2:#243040;
  --accent:#3b82f6;--green:#10b981;--red:#ef4444;--warn:#f59e0b;--text:#e2e8f0;--muted:#94a3b8;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Syne',sans-serif;
  min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 16px;
  background-image:radial-gradient(ellipse at 20% 0%,rgba(0,100,150,.12) 0%,transparent 60%),
  repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(59,130,246,.02) 40px,rgba(59,130,246,.02) 41px),
  repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(59,130,246,.02) 40px,rgba(59,130,246,.02) 41px);}
.logo{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:4px;color:var(--muted);margin-bottom:6px;text-align:center}
h1{font-size:clamp(22px,5vw,36px);font-weight:800;color:var(--accent);letter-spacing:2px;text-align:center;margin-bottom:4px;text-shadow:0 0 24px rgba(59,130,246,.4)}
.sub{font-size:12px;color:var(--muted);letter-spacing:2px;margin-bottom:28px;font-family:'JetBrains Mono',monospace;text-align:center}
.card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:24px;
  width:100%;max-width:480px;box-shadow:0 0 20px rgba(59,130,246,.1),inset 0 1px 0 rgba(59,130,246,.08);margin-bottom:16px}
.card-title{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:3px;color:var(--muted);
  margin-bottom:18px;display:flex;align-items:center;gap:10px}
.card-title::after{content:'';flex:1;height:1px;background:var(--border)}
label{display:block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--muted);margin-bottom:6px}
input[type=text]{width:100%;background:rgba(59,130,246,.04);border:1px solid var(--border2);border-radius:8px;
  color:var(--accent);font-family:'JetBrains Mono',monospace;font-size:14px;padding:11px 14px;outline:none;
  transition:border-color .2s,box-shadow .2s;margin-bottom:16px}
input[type=text]:focus{border-color:var(--accent);box-shadow:0 0 10px rgba(59,130,246,.2)}
input[type=text]::placeholder{color:var(--muted)}
.hint{font-size:10px;color:var(--muted);margin-top:-12px;margin-bottom:14px;font-family:'JetBrains Mono',monospace}
.btn-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  padding:18px 12px;border-radius:10px;border:1px solid var(--border);background:transparent;
  color:var(--text);font-family:'Syne',sans-serif;font-weight:700;font-size:14px;
  letter-spacing:1px;cursor:pointer;text-decoration:none;transition:all .2s}
.btn-icon{font-size:24px}
.btn-reader{border-color:var(--accent);color:var(--accent)}
.btn-reader:hover{background:rgba(59,130,246,.07);box-shadow:0 0 20px rgba(59,130,246,.25)}
.btn-writer{border-color:var(--green);color:var(--green)}
.btn-writer:hover{background:rgba(16,185,129,.07);box-shadow:0 0 20px rgba(16,185,129,.25)}
.btn-submit{width:100%;padding:13px;background:transparent;border:1px solid var(--green);
  border-radius:8px;color:var(--green);font-family:'Syne',sans-serif;font-weight:700;
  font-size:14px;letter-spacing:1px;cursor:pointer;transition:all .2s;margin-bottom:10px}
.btn-submit:hover{background:rgba(16,185,129,.08);box-shadow:0 0 18px rgba(16,185,129,.2)}
.back{display:block;text-align:center;padding:10px;border:1px solid var(--border);border-radius:8px;
  color:var(--muted);font-size:12px;letter-spacing:2px;font-family:'JetBrains Mono',monospace;
  text-decoration:none;transition:all .2s}
.back:hover{border-color:var(--accent);color:var(--accent)}
.alert-ok{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);color:var(--green);
  padding:11px 14px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;
  margin-bottom:14px;display:none}
.alert-err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);color:var(--red);
  padding:11px 14px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;
  margin-bottom:14px;display:none}
.scan-prompt{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);
  text-align:center;letter-spacing:2px;padding:12px;border:1px dashed var(--border);
  border-radius:8px;margin-bottom:14px;display:none;animation:blink 1.5s step-end infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
.data-field{background:rgba(59,130,246,.04);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px}
.data-label{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:3px;color:var(--muted);margin-bottom:5px}
.data-value{font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--accent);word-break:break-all}
.data-value.green{color:var(--green)}.data-value.orange{color:var(--warn)}
.empty{color:var(--muted);font-style:italic;font-size:12px}
.scan-ring{width:100px;height:100px;border-radius:50%;border:2px solid var(--accent);
  display:flex;align-items:center;justify-content:center;margin:0 auto 18px;position:relative;
  box-shadow:0 0 24px rgba(59,130,246,.15)}
.scan-ring::before{content:'';position:absolute;inset:-8px;border-radius:50%;
  border:1px solid rgba(59,130,246,.2);animation:spin 3s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.scan-icon{font-size:38px}
.scan-label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:2px;
  color:var(--muted);text-align:center;margin-bottom:20px;animation:blink 1.5s step-end infinite}
.prefilled-badge{display:inline-block;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);
  color:var(--green);font-size:9px;letter-spacing:2px;padding:2px 8px;border-radius:4px;
  font-family:'JetBrains Mono',monospace;margin-bottom:12px}
.ip-info{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);text-align:center;margin-top:8px}
</style></head><body>)";
}

// ── Route: Home ───────────────────────────────────────────────────────────
void handleHome() {
  currentMode  = 0;
  writePending = false;
  cardReadReady = false;

  String page = htmlHead("RFID Writer");
  page += R"(
<div class="logo">ESP8266 // MFRC522</div>
<h1>RFID WRITER</h1>
<p class="sub">select mode</p>
<div class="card">
  <div class="card-title">Choose Mode</div>
  <div class="btn-row">
    <a href="/reader" class="btn btn-reader"><span class="btn-icon">📡</span>READER</a>
    <a href="/writer" class="btn btn-writer"><span class="btn-icon">✏️</span>WRITER</a>
  </div>
</div>)";
  page += "<p class='ip-info'>Device IP: " + WiFi.localIP().toString() + "</p>";
  page += "</body></html>";
  server.send(200, "text/html", page);
}

// ── Route: Writer (blank or pre-filled via ?id=&version=) ─────────────────
void handleWriter() {
  currentMode  = 2;
  writePending = false;
  writeSuccess = false;
  writeFailed  = false;

  // Read URL params — pre-fill if provided from admin panel
  String preId      = server.hasArg("id")      ? server.arg("id")      : "";
  String preVersion = server.hasArg("version")  ? server.arg("version") : "1";
  bool   hasPreFill = (preId.length() == 24);

  // Also accept direct /write alias
  String page = htmlHead("Writer Mode");
  page += R"(<div class="logo">MODE // WRITER</div>
<h1>RFID WRITER</h1><p class="sub">enter data then scan card</p>
<div class="card">
  <div class="card-title">Write to Tag</div>)";

  if (hasPreFill) {
    page += "<div class='prefilled-badge'>✓ PRE-FILLED FROM ADMIN PANEL</div>";
  }

  page += R"(
  <div id="alertOk"  class="alert-ok">✓ Data written successfully!</div>
  <div id="alertErr" class="alert-err">✗ Write failed. Try again.</div>
  <div id="scanPrompt" class="scan-prompt">📶 NOW SCAN YOUR CARD...</div>
  <label>USER ID — MongoDB ObjectId (24 chars)</label>
  <input type="text" id="userId" maxlength="24"
    placeholder="e.g. 507f1f77bcf86cd799439011"
    value=")" + preId + R"(">
  <div class="hint">Must be exactly 24 characters</div>
  <label>CARD VERSION</label>
  <input type="text" id="cardVersion" maxlength="8"
    placeholder="1"
    value=")" + preVersion + R"(">
  <div class="hint">Default is 1. Only change after a card upgrade.</div>
  <button class="btn-submit" onclick="submitWrite()">⚡ PREPARE WRITE</button>
  <a href="/" class="back">← Back to Home</a>
</div>
<script>
function submitWrite() {
  var uid = document.getElementById('userId').value.trim();
  var ver = document.getElementById('cardVersion').value.trim() || '1';
  if (uid.length !== 24) { alert('User ID must be exactly 24 characters'); return; }
  fetch('/api/write?userId=' + encodeURIComponent(uid) + '&cardVersion=' + encodeURIComponent(ver))
    .then(r => r.json())
    .then(() => {
      document.getElementById('scanPrompt').style.display = 'block';
      document.getElementById('alertOk').style.display    = 'none';
      document.getElementById('alertErr').style.display   = 'none';
      pollWrite();
    });
}
function pollWrite() {
  fetch('/api/writestatus').then(r => r.json()).then(d => {
    if (d.status === 'success') {
      document.getElementById('scanPrompt').style.display = 'none';
      document.getElementById('alertOk').style.display    = 'block';
    } else if (d.status === 'failed') {
      document.getElementById('scanPrompt').style.display = 'none';
      document.getElementById('alertErr').style.display   = 'block';
    } else { setTimeout(pollWrite, 1000); }
  }).catch(() => setTimeout(pollWrite, 1000));
}
</script>)";
  page += "</body></html>";
  server.send(200, "text/html", page);
}

// ── Route: /write alias → same as /writer with params ────────────────────
void handleWriteAlias() {
  handleWriter(); // params forwarded automatically via server.arg()
}

// ── Route: Reader ─────────────────────────────────────────────────────────
void handleReader() {
  currentMode   = 1;
  cardReadReady = false;

  String page = htmlHead("Reader Mode");
  page += R"(<div class="logo">MODE // READER</div>
<h1>RFID READER</h1><p class="sub">bring card close to scanner</p>
<div class="card">
  <div class="scan-ring"><span class="scan-icon">📶</span></div>
  <div class="scan-label" id="scanLabel">WAITING FOR CARD...</div>
  <div class="data-field">
    <div class="data-label">CARD UID</div>
    <div class="data-value orange" id="valUID"><span class="empty">— scan a card —</span></div>
  </div>
  <div class="data-field">
    <div class="data-label">USER ID (MongoDB ObjectId)</div>
    <div class="data-value" id="valUserID"><span class="empty">— scan a card —</span></div>
  </div>
  <div class="data-field">
    <div class="data-label">CARD VERSION</div>
    <div class="data-value green" id="valVersion"><span class="empty">— scan a card —</span></div>
  </div>
  <a href="/" class="back" style="margin-top:8px">← Back to Home</a>
</div>
<script>
function poll() {
  fetch('/api/read').then(r=>r.json()).then(d=>{
    if(d.ready){
      document.getElementById('scanLabel').textContent = 'CARD DETECTED';
      document.getElementById('valUID').textContent    = d.uid     || '—';
      document.getElementById('valUserID').textContent = d.userId  || '(empty)';
      document.getElementById('valVersion').textContent= d.cardVersion||'(empty)';
      setTimeout(()=>{ document.getElementById('scanLabel').textContent='WAITING FOR CARD...'; },3000);
    }
  }).catch(()=>{});
}
setInterval(poll,1000);
</script>)";
  page += "</body></html>";
  server.send(200, "text/html", page);
}

// ── API: Read poll ────────────────────────────────────────────────────────
void handleApiRead() {
  String json = "{\"ready\":" + String(cardReadReady ? "true" : "false");
  json += ",\"uid\":\"" + readUID + "\"";
  json += ",\"userId\":\"" + readUserId + "\"";
  json += ",\"cardVersion\":\"" + readCardVersion + "\"}";
  if (cardReadReady) cardReadReady = false;
  server.send(200, "application/json", json);
}

// ── API: Queue write ──────────────────────────────────────────────────────
void handleApiWrite() {
  if (server.hasArg("userId") && server.hasArg("cardVersion")) {
    writeUserId      = server.arg("userId");
    writeCardVersion = server.arg("cardVersion");
    if (writeCardVersion.length() == 0) writeCardVersion = "1";
    writePending = true;
    writeSuccess = false;
    writeFailed  = false;
    server.send(200, "application/json", "{\"status\":\"pending\"}");
  } else {
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Missing userId or cardVersion\"}");
  }
}

// ── API: Write status poll ────────────────────────────────────────────────
void handleApiWriteStatus() {
  String s = "pending";
  if (writeSuccess) s = "success";
  else if (writeFailed) s = "failed";
  server.send(200, "application/json", "{\"status\":\"" + s + "\"}");
}

// ── RFID Helpers ──────────────────────────────────────────────────────────
bool authenticateSector(byte blockAddr) {
  byte trailer = (blockAddr / 4) * 4 + 3;
  return mfrc522.PCD_Authenticate(0x60, trailer, &key, &(mfrc522.uid)) == 0;
}
bool readBlock(byte blockAddr, byte* buf) {
  byte size = 18; byte tmp[18];
  if (mfrc522.MIFARE_Read(blockAddr, tmp, &size) != 0) return false;
  for (byte i = 0; i < 16; i++) buf[i] = tmp[i];
  return true;
}
bool writeBlock(byte blockAddr, byte* data) {
  if (!authenticateSector(blockAddr)) return false;
  return mfrc522.MIFARE_Write(blockAddr, data, 16) == 0;
}
void stringToBlock(const String& str, byte* out) {
  for (byte i = 0; i < 16; i++) out[i] = (i < str.length()) ? (byte)str[i] : 0x00;
}
String blockToString(byte* buf) {
  String r = "";
  for (byte i = 0; i < 16; i++) if (buf[i] >= 32 && buf[i] <= 126) r += (char)buf[i];
  return r;
}
void halt() { mfrc522.PICC_HaltA(); mfrc522.PCD_StopCrypto1(); }

// ── RFID: Do Read ─────────────────────────────────────────────────────────
void doRead() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial())   return;

  readUID = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) readUID += "0";
    readUID += String(mfrc522.uid.uidByte[i], HEX);
    if (i < mfrc522.uid.size - 1) readUID += ":";
  }
  readUID.toUpperCase();

  byte buf1[16], buf2[16], buf3[16];
  readUserId = "";
  if (readBlock(BLOCK_USER_ID_1, buf1) && readBlock(BLOCK_USER_ID_2, buf2)) {
    for (byte i = 0; i < 16; i++) if (buf1[i] >= 32 && buf1[i] <= 126) readUserId += (char)buf1[i];
    for (byte i = 0; i < 8;  i++) if (buf2[i] >= 32 && buf2[i] <= 126) readUserId += (char)buf2[i];
  }
  readUserId.trim();

  readCardVersion = "";
  if (readBlock(BLOCK_VERSION, buf3))
    readCardVersion = blockToString(buf3);
  readCardVersion.trim();

  cardReadReady = true;
  halt();
}

// ── RFID: Do Write ────────────────────────────────────────────────────────
void doWrite() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial())   return;

  byte blk4[16] = {0}, blk5[16] = {0}, blk6[16] = {0};
  stringToBlock(writeUserId.substring(0, 16), blk4);
  stringToBlock(writeUserId.substring(16, 24), blk5);
  stringToBlock(writeCardVersion, blk6);

  bool ok = writeBlock(BLOCK_USER_ID_1, blk4)
         && writeBlock(BLOCK_USER_ID_2, blk5)
         && writeBlock(BLOCK_VERSION,   blk6);

  if (ok) { writeSuccess = true; Serial.println(F("Write OK")); }
  else    { writeFailed  = true; Serial.println(F("Write FAILED")); }

  writePending = false;
  halt();
}

// ── Setup ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  while (!Serial);

  mfrc522.PCD_Init();
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF;

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print(F("Connecting"));
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print(F(".")); }
  Serial.println();
  Serial.print(F("IP: ")); Serial.println(WiFi.localIP());

  server.on("/",              handleHome);
  server.on("/reader",        handleReader);
  server.on("/writer",        handleWriter);
  server.on("/write",         handleWriteAlias);   // ← /write?id=&version= from admin panel
  server.on("/api/read",      handleApiRead);
  server.on("/api/write",     handleApiWrite);
  server.on("/api/writestatus", handleApiWriteStatus);
  server.begin();

  Serial.println(F("Web server started."));
  Serial.println(F("Admin panel will open /write?id=<objectId>&version=<v> here."));
}

// ── Loop ──────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();
  if      (currentMode == 1)                doRead();
  else if (currentMode == 2 && writePending) doWrite();
}
