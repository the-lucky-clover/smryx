# YouTube caption timeout investigation — October 1, 2026

Reported warning: `URL interception failed, trying legacy method: Error: Timed out waiting for subtitle URL`, at `content-script/index.js:27`.

The warning text and the interception waiter are absent from the current extension files and from the script listing in the supplied error report. Chrome retains error entries, and existing tabs can retain older content scripts. An older loaded script or retained error entry is therefore the likely source; the user's active browser instance was not inspected.

The second supplied report was compared on October 1 after the user refreshed. Its executable script listing matches the current local script exactly after normalizing Windows newlines (64,528 characters, excluding the license comment). The warning appears only once, in the error heading; it is absent from the script listing. The saved stack points to `Ne` on line 27, while the supplied updated script defines `Ne` on line 39. This confirms that the script listing is updated and the stack belongs to a different, earlier version. Whether the entry was cleared and then regenerated is still unconfirmed; a fresh entry after clearing requires investigation of the running browser/profile and other installed copies.

Current extraction uses an observed caption URL when available, then caption metadata from inline scripts or fetched watch HTML. It does not toggle the player's captions or wait for an intercepted request. Failed caption/watch fetches abort after five seconds and clear their timers. Missing captions return no transcript; the existing popup displays its missing-transcript error before contacting a summary provider.

This pass additionally discards transcripts when the page changes videos during extraction, avoids repeated attempts for identical track URLs, and preserves a newer captured URL if an older request fails. Replaced the obsolete caption-toggle test with checks of the current behavior.

Verification:

- `node tests/youtube-transcripts.test.cjs`: caption cache, metadata fallback, parser, invalid/empty responses, missing captions, network timeout cleanup, stale metadata, navigation during fetch, and duplicate tracks.
- `node tests/youtube-extension.cjs`: actual unpacked extension and runtime messaging in isolated Chromium, with controlled YouTube responses. JSON/XML captions, empty/missing captions, hanging/failed fetches, fetched metadata, and captured URL cache. No extension warnings or uncaught page errors. Live YouTube caption availability and the user's profile are not covered.
- `node tests/summarization.test.cjs`: existing provider and page-extraction regression checks.

To load the fix in the user's browser:

1. Open Manage extensions and verify this unpacked extension's path is `C:\Users\lbs1\ChatGPT-Beast-Mode-Dev`.
2. Reload the extension.
3. Refresh the YouTube tab so it receives the updated content script.
4. Clear the existing entries under Errors, then retry Summarize. Chrome does not remove historical errors merely because the code was fixed.

If captions are unavailable, use the popup's explicit missing-transcript message to enable captions and retry, or select transcript text. That case should not produce the reported interception warning.
