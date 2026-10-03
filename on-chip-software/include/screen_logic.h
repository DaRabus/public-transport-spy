#pragma once
// Row logic for the "list" widget, shared by the renderer (display.cpp) and the native contract test,
// which feeds it the backend-generated fixture. Needs ArduinoJson but no Arduino or U8g2 headers.
#include <ArduinoJson.h>
#include <string>
#include <vector>
#include "device_logic.h"

struct ListCell {
  int x;      // anchor x for drawing (right edge for "right", middle for "center")
  int width;  // column width the text is truncated to
  std::string align;
  std::string text;
};

// Formats a departure timestamp as HH:MM (local time on the device, injectable for tests).
typedef std::string (*TimeFormatter)(long ts);

// The rows a list widget shows right now: expired and uncatchable items skipped, at most maxRows.
inline std::vector<std::vector<ListCell>> visibleListRows(JsonObjectConst list, time_t now, bool timeOk, TimeFormatter hhmm) {
  std::vector<std::vector<ListCell>> rows;
  int maxRows = list["maxRows"] | 3;
  long leadSec = list["leadSec"] | 0L;
  int seen = 0;

  for (JsonObjectConst item : list["items"].as<JsonArrayConst>()) {
    if ((int)rows.size() >= maxRows || ++seen > MAX_LIST_ITEMS) break;
    long ts = item["ts"] | 0L;
    if (!listItemVisible(ts, now, leadSec, timeOk)) continue;

    JsonArrayConst cells = item["cells"];
    size_t cell = 0;
    std::vector<ListCell> row;
    for (JsonObjectConst col : list["cols"].as<JsonArrayConst>()) {
      std::string kind = col["kind"] | "text";
      std::string text;
      if (kind == "countdown") {
        text = timeOk ? formatCountdown(ts, now) : "--";
      } else if (kind == "time") {
        text = hhmm(ts);
      } else {
        text = cells[cell++] | "";
      }
      int x = col["x"] | 0;
      int w = col["w"] | 40;
      std::string align = col["align"] | "left";
      int anchor = align == "right" ? x + w : align == "center" ? x + w / 2 : x;
      row.push_back({anchor, w, align, text});
    }
    rows.push_back(row);
  }
  return rows;
}

// The widget vocabulary and font names this firmware draws. Anything else is skipped / falls back
// to "regular", so newer backends can't break older firmware.
inline bool isKnownWidget(const std::string& t) {
  return t == "text" || t == "clock" || t == "line" || t == "status" || t == "list";
}

inline bool isKnownFont(const std::string& f) {
  return f == "small" || f == "regular" || f == "bold" || f == "medium" || f == "large" || f == "xl" || f == "retro";
}
