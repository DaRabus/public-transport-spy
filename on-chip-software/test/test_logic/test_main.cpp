#include <unity.h>
#include <cstring>
#include "device_logic.h"

// 6 px per byte keeps the width math obvious; "ü" is 2 bytes = 12 px.
static int byteWidth(const char* s) { return (int)strlen(s) * 6; }

void setUp() {}
void tearDown() {}

void test_claim_actions() {
  TEST_ASSERT_TRUE(claimActionFor(200) == ClaimAction::Success);
  TEST_ASSERT_TRUE(claimActionFor(400) == ClaimAction::NewCode);   // code expired on the backend
  TEST_ASSERT_TRUE(claimActionFor(409) == ClaimAction::NewCode);   // code bound to another device
  TEST_ASSERT_TRUE(claimActionFor(404) == ClaimAction::Retry);     // not entered in the app yet
  TEST_ASSERT_TRUE(claimActionFor(-1) == ClaimAction::Retry);      // connection refused / DNS failure
  TEST_ASSERT_TRUE(claimActionFor(503) == ClaimAction::Retry);
  TEST_ASSERT_TRUE(claimActionFor(403) == ClaimAction::Blocked);   // registered to another account
}

void test_config_actions() {
  TEST_ASSERT_TRUE(configActionFor(200) == ConfigAction::Apply);
  TEST_ASSERT_TRUE(configActionFor(401) == ConfigAction::AuthFailure);
  TEST_ASSERT_TRUE(configActionFor(404) == ConfigAction::AuthFailure);
  TEST_ASSERT_TRUE(configActionFor(403) == ConfigAction::Disabled);
  TEST_ASSERT_TRUE(configActionFor(500) == ConfigAction::Transient);
  TEST_ASSERT_TRUE(configActionFor(-1) == ConfigAction::Transient);
  TEST_ASSERT_TRUE(configActionFor(-2) == ConfigAction::Transient);  // our own "bad JSON" code
}

void test_reset_needs_consecutive_failures() {
  TEST_ASSERT_FALSE(shouldResetIdentity(1));
  TEST_ASSERT_FALSE(shouldResetIdentity(2));
  TEST_ASSERT_TRUE(shouldResetIdentity(3));
}

void test_time_validity() {
  TEST_ASSERT_FALSE(isTimeValid(0));
  TEST_ASSERT_FALSE(isTimeValid(86400));
  TEST_ASSERT_TRUE(isTimeValid(1780000000));
}

void test_early_fetch() {
  // shouldFetchEarly(upcoming, fetched, maxRows, msSinceLastFetch)
  TEST_ASSERT_TRUE(shouldFetchEarly(2, 10, 3, 30000));    // rows are running out, server had more
  TEST_ASSERT_FALSE(shouldFetchEarly(2, 10, 3, 29999));   // rate limit
  TEST_ASSERT_FALSE(shouldFetchEarly(3, 10, 3, 600000));  // all rows still filled
  TEST_ASSERT_FALSE(shouldFetchEarly(2, 2, 3, 600000));   // quiet station: nothing expired, nothing more to get
  TEST_ASSERT_TRUE(shouldFetchEarly(1, 2, 3, 30000));     // one expired: ask once for a replacement
}

void test_list_item_visibility() {
  const time_t now = 1780000000;
  TEST_ASSERT_TRUE(listItemVisible(now + 600, now, 0, true));
  TEST_ASSERT_TRUE(listItemVisible(now - 30, now, 0, true));    // still shown as "Now" for <1 min
  TEST_ASSERT_FALSE(listItemVisible(now - 60, now, 0, true));   // gone
  TEST_ASSERT_FALSE(listItemVisible(now + 179, now, 180, true)); // can't make it with a 3 min walk
  TEST_ASSERT_TRUE(listItemVisible(now + 180, now, 180, true));
  TEST_ASSERT_TRUE(listItemVisible(now - 9999, now, 0, false)); // clock not synced: show everything
}

void test_countdown_text() {
  const time_t now = 1780000000;
  TEST_ASSERT_EQUAL_STRING("Now", formatCountdown(now + 59, now).c_str());
  TEST_ASSERT_EQUAL_STRING("Now", formatCountdown(now - 20, now).c_str());
  TEST_ASSERT_EQUAL_STRING("1'", formatCountdown(now + 60, now).c_str());
  TEST_ASSERT_EQUAL_STRING("12'", formatCountdown(now + 12 * 60 + 30, now).c_str());
}

void test_schedule_window() {
  const int SUN = 0, MON = 1, FRI = 5, SAT = 6;
  const int WEEKDAYS = 0b0111110;   // Mon-Fri
  // Same-day window 06:00-23:00 on weekdays.
  TEST_ASSERT_TRUE(isWithinSchedule(6 * 60, MON, 360, 1380, WEEKDAYS));
  TEST_ASSERT_FALSE(isWithinSchedule(5 * 60 + 59, MON, 360, 1380, WEEKDAYS));
  TEST_ASSERT_FALSE(isWithinSchedule(23 * 60, MON, 360, 1380, WEEKDAYS));   // off time is exclusive
  TEST_ASSERT_FALSE(isWithinSchedule(12 * 60, SAT, 360, 1380, WEEKDAYS));   // weekend not selected
  // Overnight window 18:00-02:00 starting Friday only: covers early Saturday, not early Friday.
  const int FRI_ONLY = 1 << FRI;
  TEST_ASSERT_TRUE(isWithinSchedule(23 * 60, FRI, 1080, 120, FRI_ONLY));
  TEST_ASSERT_TRUE(isWithinSchedule(1 * 60, SAT, 1080, 120, FRI_ONLY));
  TEST_ASSERT_FALSE(isWithinSchedule(1 * 60, FRI, 1080, 120, FRI_ONLY));
  TEST_ASSERT_FALSE(isWithinSchedule(3 * 60, SAT, 1080, 120, FRI_ONLY));
  // on == off: on all day for the selected weekdays.
  TEST_ASSERT_TRUE(isWithinSchedule(0, SUN, 0, 0, 1 << SUN));
  TEST_ASSERT_FALSE(isWithinSchedule(0, MON, 0, 0, 1 << SUN));
}

void test_alignment_and_rotation() {
  TEST_ASSERT_EQUAL_INT(10, alignedX(10, 40, "left"));
  TEST_ASSERT_EQUAL_INT(108, alignedX(128, 40, "center"));
  TEST_ASSERT_EQUAL_INT(214, alignedX(254, 40, "right"));
  TEST_ASSERT_EQUAL_INT(10, alignedX(10, 40, "diagonal"));  // unknown = left
  TEST_ASSERT_EQUAL_INT(1, nextPage(0, 3));
  TEST_ASSERT_EQUAL_INT(0, nextPage(2, 3));
  TEST_ASSERT_EQUAL_INT(0, nextPage(5, 0));
}

void test_clamp() {
  TEST_ASSERT_EQUAL_UINT32(300000, clampMs(0, 5000, 3600000, 300000));
  TEST_ASSERT_EQUAL_UINT32(300000, clampMs(-5, 5000, 3600000, 300000));
  TEST_ASSERT_EQUAL_UINT32(5000, clampMs(1000, 5000, 3600000, 300000));
  TEST_ASSERT_EQUAL_UINT32(3600000, clampMs(99999999, 5000, 3600000, 300000));
  TEST_ASSERT_EQUAL_UINT32(60000, clampMs(60000, 5000, 3600000, 300000));
}

void test_normalize_url() {
  TEST_ASSERT_EQUAL_STRING("https://api.example.ch", normalizeBaseUrl("  https://api.example.ch/ \n").c_str());
  TEST_ASSERT_EQUAL_STRING("http://192.168.1.10:7778", normalizeBaseUrl("http://192.168.1.10:7778//").c_str());
  TEST_ASSERT_EQUAL_STRING("", normalizeBaseUrl("api.example.ch").c_str());
  TEST_ASSERT_EQUAL_STRING("", normalizeBaseUrl("").c_str());
  TEST_ASSERT_EQUAL_STRING("", normalizeBaseUrl("https://").c_str());
}

void test_night_hours() {
  TEST_ASSERT_TRUE(isNightHour(23, 23, 6));
  TEST_ASSERT_TRUE(isNightHour(2, 23, 6));
  TEST_ASSERT_FALSE(isNightHour(6, 23, 6));
  TEST_ASSERT_FALSE(isNightHour(12, 23, 6));
  TEST_ASSERT_TRUE(isNightHour(3, 1, 5));
  TEST_ASSERT_FALSE(isNightHour(5, 1, 5));
  TEST_ASSERT_FALSE(isNightHour(0, 0, 0));  // from == to disables night mode
}

void test_button() {
  TEST_ASSERT_TRUE(buttonActionFor(1000, true) == ButtonAction::OpenPortal);
  TEST_ASSERT_TRUE(buttonActionFor(20, true) == ButtonAction::None);      // contact bounce
  TEST_ASSERT_TRUE(buttonActionFor(5000, true) == ButtonAction::None);    // let go during the warning = cancel
  TEST_ASSERT_TRUE(buttonActionFor(500, false) == ButtonAction::None);
  TEST_ASSERT_TRUE(buttonActionFor(3500, false) == ButtonAction::Hint);
  TEST_ASSERT_TRUE(buttonActionFor(10000, false) == ButtonAction::FactoryReset);
}

void test_truncate_utf8() {
  TEST_ASSERT_EQUAL_STRING("Zürich HB", truncateToFit("Zürich HB", 60, byteWidth).c_str());
  TEST_ASSERT_EQUAL_STRING("Zü", truncateToFit("Zürich HB", 20, byteWidth).c_str());
  // 12 px fits 2 bytes, but "Z" + half of "ü" would be invalid UTF-8: must drop the whole character.
  TEST_ASSERT_EQUAL_STRING("Z", truncateToFit("Zürich HB", 12, byteWidth).c_str());
  TEST_ASSERT_EQUAL_STRING("", truncateToFit("Zürich", 0, byteWidth).c_str());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_claim_actions);
  RUN_TEST(test_config_actions);
  RUN_TEST(test_reset_needs_consecutive_failures);
  RUN_TEST(test_time_validity);
  RUN_TEST(test_early_fetch);
  RUN_TEST(test_list_item_visibility);
  RUN_TEST(test_countdown_text);
  RUN_TEST(test_alignment_and_rotation);
  RUN_TEST(test_schedule_window);
  RUN_TEST(test_clamp);
  RUN_TEST(test_normalize_url);
  RUN_TEST(test_night_hours);
  RUN_TEST(test_button);
  RUN_TEST(test_truncate_utf8);
  return UNITY_END();
}
