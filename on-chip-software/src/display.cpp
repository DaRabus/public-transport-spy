// Display engine: widget renderer, pairing / Wi-Fi setup / message screens, panel power and contrast.
// Which screen to show is decided by drawScreen() in main.cpp.
#include "display.h"
#include <time.h>
#include <U8g2lib.h>
#include <SPI.h>
#include <qrcode.h>
#include "device_logic.h"
#include "screen_logic.h"

// U8g2 Hardware SPI Constructor for SSD1322 (NHD 256x64 standard panel)
static U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, /* cs=*/ 5, /* dc=*/ 2, /* reset=*/ 4);

static int currentContrast = -1;
static bool panelOn = true;

void displayBegin() {
  u8g2.begin();
  u8g2.enableUTF8Print();
}

void applyContrast(uint8_t contrast) {
  if (contrast == currentContrast) return;
  currentContrast = contrast;
  u8g2.setContrast(contrast);
}

void setPanelPower(bool on) {
  if (on == panelOn) return;
  panelOn = on;
  u8g2.setPowerSave(on ? 0 : 1);
}

static int utf8Width(const char* s) {
  return (int)u8g2.getUTF8Width(s);
}

// Draws text cut to maxWidth, anchored at x per align ("left" | "center" | "right").
static void drawAligned(int x, int y, const String& text, int maxWidth, const char* align) {
  std::string fitted = truncateToFit(text.c_str(), maxWidth, utf8Width);
  u8g2.drawUTF8(alignedX(x, utf8Width(fitted.c_str()), align), y, fitted.c_str());
}

static void drawFitted(int x, int y, const String& text, int maxWidth) {
  drawAligned(x, y, text, maxWidth, "left");
}

// Fonts the screen contract may name. Anything this firmware doesn't know falls back to "regular".
static const uint8_t* fontFor(const char* name) {
  if (strcmp(name, "small") == 0) return u8g2_font_5x7_tf;
  if (strcmp(name, "bold") == 0) return u8g2_font_helvB08_tf;
  if (strcmp(name, "medium") == 0) return u8g2_font_helvB10_tf;
  if (strcmp(name, "large") == 0) return u8g2_font_helvB12_tf;
  if (strcmp(name, "xl") == 0) return u8g2_font_helvB24_tf;
  if (strcmp(name, "retro") == 0) return u8g2_font_pressstart2p_8f;
  return u8g2_font_helvR08_tf;
}

static std::string localHHMM(long ts) {
  time_t departure = ts;
  struct tm local;
  localtime_r(&departure, &local);
  char hhmm[6];
  strftime(hhmm, sizeof(hhmm), "%H:%M", &local);
  return hhmm;
}

// Row selection lives in screen_logic.h (shared with the native contract test); this only draws.
static void drawList(JsonObject w, int sx, int sy, time_t now, bool timeOk, bool noWifi) {
  u8g2.setFont(fontFor(w["font"] | "regular"));
  int y = (w["y"] | 30) + sy;
  int rowH = w["rowH"] | 16;

  std::vector<std::vector<ListCell>> rows = visibleListRows(w, now, timeOk, localHHMM);
  for (size_t r = 0; r < rows.size(); r++) {
    for (const ListCell& c : rows[r]) {
      drawAligned(c.x + sx, y + (int)r * rowH, String(c.text.c_str()), c.width, c.align.c_str());
    }
  }

  if (rows.empty()) {
    drawFitted(sx, y, noWifi ? String(NO_WIFI_HINT) : String(w["empty"] | "No departures"), 254);
  }
}

// Widget vocabulary: text, clock, line, status, list. Unknown widget types are skipped so newer
// backends can't break older firmware.
void renderPage(JsonArray widgets, bool noWifi, bool showOffline) {
  time_t now = time(nullptr);
  bool timeOk = isTimeValid(now);
  struct tm local;
  localtime_r(&now, &local);

  // Shift everything a few pixels over time so static text doesn't burn into the OLED.
  int sx = (millis() / 300000UL) % 3;
  int sy = (millis() / 900000UL) % 2;
  bool statusDrawn = false;
  int drawn = 0;

  u8g2.clearBuffer();
  for (JsonObject w : widgets) {
    if (++drawn > MAX_WIDGETS) break;
    const char* type = w["t"] | "";
    const char* align = w["align"] | "left";
    int x = (w["x"] | 0) + sx;
    int y = (w["y"] | 0) + sy;

    if (strcmp(type, "text") == 0) {
      u8g2.setFont(fontFor(w["font"] | "regular"));
      drawAligned(x, y, String(w["text"] | ""), w["w"] | 256, align);
    } else if (strcmp(type, "clock") == 0) {
      const char* format = w["format"] | "%H:%M";
      char text[32] = "--:--";
      if (timeOk) {
        strftime(text, sizeof(text), format, &local);
      } else if (!strstr(format, "%H")) {
        text[0] = '\0';  // a date without a synced clock would be 1970: show nothing
      }
      u8g2.setFont(fontFor(w["font"] | "regular"));
      drawAligned(x, y, String(text), 256, align);
    } else if (strcmp(type, "line") == 0) {
      int h = w["h"] | 0;
      if (h > 0) {
        u8g2.drawVLine(x, y, h);
      } else {
        u8g2.drawHLine(x, y, w["w"] | 256);
      }
    } else if (strcmp(type, "status") == 0) {
      statusDrawn = true;
      if (showOffline) {
        u8g2.setFont(u8g2_font_helvR08_tf);
        drawAligned(x, y, "[OFFLINE]", 256, align);
      }
    } else if (strcmp(type, "list") == 0) {
      drawList(w, sx, sy, now, timeOk, noWifi);
    }
  }

  if (showOffline && !statusDrawn) {
    u8g2.setFont(u8g2_font_helvR08_tf);
    drawAligned(254 + sx, 10 + sy, "[OFFLINE]", 256, "right");
  }
  u8g2.sendBuffer();
}

static void drawQr(const String& url) {
  // Version 3 = 29x29 modules, holds 53 bytes in low ECC
  uint8_t version = 3;
  if (url.length() > 53 && url.length() <= 78) {
    version = 4;
  } else if (url.length() > 78) {
    version = 5;
  }
  int scale = (version <= 3) ? 2 : 1;

  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(version)];
  if (qrcode_initText(&qrcode, qrcodeData, version, ECC_LOW, url.c_str()) != 0) return;

  int qrPixelSize = qrcode.size * scale;
  int yOffset = (64 - qrPixelSize) / 2;
  int xOffset = 3;
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        u8g2.drawBox(xOffset + x * scale, yOffset + y * scale, scale, scale);
      }
    }
  }
}

void drawPairingScreen(const String& code, const String& url, const String& status) {
  u8g2.clearBuffer();

  if (url.length() > 0) drawQr(url);
  u8g2.drawVLine(65, 0, 64);

  u8g2.setFont(u8g2_font_helvB10_tf);
  u8g2.drawUTF8(72, 14, "PAIR DEVICE");

  u8g2.setFont(u8g2_font_helvR08_tf);
  u8g2.drawUTF8(72, 27, url.length() > 0 ? "Scan QR or enter code:" : "Enter code in the app:");

  // Display code as ABC-123
  String shownCode = code.length() == 6 ? code.substring(0, 3) + "-" + code.substring(3) : code;
  u8g2.setFont(u8g2_font_helvB12_tf);
  u8g2.drawUTF8(72, 45, shownCode.length() > 0 ? shownCode.c_str() : "---");

  u8g2.setFont(u8g2_font_helvR08_tf);
  drawFitted(72, 59, status.length() > 0 ? status : String("Waiting for pairing..."), 256 - 72);

  u8g2.sendBuffer();
}

void drawWifiSetupScreen(const String& apName) {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_helvB10_tf);
  u8g2.drawUTF8(0, 14, "Wi-Fi Setup");
  u8g2.setFont(u8g2_font_helvR08_tf);
  u8g2.drawUTF8(0, 32, "On your phone, join the Wi-Fi network:");
  u8g2.setFont(u8g2_font_helvB08_tf);
  u8g2.drawUTF8(0, 46, apName.c_str());
  u8g2.setFont(u8g2_font_helvR08_tf);
  u8g2.drawUTF8(0, 62, "No page? Open http://192.168.4.1");
  u8g2.sendBuffer();
}

void drawMessage(const char* title, const char* line) {
  setPanelPower(true);
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_helvB10_tf);
  u8g2.drawUTF8(0, 24, title);
  u8g2.setFont(u8g2_font_helvR08_tf);
  u8g2.drawUTF8(0, 44, line);
  u8g2.sendBuffer();
}
