# Firmware (`on-chip-software/`)

- Rules: [CLAUDE.md](../CLAUDE.md) section 3 (flash/RAM budget, offline mode, identity, server-composed screens, contract tests).
- Everything else: [docs/on-chip-firmware.md](../docs/on-chip-firmware.md) (pinout, partitions, LittleFS layout, lifecycle, fixed vs. variable values) and [docs/hardware-guide.md](../docs/hardware-guide.md) (buying, wiring, power). Keep the pin table in sync when you change a pin.
- Commands: `npm run firmware:build`, `npm run firmware:upload`, `pio test -e native -d on-chip-software`.
