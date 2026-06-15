# Windows Handoff — Turbo (MFT) Scan

Handoff for the Claude session running on the **Windows machine**. The WSL session
(Linux, no NTFS, no Windows runtime) built and pushed the Turbo scan rewrite but
**cannot test it**. That is your job. Read this top to bottom before touching code.

Branch: `feature/collapsible-explore-publish-polish`
Last commit: `080c88a` — "Rewrite Turbo scan as one-pass MFT engine with cached tree"

---

## 1. The goal

A **Windows disk-space cleaner for developers** (npm `windows-clean`, product
"SpaceGuard"). Tauri v2: Rust backend (`src-tauri/src/main.rs`) + React frontend
(`src/App.jsx`).

Core problem we are solving: a normal scan reports a huge chunk of the disk as
"used" without itemizing it (e.g. "326 GB — 89%, not itemized"). Users can't see
or act on it. **Browse C:** (3rd tab) is the fix: a full WizTree/WinDirStat-style
drill-down explorer with a treemap and delete-to-Recycle-Bin from anywhere, behind
a safety guard.

The remaining blocker before this handoff: the fast scan ("Turbo") was **slow and
appeared to hang** on a full C:. This rewrite is the fix. **Your job is to prove it
works, measure it, and report back.**

---

## 2. What was tried before (so you don't repeat it)

- **Attempt 1 & 2 (failed):** Turbo walked the NTFS **directory index** recursively
  — open folder → read its index → recurse per child. That issues O(folders) random
  disk seeks, and `Ntfs::file` re-reads the $MFT root record on every call. On a real
  C: with millions of files this was minutes-long and looked frozen. Rejected.
- **Decision:** do it the WizTree way — one sequential pass over the whole $MFT.

---

## 3. What this rewrite does (the current design)

All in `src-tauri/src/main.rs`.

- **`build_mft_cache(letter, window)`** (`main.rs:1292`) — opens `\\.\C:`, reads
  **every $MFT record once in record-number order**. Per record it pulls the
  `$FILE_NAME` attribute (name + parent record + is_dir) and the unnamed `$DATA`
  length (size). Then it rebuilds the tree from parent pointers and computes subtree
  bytes/file-count/dir-count in one post-order pass. Result cached in memory.
  - NTFS root directory is assumed to be record **5** (`main.rs:1392`) — standard.
  - DOS-namespace `$FILE_NAME` entries are skipped; Win32 preferred.
  - `$`-prefixed metafiles (`$MFT`, etc.) are kept in the tree for size accuracy but
    **hidden** in the listing, and `.` is skipped.
- **`CachingBlockReader`** (`main.rs:1132`) — small LRU of 64 KiB aligned blocks
  (`CACHE_BLOCK`, `main.rs:1129`). `Ntfs::file` re-reads the hot $MFT-root block on
  every call; caching collapses that plus the sequential record reads to ~**one
  physical read per block**. This is the key perf fix.
- **`scan_volume_mft(window, state, drive)`** (`main.rs:1472`) — async Tauri command.
  Runs `build_mft_cache` on a background thread (`spawn_blocking`) and streams
  **`mft-progress`** events (records scanned, every 50k) so the UI shows a live count
  and never looks frozen. Returns `{drive, files, dirs, bytes, elapsedMs}`.
- **`explore_dir_fast(state, request)`** (`main.rs:1503`) — now serves **one folder
  level instantly from the cache**. Returns `available:false` (→ frontend falls back
  to the standard walk) when: no scan has run, cached drive differs, or path malformed.
- Cache lives in `MftCacheState(Mutex<Option<MftCache>>)`, `.manage()`-d in `main()`.

Frontend (`src/App.jsx`, `ExploreBrowser`):
- Turbo toggle on → fires `scan_volume_mft` once per drive, listens to `mft-progress`,
  shows **"Scanning C: drive… N files"** then a post-scan summary
  ("Turbo scanned X files in Y.Ys"). Navigation reads from cache (`explore_dir_fast`).
- Bridge: `runNativeScanVolume`, `onNativeMftProgress` in `src/native-scanner.mjs`.

Safety guard (unchanged, server-authoritative) — `classify_delete_guard`
(`main.rs:732`): hard-block OS/system + drive root + `$`-files; confirm on top-level
or >5 GB; warn on app/user data; else allow. Delete → Recycle Bin via
`SHFileOperationW` + `FOF_ALLOWUNDO` (recoverable), `move_path_to_recycle_bin`
(`main.rs:998`).

---

## 4. What is verified vs NOT

Verified in WSL:
- `cargo check` clean.
- ntfs 0.4.0 API usage checked against crate source — **compiler confirms API
  correctness** (the crate is pure Rust, not platform-gated).
- All 12 JS test suites pass. `vite build` passes.

**NOT verified — this is what you must do:**
- Raw `\\.\C:` open + actual on-disk MFT parsing only run on **Windows as admin**.
- Real scan time. Real size/count accuracy. Whether it hangs.

---

## 5. Your steps on Windows

### Build & run
```powershell
npm install            # no WSL shims needed on Windows
npm test               # all 12 suites should pass
npm run native:dev     # dev build, opens the SpaceGuard window (Tauri)
# or full installer:
npm run native:build
```

### Run AS ADMINISTRATOR
Turbo needs raw volume access. Launch the terminal / app **as administrator**.
Without admin the scan fails → app falls back to the standard walk and shows an
amber "Turbo needs administrator" note. Confirm that fallback also works.

### Test checklist (report each)
1. **Open Browse C: tab, Turbo on.** Does the live "Scanning C:… N files" count
   climb smoothly, or stall? Note where if it stalls.
2. **Scan time:** read the post-scan summary ("X files in Y.Ys"). Record it.
   Compare to WizTree on the same drive (WizTree is the bar). Order-of-magnitude is
   fine for now — seconds vs minutes is what matters.
3. **Correctness:** spot-check a few big folders' sizes vs WizTree / Explorer
   "Properties". Are they in the right ballpark? Flag any folder that's wildly off.
4. **Navigation:** after scan, drilling into folders should be **instant** (cache).
   Confirm. Going up, breadcrumbs, treemap all populate.
5. **Total:** does root C: total roughly match actual used space?
6. **No-admin path:** run without admin → confirm graceful fallback to walk + note.
7. **Delete (carefully, recoverable):** select a small throwaway folder, move to
   Recycle Bin, confirm it lands there and is restorable. Confirm guard blocks
   `C:\Windows`, drive root, etc.

### What to report back
- Scan time + file count, vs WizTree.
- Screenshot/description of how Browse C: looks (treemap, sizes, folder list).
- Any stall/hang (and at what file count).
- Any sizes that look wrong.
- Whether no-admin fallback works.

---

## 6. Known risks to watch (likely next bugs)

- **Size source:** we sum the unnamed `$DATA` `value_length`. For
  compressed/sparse files this is the **logical** size (WizTree shows allocated/on-disk
  — may differ). Alternate Data Streams are ignored. If totals read high vs disk,
  this is why.
- **Hardlinks:** a file with multiple names is counted under one parent only (we pick
  the highest-namespace `$FILE_NAME`). Minor double/under-count possible.
- **Orphans / missing parents:** records whose parent isn't reachable from root 5 are
  dropped from the tree (not shown). If a chunk of space is "missing," suspect this.
- **Root = record 5** is assumed. Standard NTFS, but note it.
- **Reparse points / junctions** (e.g. `C:\Users\...\AppData` links, OneDrive) — not
  specially handled; sizes come straight from MFT records.
- **Memory:** the cache holds every node (~tens of MB for ~1M files). Fine, but watch
  on a huge volume.

---

## 7. Workflow (keep doing this)

Each round: implement → `cargo check` (or build) + `npm test` → **commit + push** the
feature branch so it can be pulled and tested. Commit message ends with:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
Note: this repo's working tree drifted to CRLF while HEAD is LF, so a naive
`git add -A` shows ~50 files of pure line-ending noise. Commit **only files with real
changes** (normalize them to LF first, e.g. `sed -i 's/\r$//' <file>`), not the noise.

---

## 8. If Turbo still fails

If this MFT attempt also can't produce correct sizes in reasonable time, the agreed
fallback (Option B) is: **drop MFT/admin entirely**, keep the no-admin parallel
`explore_dir` walk, make it async + cached per level with a spinner. Slower, not
instant, but reliable and no admin. Don't open a 4th blind MFT iteration — switch to B.
