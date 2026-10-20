# Smryx — Build & Submit Guide

**Tiny steps, one at a time. Do one step, look for what it says to look for,
then go to the next. If a screen ever looks different from what's written
here, stop and send me a screenshot — don't improvise.**

Everything here uses the real menus in Xcode 15/16 and App Store Connect.
App Store Connect changes its labels sometimes; the steps that depend on it
say "as of this writing" — if a button has been renamed, the screenshot
rule applies.

> 📍 Where you are: the `smryx` folder is on your Mac. Xcode is installed.
> Nothing is registered or submitted yet. Your Apple Developer account is
> already active.

---

## Part 1 — Open the project

1. Open the `smryx` folder in Finder.
2. Double-click **`Smryx.xcodeproj`**. Xcode opens.
3. Wait until the top-left progress spinner stops. The left sidebar shows a
   blue icon named **Smryx** at the top. That's the project.

## Part 2 — Sign in and pick your team (both targets)

1. Menu bar: **Xcode → Settings…**
2. Click the **Accounts** tab.
3. Bottom-left, click **+**, choose **Apple ID…**, click **Continue**.
4. Sign in with the Apple ID on your Developer account. Close Settings.
5. In the left sidebar, click the blue **Smryx** project icon.
6. The main pane shows a list headed **TARGETS**. Click **Smryx**.
7. Click the **Signing & Capabilities** tab at the top of the main pane.
8. Check the box **Automatically manage signing**.
9. In the **Team** dropdown, pick your developer team. (If nothing is in
   the dropdown, finish step 4 first.)
10. Under **TARGETS**, click **Smryx Extension**.
11. Repeat steps 7–9 for this target.

**Check:** back on the **Smryx** target, the **Bundle Identifier** reads
`com.luckyclover.smryx`; on **Smryx Extension** it reads
`com.luckyclover.smryx.extension`.

**If Xcode says a bundle identifier "is not available":** stop and tell
me the exact message. It's a 2-minute rename, and I need to change it in
the code too — don't rename it only in Xcode.

> Your 10-character Team ID lives at developer.apple.com → sign in →
> **Membership** (left sidebar). Nothing in this guide needs you to type
> it — Xcode uses the dropdown — but that's where it is if anything asks.

## Part 3 — Two capabilities (both targets, ~4 minutes)

The code already asks for these; this step makes Xcode register them.

**App Groups — on the Smryx target:**

1. Target **Smryx** → **Signing & Capabilities** tab.
2. Top-left of that pane, click **+ Capability**.
3. In the search box type **App Groups**. Double-click **App Groups**.
4. A new **App Groups** section appears. Click its **+** button.
5. Type exactly: `group.com.luckyclover.smryx` → click **OK**.
6. Make sure the checkbox next to it is **checked**.

**App Groups — on the extension target:**

7. Target **Smryx Extension** → **Signing & Capabilities** → **+ Capability**
   → **App Groups** (same as steps 2–3).
8. The list should already show `group.com.luckyclover.smryx`. **Check its
   box.** (If it's not listed, click **+** and type it like step 5.)

**Keychain Sharing — on the Smryx target:**

9. Target **Smryx** → **Signing & Capabilities** → **+ Capability**.
10. Search **Keychain Sharing**. Double-click it.
11. In the **Keychain Sharing** section, click **+**.
12. Type exactly: `com.luckyclover.smryx` → press **Return**.

**Keychain Sharing — on the extension target:**

13. Target **Smryx Extension** → add **Keychain Sharing** the same way
    (steps 10–12). Type the same value: `com.luckyclover.smryx`.

## Part 4 — First build

1. Near the top-left of the Xcode window there's a scheme dropdown that
   says **Smryx**, and next to it a destination. Click the destination and
   choose **My Mac**.
2. Menu bar: **Product → Build** (or press **⌘B**).
3. Wait for it to finish.
4. **If it says "Build Succeeded"** (top of the window): go to Part 5.
5. **If it fails:** the left sidebar's ⚠︎/⛔ icons show errors. Click one,
   copy the **exact** red error text, send it to me. First-build errors on
   a fresh scaffold are normal and usually one-line fixes. Don't try to
   fix them yourself.

## Part 5 — Run the app, turn on the extension

1. Menu bar: **Product → Run** (**⌘R**). The Smryx app opens.
2. Click through the intro screen → **Get started**. You'll land on the
   Library tab (empty — correct).
3. Open **Safari**.
4. Menu bar: **Safari → Settings…**
5. Click the **Extensions** tab.
6. Click **Smryx** in the left list.
7. Check the box to turn it **on**.
8. If Safari shows a permission prompt: the extension needs to read the
   current page to extract articles. That's real — it's how the summarizer
   gets the article. Allow it. (Smryx sends the article only to the AI
   endpoint *you* configure, with *your* key. Nothing phones home.)
9. Go to any news article in Safari.
10. Look for the **Sx** button in Safari's toolbar. Click it.
11. The popup should say **"No API key yet."** That's the app being honest
    — everything works, it just needs a key. Part 6.

## Part 6 — Add your API key

1. Switch to the **Smryx app** (it's already running).
2. Click the **Settings** tab.
3. **Provider**: leave it on "OpenAI-compatible API".
4. **API key** field: paste your key (from platform.openai.com → API keys,
   or any OpenAI-compatible provider).
5. Click **Save key to Keychain**. You should see **Saved ✓**.
6. Back in **Safari**, click the **Sx** button again.
7. Click **Summarize**. First summary usually takes 5–20 seconds.
8. You get: the summary, **Copy**, and **Save to library** buttons, and a
   counter showing summaries left this month.
9. Open the Smryx app → **Library** tab: saved ones live there.

**If Summarize fails:** the popup shows the real error (wrong key, no
credit at the provider, endpoint down). Read it literally — it comes from
the provider, not from Smryx guessing.

**No key / want fully local?** In Settings, set Provider to **Ollama**,
run `ollama serve` in Terminal with a model pulled (e.g. `ollama pull
llama3.1`), and Summarize works with no key and no external calls.

## Part 7 — Register the bundle ID (needed before the store)

1. Go to **developer.apple.com** → sign in → **Account**.
2. Left sidebar: **Certificates, Identifiers & Profiles**.
3. Left sidebar: **Identifiers**. Click the blue **+**.
4. Choose **App IDs** → **Continue**.
5. Choose **App** → **Continue**.
6. **Description**: `Smryx`. **Bundle ID**: select **Explicit**, type
   `com.luckyclover.smryx`.
7. Scroll the Capabilities list: check **App Groups** and **Keychain
   Sharing**… *(as of this writing, Keychain Sharing doesn't appear in
   this list — that's normal, skip it; App Groups does appear, check it.)*
8. **Continue** → **Register**.

## Part 8 — App Store Connect: create the app

1. Go to **appstoreconnect.apple.com** → sign in.
2. Click **Apps**.
3. Click the **+** button → **New App**.
4. Fill in, exactly:
   - **Platforms:** check **macOS**
   - **Name:** `Smryx`
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** dropdown → `com.luckyclover.smryx` (if it's not in
     the list, do Part 7 first, wait a minute, refresh)
   - **SKU:** `SMRYX001`
   - **User Access:** Full Access
5. Click **Create**.

## Part 9 — App Store Connect: the Pro subscription

*(Prices below are the provisional ones from `Monetization.swift`. The
buttons are as labeled as of this writing.)*

1. In your Smryx app page, left sidebar, under **Monetization** click
   **Subscriptions**.
2. Click **Create** (subscription group). **Reference Name:** `Smryx Pro`
   → **Create**.
3. In the group, click **Create Subscription**.
4. **Reference Name:** `Smryx Pro Monthly`
   **Product ID:** `com.luckyclover.smryx.pro.monthly` → **Create**.
5. **Subscription Duration:** choose **1 Month**. Save.
6. Under **Subscription Prices**, click **Add Subscription Price** →
   currency **USD** → price **$4.99** → **Next** → review → **Save**.
7. Under **Localizations**, add: Display Name `Smryx Pro`, Description
   `Unlimited summaries`. Save.
8. Go back to the **Smryx Pro** group page. Click **Create Subscription**
   again.
9. **Reference Name:** `Smryx Pro Yearly`
   **Product ID:** `com.luckyclover.smryx.pro.yearly` → **Create**.
10. **Duration:** **1 Year**. Save.
11. Price: **Add Subscription Price** → USD → **$39.99** → Next → Save.
12. Localization: Display Name `Smryx Pro`, Description `Unlimited
    summaries`. Save.

> ⚠️ The first subscription can only be submitted **together with** an
> app version — Part 11 attaches it. Also, paid apps/subscriptions
> require the **paid Apps agreement + tax + banking** to be complete:
> App Store Connect → **Business** (top) — if it says anything other
> than Active there, do that paperwork first; Apple won't sell without it.

## Part 10 — Archive and upload the build

1. Back in **Xcode**. Set the run destination to **Any Mac**.
2. Menu bar: **Product → Archive**. Wait — this takes a few minutes.
3. The **Organizer** window opens showing your archive.
4. Click **Distribute App**.
5. Choose **App Store Connect** → **Next**.
6. Choose **Upload** → **Next**.
7. Keep the defaults (automatic signing on) → **Next** → **Upload**.
8. Wait for **"Upload Successful"**. Done. Apple then processes the build
   (they email you when it's ready — usually under an hour).

## Part 11 — The listing, then submit

1. **appstoreconnect.apple.com** → **Apps** → **Smryx** → the **1.0**
   version page (left sidebar, under App Store).
2. Fill the fields:
   - **Promotional Text:** `One-click article summaries in Safari, with your own AI key.`
   - **Description:** say what's true — BYOK, no server, your key in
     Keychain, 10 free/month, library. (Draft's in the project README's
     privacy story — adapt it, don't paste blindly.)
   - **Keywords:** `summarize,summary,ai,reader,article,safari,byok`
   - **Support URL:** `https://smryx.com` (you own it — put any real page
     there before submitting; Apple checks it loads)
   - **Marketing URL:** optional, leave blank.
3. **Screenshots:** on the same page, under **Mac** screenshots, upload at
   least one 16:10 screenshot (1280×800 or larger). Take it from the
   running app: **⇧⌘4**, drag a box. Get the Library and Settings screens.
4. **Build** section: click **+** / "Select a build" → pick the build from
   Part 10 → Done.
5. **App Privacy** (left sidebar): ⚠️ **Stop here and do this with me.**
   The truthful shape is "the app itself collects nothing; article text
   goes to the AI provider the user chooses" — but Apple's checkboxes
   have their own definitions, and getting them wrong is a rejection or
   worse. Screenshot the questions, send them to me, we answer together.
6. **App Review Information:** add your contact info. In **Notes**, write:
   "Smryx is bring-your-own-key: to test summarization, create a free API
   key with an OpenAI-compatible provider and paste it in Settings.
   Alternatively the app supports local Ollama with no key." *(A test key
   for the reviewer helps — decide with me before submitting.)*
7. **Subscriptions:** on the version page there's a section for in-app
   purchases/subscriptions for first submission — attach **Smryx Pro**
   group if it asks.
8. Top-right: **Add for Review** → **Submit for Review**.

## Part 12 — After submitting

- Status becomes **Waiting for Review**. Reviews usually take 1–3 days
  for a first Mac app, but it's Apple's clock, not a promise.
- If they reject: **don't panic, don't resubmit blindly.** Open the
  Resolution Center message, copy it to me word for word, and we'll fix
  the actual thing they named.
- When it says **Ready for Sale**: you have a meal ticket on the shelf. 🎉

---

### If anything in this guide doesn't match your screen

Stop. Screenshot it. Send it to me. Every step above was written from
the real UI, but Xcode and App Store Connect both change — a mismatch
means the guide needs a fix, not you forcing your way through.
