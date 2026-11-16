#!/bin/bash
# Type-check, export the web bundle, rebuild the preview page.
S=/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad
cd $S/web || exit 1
npx tsc --noEmit -p . 2>&1 | grep -v "__tests__\|\.test\." | head -40
rm -rf dist
npx expo export --platform web > $S/export.log 2>&1 || { tail -30 $S/export.log; exit 1; }
tail -3 $S/export.log
python3 $S/page/build.py $S
(curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8767/ || true)
