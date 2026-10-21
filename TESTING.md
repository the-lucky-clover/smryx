# Smryx — Build & Test on Your Mac

**What this guide does:** gets a fresh copy of Smryx onto your Mac
using **one command**, and runs its automated smoke test.

**One big difference from 1918:** Smryx is a **Mac-only** app (plus its
Safari extension). There is **no iPhone version**, so your two iPhones
sit this one out — builds and tests all happen right here on the Mac,
delivered through **TestFlight** (Apple's testing service) just like
1918.

**The two commands you'll actually use:**

| What you want | Command (from the `smryx` folder) |
|---|---|
| New build via TestFlight | `bundle exec fastlane beta` |
| Run the automated smoke test | `bundle exec fastlane test` |

> **The golden rule:** if anything prints red text or shows an error,
> **don't improvise.** Copy the exact red text (or screenshot it) and
> send it to Sailor Ron. If your screen disagrees with a step, the red
> text is how we fix the guide.

---

## Part 1 — One-time setup on your Mac

**If you already did Part 1 of the 1918 TESTING.md, skip to step 5** —
Xcode, Homebrew, and Ruby are shared. Only the per-project
`bundle install` (step 6) is new.

1. **Install Xcode** from the Mac App Store if it isn't installed yet,
   then **open it once** and let it finish "installing components".
2. **Sign in to Xcode:** menu **Xcode → Settings… → Accounts** → **+**
   → **Apple ID** → sign in with the same Apple ID you use for
   App Store Connect.
3. **Install Homebrew** (skip if already installed). In **Terminal**,
   paste the one-liner from https://brew.sh :
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Then run the two `echo`/`eval` "Next steps" lines it prints at the
   end.
4. **Install a modern Ruby and Bundler** (skip if already installed):
   ```
   brew install ruby
   gem install bundler
   ```
   (`ruby --version` should say `ruby 3.` something. Why Homebrew Ruby
   + Bundler instead of `brew install fastlane`: this project pins its
   exact fastlane version in its `Gemfile`, and Bundler always installs
   that pinned version — same tool, same version, every build.)
5. **Go to the project folder.** In Terminal, type `cd` and a space,
   then drag the **`smryx`** folder from Finder into the Terminal
   window, then press Enter. Your prompt should end in `smryx`.
6. **Install the project's fastlane:**
   ```
   bundle install
   ```
   Ends with `Bundle complete!` — that's success.

### The password file (so uploads don't nag you)

1. Go to https://appleid.apple.com → **Sign-In and Security →
   App-Specific Passwords**.
2. If you already made one named `fastlane` for 1918, you can reuse the
   same password here. If not, generate one now and copy it.
3. In Terminal (in the `smryx` folder), paste this line, replacing
   `PASTE-IT-HERE` with the password:
   ```
   echo 'FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD=PASTE-IT-HERE' > fastlane/.env
   ```
   This file lives only on your Mac (it's in `.gitignore`).

---

## Part 2 — First run on the Mac (one time)

No phones, no cables for Smryx — just prove the app runs from Xcode
once:

1. **Double-click `Smryx.xcodeproj`** in the `smryx` folder.
2. If Xcode shows a signing warning: select the **Smryx** target →
   **Signing & Capabilities** → **Team** → pick your name / your team.
   (Do the same for the **Smryx Extension** target if it asks.)
3. **Press ▶ Run.** Smryx launches on the Mac.
4. **Turn the extension on once:** open **Safari → Settings… →
   Extensions** and tick **Smryx**. (Full extension walkthrough:
   BUILD_GUIDE.md in this folder.)

---

## Part 3 — The one command: send a new build to TestFlight

1. Open **Terminal**, go to the `smryx` folder (drag trick, Part 1
   step 5).
2. Run:
   ```
   bundle exec fastlane beta
   ```
3. **What you'll see:** the build number goes up by 1, the app
   archives, the upload runs, and green success text confirms it.
4. **If Apple asks for a 6-digit verification code** the first time,
   type it — normal.
5. **Wait for Apple to process the build** — usually **5–30 minutes**
   for a first build, on Apple's side. You'll get an email from
   App Store Connect when it's ready. Nothing is broken while you
   wait.

---

## Part 4 — Install the build from TestFlight (on the Mac)

1. Install **TestFlight** from the **Mac App Store** if it isn't
   installed.
2. Open TestFlight, signed in with the **same Apple ID** as your
   developer account.
3. After the processing email, **Smryx** appears — click **Install**,
   then launch it like any app.
4. The version + build number (like `1.0 (2)`) shows under the app
   name — that's the number to quote if anything looks off.
5. **If Smryx doesn't appear:** on the Mac go to
   https://appstoreconnect.apple.com → **Smryx → TestFlight tab →
   Internal Testing** → create a group (any name) → add **yourself**
   as a tester → add the build. Then look again.

**Honest notes:**

- **Internal testing has NO review wait** — your own builds skip
  App Review entirely.
- **TestFlight builds expire after 90 days.** Run Part 3 again for a
  fresh one.
- There is deliberately **no iPhone step** — Smryx has no iOS app, so
  there's nothing to install on the phones.

---

## Part 5 — Automated tests

The smoke test launches Smryx on this Mac and checks that a real
window appears, and saves a screenshot.

1. In Terminal, in the `smryx` folder, run:
   ```
   bundle exec fastlane test
   ```
2. **What happens:** Smryx builds and launches, the test waits for its
   window, and takes a screenshot.
3. **Passing looks like:** green **TEST SUCCEEDED** text, then a
   summary table at the end with green check marks and
   `fastlane finished with success`.
4. Screenshots and the full report land in `fastlane/test_output/`.
5. **If it fails:** copy the exact red text back to Ron — don't
   improvise.

---

## Appendix — the `devices` lane

Smryx doesn't need it (Mac app — no UDIDs, no phones). Running
`bundle exec fastlane devices` just prints a short explanation of
exactly that. The working version lives in the 1918 project.

**Helpful links:**

- Homebrew — https://brew.sh
- Fastlane docs — https://docs.fastlane.tools
- App Store Connect — https://appstoreconnect.apple.com
- App-specific passwords — https://appleid.apple.com
- About TestFlight — https://developer.apple.com/testflight
- 1918's guide (for the two-iPhone flow) — `TESTING.md` in the
  `1918-ace-of-aces/native` folder
