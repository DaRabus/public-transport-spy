// Cross-stack contract test: renders the backend-generated fixture (screens.fixture.json, pinned by
// api/src/modules/device/screens/screen-composer.contract.spec.ts) through the device's own row logic.
#include <unity.h>
#include <fstream>
#include <sstream>
#include <string>
#include "screen_logic.h"

static const time_t NOW = 1780000000;  // same instant the backend fixture was composed at
static JsonDocument fixture;
static bool fixtureLoaded = false;

static std::string utcHHMM(long ts) {
  time_t t = ts;
  struct tm parts;
  gmtime_r(&t, &parts);
  char buf[6];
  strftime(buf, sizeof(buf), "%H:%M", &parts);
  return buf;
}

static JsonObjectConst listOn(int page) {
  for (JsonObjectConst w : fixture["pages"][page]["widgets"].as<JsonArrayConst>()) {
    if (std::string(w["t"] | "") == "list") return w;
  }
  return JsonObjectConst();
}

void setUp() {}
void tearDown() {}

void test_fixture_loads() {
  TEST_ASSERT_TRUE_MESSAGE(fixtureLoaded, "screens.fixture.json missing or invalid");
  TEST_ASSERT_EQUAL(4, fixture["pages"].size());
}

void test_fixture_within_limits_and_vocabulary() {
  for (JsonObjectConst page : fixture["pages"].as<JsonArrayConst>()) {
    long duration = page["durationMs"] | 0L;
    TEST_ASSERT_TRUE(duration >= 2000 && duration <= 300000);
    JsonArrayConst widgets = page["widgets"];
    TEST_ASSERT_TRUE(widgets.size() <= (size_t)MAX_WIDGETS);
    for (JsonObjectConst w : widgets) {
      std::string type = w["t"] | "";
      TEST_ASSERT_TRUE_MESSAGE(isKnownWidget(type), type.c_str());
      if (w["font"].is<const char*>()) TEST_ASSERT_TRUE_MESSAGE(isKnownFont(w["font"] | ""), w["font"] | "");
      int y = w["y"] | 0;
      TEST_ASSERT_TRUE(y >= 0 && y <= 63);
      if (type == "list") {
        TEST_ASSERT_TRUE(y + ((w["maxRows"] | 0) - 1) * (w["rowH"] | 0) <= 63);
        TEST_ASSERT_TRUE(w["items"].size() <= (size_t)MAX_LIST_ITEMS);
        for (JsonObjectConst col : w["cols"].as<JsonArrayConst>()) {
          TEST_ASSERT_TRUE((col["x"] | 0) + (col["w"] | 0) <= 256);
        }
      }
    }
  }
}

void test_default_board_rows_and_countdowns() {
  auto rows = visibleListRows(listOn(0), NOW + 10, true, utcHHMM);
  TEST_ASSERT_EQUAL(3, rows.size());
  TEST_ASSERT_EQUAL_STRING("Now", rows[0][0].text.c_str());  // S2 leaves in 50 s
  TEST_ASSERT_EQUAL_STRING("S2", rows[0][1].text.c_str());
  TEST_ASSERT_EQUAL_STRING("Zürich Flughafen", rows[0][2].text.c_str());
  TEST_ASSERT_EQUAL_STRING("2'", rows[1][0].text.c_str());
  TEST_ASSERT_EQUAL_STRING("IR 36", rows[1][1].text.c_str());
}

void test_rows_shift_up_offline_as_departures_leave() {
  // 4 min later without any new fetch: S2 and IR 36 are gone and B32 moves to the top.
  auto rows = visibleListRows(listOn(0), NOW + 4 * 60 + 10, true, utcHHMM);
  TEST_ASSERT_EQUAL(3, rows.size());
  TEST_ASSERT_EQUAL_STRING("1'", rows[0][0].text.c_str());
  TEST_ASSERT_EQUAL_STRING("B32", rows[0][1].text.c_str());
}

void test_platform_delay_time_and_walking_page() {
  auto rows = visibleListRows(listOn(1), NOW, true, utcHHMM);
  TEST_ASSERT_EQUAL(4, rows.size());
  TEST_ASSERT_EQUAL_STRING(utcHHMM(NOW + 180).c_str(), rows[0][0].text.c_str());  // absolute time column
  TEST_ASSERT_EQUAL_STRING("IR 36", rows[0][1].text.c_str());                     // S2 dropped: 2 min walk
  TEST_ASSERT_EQUAL_STRING("7", rows[0][2].text.c_str());
  TEST_ASSERT_EQUAL_STRING("Basel SBB", rows[0][3].text.c_str());
  TEST_ASSERT_EQUAL_STRING("right", rows[0][4].align.c_str());
  // Two minutes later IR 36 leaves in 1 min, less than the walk: hidden on the device as well.
  auto later = visibleListRows(listOn(1), NOW + 120, true, utcHHMM);
  TEST_ASSERT_EQUAL_STRING("B32", later[0][1].text.c_str());
}

void test_unsynced_clock_shows_dashes() {
  auto rows = visibleListRows(listOn(0), 0, false, utcHHMM);
  TEST_ASSERT_EQUAL_STRING("--", rows[0][0].text.c_str());
}

static bool loadFixture() {
  std::string here = __FILE__;
  std::string candidates[] = {here.substr(0, here.find_last_of('/') + 1) + "screens.fixture.json",
                              "test/test_contract/screens.fixture.json"};
  for (const std::string& path : candidates) {
    std::ifstream in(path);
    if (!in) continue;
    std::stringstream buf;
    buf << in.rdbuf();
    return !deserializeJson(fixture, buf.str());
  }
  return false;
}

int main() {
  fixtureLoaded = loadFixture();
  UNITY_BEGIN();
  RUN_TEST(test_fixture_loads);
  if (fixtureLoaded) {
    RUN_TEST(test_fixture_within_limits_and_vocabulary);
    RUN_TEST(test_default_board_rows_and_countdowns);
    RUN_TEST(test_rows_shift_up_offline_as_departures_leave);
    RUN_TEST(test_platform_delay_time_and_walking_page);
    RUN_TEST(test_unsynced_clock_shows_dashes);
  }
  return UNITY_END();
}
