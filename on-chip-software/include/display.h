#pragma once
// Display engine (src/display.cpp): owns the SSD1322 panel and draws whatever main.cpp asks for.
// It reads no firmware state; everything it shows comes in as parameters, so the state machine
// (which screen, which contrast, panel on/off) stays in main.cpp.
#include <Arduino.h>
#include <ArduinoJson.h>

static const char* const NO_WIFI_HINT = "No Wi-Fi - press button to set up";

void displayBegin();
void applyContrast(uint8_t contrast);
// Power-save blanks the OLED completely (no burn-in, lower power) without losing state.
void setPanelPower(bool on);

// One page of the server-composed layout (GET /api/v1/device/screens). noWifi swaps the empty-list
// text for NO_WIFI_HINT; showOffline draws the [OFFLINE] badge.
void renderPage(JsonArray widgets, bool noWifi, bool showOffline);
void drawPairingScreen(const String& code, const String& url, const String& status);
void drawWifiSetupScreen(const String& apName);
// Powers the panel on: messages (reset warning, loading) must be visible even while scheduled off.
void drawMessage(const char* title, const char* line);
