# First Real Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove SpaceGuard can reclaim bytes through one bounded native executor while preserving route allowlists, explicit consent, and proof handoff.

**Architecture:** The Rust Tauri command `execute_cleanup_plan` remains the only mutation boundary. The first milestone uses the existing bounded npm cache executor because it targets a rebuildable cache root, already has a JS adapter, and avoids personal files or uninstall flows. The UI/proof path must report actual accepted execution, deleted-byte counts, and post-run proof requirements instead of treating the route as dry-run ceremony.

**Tech Stack:** Tauri v2, Rust native command tests, React/Vite frontend, Node guardrail tests.

---

### Task 1: Native npm Deletion Proof

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write the failing Rust test**

Add a unit test under `#[cfg(test)] mod tests`:

```rust
#[test]
fn npm_cache_deleter_removes_only_old_content_and_tmp_files() {
    let local_app_data = unique_test_dir("npm-delete-proof");
    let root = local_app_data.join("npm-cache").join("_cacache");
    let old_content = root.join("content-v2").join("sha512").join("ab").join("blob");
    let old_tmp = root.join("tmp").join("scratch");
    let index_metadata = root.join("index-v5").join("bucket").join("entry");
    let lock_file = root.join("tmp").join("cache.lock");

    fs::create_dir_all(old_content.parent().expect("old content parent")).expect("create old content dir");
    fs::create_dir_all(old_tmp.parent().expect("old tmp parent")).expect("create old tmp dir");
    fs::create_dir_all(index_metadata.parent().expect("index parent")).expect("create index dir");
    fs::write(&old_content, b"delete-content").expect("write old content");
    fs::write(&old_tmp, b"delete-tmp").expect("write old tmp");
    fs::write(&index_metadata, b"keep-index").expect("write index");
    fs::write(&lock_file, b"keep-lock").expect("write lock");

    let _lock = ENV_LOCK.lock().expect("env lock");
    let _restore = EnvRestore::set("LOCALAPPDATA", &local_app_data);
    let old_enough_now = SystemTime::now() + Duration::from_secs(15 * 24 * 60 * 60);

    let result = delete_npm_cache_target_at(&root, old_enough_now);

    assert_eq!(result.deleted_files, 2, "old npm content and tmp files should be deleted");
    assert_eq!(result.deleted_bytes, 24, "deleted bytes should match removed file lengths");
    assert!(!old_content.exists(), "old content blob should be removed");
    assert!(!old_tmp.exists(), "old tmp file should be removed");
    assert!(index_metadata.exists(), "index metadata must survive");
    assert!(lock_file.exists(), "lock files must survive");

    let _ = fs::remove_file(&index_metadata);
    let _ = fs::remove_file(&lock_file);
    let _ = fs::remove_dir(index_metadata.parent().expect("index metadata parent"));
    let _ = fs::remove_dir(root.join("index-v5"));
    let _ = fs::remove_dir(root.join("tmp"));
    let _ = fs::remove_dir(root.join("content-v2").join("sha512").join("ab"));
    let _ = fs::remove_dir(root.join("content-v2").join("sha512"));
    let _ = fs::remove_dir(root.join("content-v2"));
    let _ = fs::remove_dir(&root);
    let _ = fs::remove_dir(local_app_data.join("npm-cache"));
    let _ = fs::remove_dir(&local_app_data);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test npm_cache_deleter_removes_only_old_content_and_tmp_files
```

Expected: fails because `delete_npm_cache_target_at` does not exist yet. On Linux machines without Tauri GTK/WebKit development packages, this may fail earlier on `pkg-config`; in that case run the Node source-contract test below and rerun Cargo on Windows or a fully provisioned Linux host.

- [ ] **Step 3: Implement minimal native fix**

Update only the npm deleter helpers around `delete_npm_cache_target`, `delete_single_npm_cache_file`, and `file_old_enough_for_npm_cache_delete`. Keep production deletion on `SystemTime::now()`, add clock-injected helpers for proof tests, keep the executor scoped to `_cacache`, skip symlinks, keep index metadata and lock files, and report deleted bytes from successful `remove_file` calls.

- [ ] **Step 4: Run native verification**

Run:

```bash
cargo check
cargo test npm_cache
```

Expected: all npm cache native tests pass and the Rust crate checks on a host with Tauri system dependencies installed.

### Task 2: App Contract Shows Real Executor Status

**Files:**
- Test: `tests/native-scanner.test.js`
- Test: `tests/static-app.test.js`

- [ ] **Step 1: Write JS/static tests**

Assert that `runNativeNpmCacheExecutor` sends `dryRunOnly: false`, `mutationAttempted: true`, route `bounded-npm-cache-delete`, and normalizes accepted results with reclaimed bytes. Also assert that the Rust source keeps production deletion on the real clock and keeps a deletion proof test.

- [ ] **Step 2: Implement minimal UI/adapter changes**

Confirm the existing executor panel and adapter already surface accepted native npm execution and reclaimed bytes. Do not add a new gate when the existing path is already wired.

- [ ] **Step 3: Verify**

Run:

```bash
node tests/native-scanner.test.js
node tests/static-app.test.js
npm test
npm run build
```

Expected: tests and build pass.

### Task 3: Commit

**Files:**
- Stage only files changed by this milestone.

- [ ] **Step 1: Diff checks**

Run:

```bash
git diff --check
git status --short
```

- [ ] **Step 2: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-first-real-executor.md src-tauri/src/main.rs tests/native-scanner.test.js tests/static-app.test.js
git commit -m "feat: prove first real npm executor"
```
