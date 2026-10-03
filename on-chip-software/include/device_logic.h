#pragma once
// Pure decision helpers shared by main.cpp, display.cpp and the host unit tests (pio test -e native).
// No Arduino headers here, so everything in this file runs on a PC.
#include <ctime>
#include <string>

enum class ClaimAction { Success, Retry, NewCode, Blocked };
enum class ConfigAction { Apply, AuthFailure, Disabled, Transient };
enum class ButtonAction { None, Hint, OpenPortal, FactoryReset };

// Screen contract limits (mirrored by the backend's screen composer).
const int MAX_PAGES = 6;
const int MAX_WIDGETS = 24;
const int MAX_LIST_ITEMS = 10;
const int AUTH_FAILURES_BEFORE_RESET = 3;

// POST <DEVICE_API>/claim. 400 = code expired, 409 = code bound to another device: show a new code.
// 403 = this hardware UUID is registered to another account: keep polling, the owner can release it.
// Anything else (404 = not entered yet, network errors, 5xx): keep polling with the same code.
inline ClaimAction claimActionFor(int httpCode) {
  if (httpCode == 200) return ClaimAction::Success;
  if (httpCode == 400 || httpCode == 409) return ClaimAction::NewCode;
  if (httpCode == 403) return ClaimAction::Blocked;
  return ClaimAction::Retry;
}

// GET <DEVICE_API>/config. 401/404: the backend no longer accepts our token. 403: disabled by the owner.
inline ConfigAction configActionFor(int httpCode) {
  if (httpCode == 200) return ConfigAction::Apply;
  if (httpCode == 401 || httpCode == 404) return ConfigAction::AuthFailure;
  if (httpCode == 403) return ConfigAction::Disabled;
  return ConfigAction::Transient;
}

// A broken backend deploy must not wipe every display in the field: give up the token only after
// several consecutive rejections (~15 min at the default 5 min interval).
inline bool shouldResetIdentity(int consecutiveAuthFailures) {
  return consecutiveAuthFailures >= AUTH_FAILURES_BEFORE_RESET;
}

// Before NTP sync, time() is ~1970. Anything before Nov 2023 means "not synced yet".
inline bool isTimeValid(time_t now) { return now > 1700000000; }

// A departure list is running out of rows: refetch early, at most every 30 s. Only when items actually
// expired (fetched > upcoming); a quiet station with 2 departures has nothing more to give.
inline bool shouldFetchEarly(int upcoming, int fetched, int maxRows, unsigned long msSinceLastFetch) {
  return upcoming < maxRows && fetched > upcoming && msSinceLastFetch >= 30000UL;
}

// List rows: hidden once a departure is more than a minute gone, or when it leaves sooner than the
// walking time (leadSec). Without a synced clock we can't tell, so everything stays visible.
inline bool listItemVisible(long ts, time_t now, long leadSec, bool timeOk) {
  if (!timeOk) return true;
  long secondsLeft = ts - (long)now;
  return secondsLeft >= (leadSec > 0 ? leadSec : -59);
}

// "Now" for the current minute, otherwise whole minutes left: 7'
inline std::string formatCountdown(long ts, time_t now) {
  long minutes = (ts - (long)now) / 60;  // truncates toward zero, so -59 s..+59 s = "Now"
  return minutes <= 0 ? std::string("Now") : std::to_string(minutes) + "'";
}

// Widget anchor -> left edge. "right" anchors the text's right edge at x, "center" its middle.
inline int alignedX(int x, int width, const char* align) {
  std::string a = align ? align : "";
  if (a == "right") return x - width;
  if (a == "center") return x - width / 2;
  return x;
}

// Display on/off schedule (local time). minuteOfDay 0-1439, weekday 0 = Sunday (tm_wday).
// The window belongs to the weekday it starts on, so 18:00-02:00 on Friday also covers early Saturday.
// on == off means on all day for the selected weekdays. dayBits: bit 0 = Sunday ... bit 6 = Saturday.
inline bool isWithinSchedule(int minuteOfDay, int weekday, int on, int off, int dayBits) {
  auto selected = [dayBits](int day) { return (dayBits >> ((day + 7) % 7)) & 1; };
  if (on == off) return selected(weekday);
  if (on < off) return selected(weekday) && minuteOfDay >= on && minuteOfDay < off;
  return (selected(weekday) && minuteOfDay >= on) || (selected(weekday - 1) && minuteOfDay < off);
}

inline int nextPage(int current, int count) {
  return count <= 0 ? 0 : (current + 1) % count;
}

// Server-supplied intervals are clamped so a bad value can't hammer the API or freeze the screen.
inline unsigned long clampMs(long value, unsigned long lo, unsigned long hi, unsigned long fallback) {
  if (value <= 0) return fallback;
  if ((unsigned long)value < lo) return lo;
  if ((unsigned long)value > hi) return hi;
  return (unsigned long)value;
}

// Trims whitespace and trailing slashes. Returns "" for anything that isn't an http(s) URL.
inline std::string normalizeBaseUrl(std::string url) {
  const char* ws = " \t\r\n";
  size_t start = url.find_first_not_of(ws);
  if (start == std::string::npos) return "";
  url = url.substr(start, url.find_last_not_of(ws) - start + 1);
  while (!url.empty() && url.back() == '/') url.pop_back();
  bool http = url.rfind("http://", 0) == 0 && url.size() > 7;
  bool https = url.rfind("https://", 0) == 0 && url.size() > 8;
  return (http || https) ? url : "";
}

// Night window may wrap midnight (23 -> 6). from == to disables night mode.
inline bool isNightHour(int hour, int from, int to) {
  if (from == to) return false;
  return from < to ? (hour >= from && hour < to) : (hour >= from || hour < to);
}

// BOOT button: short press (<2 s) opens the Wi-Fi portal, 3 s shows a warning, 10 s factory-resets.
inline ButtonAction buttonActionFor(unsigned long heldMs, bool released) {
  if (released) return (heldMs >= 50 && heldMs < 2000) ? ButtonAction::OpenPortal : ButtonAction::None;
  if (heldMs >= 10000) return ButtonAction::FactoryReset;
  if (heldMs >= 3000) return ButtonAction::Hint;
  return ButtonAction::None;
}

// Drops whole UTF-8 characters from the end until the text fits maxWidth pixels.
inline std::string truncateToFit(std::string text, int maxWidth, int (*widthOf)(const char*)) {
  while (!text.empty() && widthOf(text.c_str()) > maxWidth) {
    while (!text.empty() && (static_cast<unsigned char>(text.back()) & 0xC0) == 0x80) text.pop_back();
    if (!text.empty()) text.pop_back();
  }
  return text;
}
