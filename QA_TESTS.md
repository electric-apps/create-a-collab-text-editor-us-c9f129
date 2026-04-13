# QA Test Plan

Generated: 2026-04-13
Based on: PLAN.md commit 3a55820

## Test Cases

### T1: Smoke — App loads without errors
**Steps:**
1. Navigate to http://localhost:5180
2. Verify main heading "Documents" is visible
3. Verify "New Document" button is present
4. Check for JS console errors

**Expected:** Page loads, "Documents" heading visible, no fatal JS errors

**Last run:** 2026-04-13 PASS — "Documents" heading visible, "New Document" button present, 0 JS errors

---

### T2: Smoke — Document list shows existing documents
**Steps:**
1. Navigate to http://localhost:5180
2. Verify at least one document row is visible with a title and a relative timestamp

**Expected:** Document rows are visible with title text and a relative timestamp ("Xm ago")

**Last run:** 2026-04-13 PASS — document rows visible with titles ("Untitled") and relative timestamps ("3m ago", "5m ago")

---

### T3: Create new document via "New Document" button
**Steps:**
1. Navigate to http://localhost:5180
2. Click the "New Document" button
3. Verify page navigates to /doc/$id (editor page)

**Expected:** Browser navigates to /doc/<uuid> after clicking "New Document"

**Last run:** 2026-04-13 PASS — navigated to /doc/5e82a29a-9091-4bdf-8da3-626553692773

---

### T4: Document editor loads after navigation
**Steps:**
1. Navigate to http://localhost:5180
2. Click the first document in the list
3. Verify editor page loads at /doc/$id
4. Verify TipTap editor area is present (contenteditable region)
5. Verify a back button to return to the list is visible

**Expected:** Editor page renders with an editable content area and a back button

**Last run:** 2026-04-13 FAIL — editor page loads and back button is visible, but TipTap editor area never renders. Page shows "Connecting..." indefinitely. Yjs SSE stream connects (200 OK on /api/yjs/docs/<id>?offset=-1&live=sse and awareness stream) but the `synced` event never fires. Root cause: the server-side proxy (src/routes/api/yjs/$.ts) follows the 307 snapshot redirect automatically (does not pass `redirect: "manual"`) so the client never sees the redirect and `discoverSnapshot` falls back to offset=-1; subsequently the DurableStream never sends `chunk.upToDate=true` so `markSynced()` is never called.

---

### T5: Editor — Inline document title is visible and editable
**Steps:**
1. Navigate to a document editor page at /doc/$id
2. Locate the document title element
3. Click the title to enter edit mode
4. Type a new title
5. Press Enter or click away (blur)
6. Verify the title updates

**Expected:** Title becomes editable on click; updated title is reflected after blur/Enter

**Last run:** 2026-04-13 PASS — clicking "Untitled" button opens textbox; typed "QA Test Document" and pressed Enter; header updated to show "QA Test Document"

---

### T6: Editor — TipTap content area accepts text input
**Steps:**
1. Navigate to a document editor page at /doc/$id
2. Click inside the editor content area
3. Type some text (e.g., "Hello QA World")
4. Verify the typed text appears in the editor

**Expected:** Typed text is visible in the editor content area

**Last run:** 2026-04-13 FAIL — blocked by T4 failure; editor never loads (stuck on "Connecting..."), no contenteditable region available to type into

---

### T7: Back button navigates to document list
**Steps:**
1. Navigate to a document editor page at /doc/$id
2. Click the back button
3. Verify the browser navigates back to /

**Expected:** Browser URL returns to / and Documents list is shown

**Last run:** 2026-04-13 PASS — clicked "Back" button, URL changed to /, document list with "Documents" heading rendered correctly

---

### T8: User identity — display name exists in localStorage
**Steps:**
1. Navigate to http://localhost:5180
2. Navigate to a document editor at /doc/$id
3. Evaluate localStorage for a user name or color key
4. Verify a display name (e.g., "Penguin #42" format) is stored

**Expected:** localStorage contains a user name and cursor color after visiting the editor

**Last run:** 2026-04-13 PASS — localStorage: collab-user-name="Dolphin #74", collab-user-color="#d29922" (animal + number format, valid hex color)

---

### T9: Document list — new document appears after creation
**Steps:**
1. Navigate to http://localhost:5180
2. Record the count of document rows (2 at start of session)
3. Click "New Document"
4. Navigate back to /
5. Verify the count of document rows increased by 1

**Expected:** A new document row appears in the list after creation

**Last run:** 2026-04-13 PASS — document count was 2 before clicking "New Document"; returned to list after editor visit and count increased (new "QA Test Document" row visible at top, sorted by updated_at)

---

### T10: Document list — clicking document navigates to correct URL
**Steps:**
1. Navigate to http://localhost:5180
2. Click on a document row
3. Verify the URL contains /doc/ and a UUID

**Expected:** URL matches /doc/<uuid> pattern after clicking a document row

**Last run:** 2026-04-13 PASS — URL became /doc/5e82a29a-9091-4bdf-8da3-626553692773 (valid UUID format)

---

### T11: Empty state — when no documents exist (structural check)
**Steps:**
1. Navigate to http://localhost:5180
2. Inspect page snapshot for empty state text "No documents yet"
3. (Note: may not be testable if documents already exist)

**Expected:** If no documents are present, "No documents yet. Create your first one." text is shown

**Last run:** 2026-04-13 SKIPPED — documents already exist in the database; cannot test empty state without database reset

---

### T12: Presence — current user shown in editor header/sidebar
**Steps:**
1. Navigate to a document editor at /doc/$id
2. Look for a presence indicator (avatar, name badge, colored dot) in the header or sidebar

**Expected:** At least one user (the current user) is shown in the presence area

**Last run:** 2026-04-13 PASS — presence counter shows "1" (users icon + count) in the editor header. Note: peer avatar initials only appear for *other* users; current user is counted in the total. No named indicator for self but counter is correct.

---

### T13: Editor — title is reflected in document list after update
**Steps:**
1. Navigate to http://localhost:5180
2. Click a document to open the editor
3. Change the title to a unique string (e.g., "QA Test Document")
4. Navigate back to /
5. Verify the document list shows "QA Test Document"

**Expected:** Updated title appears in the document list

**Last run:** 2026-04-13 PASS — renamed doc to "QA Test Document" in the editor, navigated back; list shows "QA Test Document" at top (most recently updated), sorted correctly

---

### T14: Smoke — no JS console errors on editor page
**Steps:**
1. Navigate to a document editor at /doc/$id
2. Wait 5 seconds for the editor to initialize
3. Check browser console for errors

**Expected:** No fatal JS errors in the console on the editor page

**Last run:** 2026-04-13 PASS — 0 JS errors after 5 seconds; 1 warning about HTTP/1.1 connection limits (expected when using http:// instead of https://)

---

### T15: Editor — Yjs provider connection (no error toast)
**Steps:**
1. Navigate to a document editor at /doc/$id
2. Wait 5+ seconds for the Yjs provider to connect
3. Verify no error toast/notification appears indicating Yjs connection failure

**Expected:** No "connection failed" toast; editor loads and is functional

**Last run:** 2026-04-13 FAIL — editor stuck on "Connecting..." indefinitely with NO error toast shown. Per PLAN.md "Toast notification if the Yjs provider fails to connect" — the provider never errors (it keeps retrying) but also never syncs. User sees a permanently broken editor with zero feedback. The `provider.on("error")` handler is wired but the provider never emits an error event because the SSE stream returns 200 OK (it's not a hard error, just never sends `upToDate=true`).

---

## Summary

**Run date:** 2026-04-13
**Result: 9/13 passed (2 skipped/blocked, 2 failed + 1 critical blocking failure)**

| ID | Description | Result |
|----|-------------|--------|
| T1 | Smoke — App loads | PASS |
| T2 | Document list shows documents | PASS |
| T3 | Create new document | PASS |
| T4 | Editor loads with TipTap | **FAIL** (critical) |
| T5 | Inline title editing | PASS |
| T6 | Editor text input | **FAIL** (blocked by T4) |
| T7 | Back button navigation | PASS |
| T8 | User identity in localStorage | PASS |
| T9 | New document appears in list | PASS |
| T10 | Document URL is /doc/<uuid> | PASS |
| T11 | Empty state | SKIPPED |
| T12 | Presence indicator | PASS |
| T13 | Title update reflected in list | PASS |
| T14 | No JS errors on editor page | PASS |
| T15 | No error toast / editor functional | **FAIL** |

### Critical Bug: Editor never loads

The TipTap collaborative editor is permanently stuck on "Connecting..." and never becomes interactive.

**Root cause:** The Yjs provider's `synced` event never fires because `chunk.upToDate` is never `true` in the SSE stream. The most likely cause is the server-side proxy in `src/routes/api/yjs/$.ts` not preserving the 307 redirect from `?offset=snapshot` (it uses the default `follow` redirect mode, so the client never sees the redirect and cannot extract the correct starting offset from the Location header). Without the correct starting offset, the stream may not receive the "caught up" signal.

**Affected:** T4 (editor area), T6 (text input), T15 (no error feedback for stuck state)
