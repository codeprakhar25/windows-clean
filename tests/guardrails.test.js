const assert = require("assert");

(async () => {
  const guard = await import("../src/spaceguard-model.mjs");

  function makeReviewApprovals(actionList, protectedPaths = []) {
    const base = { groupConfirm: true, permanentConfirm: true, reviewed: {}, reviewItems: {}, typed: {} };
    const reviews = guard.buildReviewItemsByAction(actionList, null, protectedPaths, base);
    const reviewItems = {};
    for (const [actionId, review] of Object.entries(reviews)) {
      reviewItems[actionId] = Object.fromEntries(
        review.items
          .filter((item) => !item.protected)
          .map((item) => [item.id, item.recommendation === "review" ? "remove" : "keep"])
      );
    }
    return { ...base, reviewItems };
  }

  function makePassedEvidence(ids) {
    return Object.fromEntries(
      ids.map((id) => [
        id,
        {
          status: "passed",
          evidencePath: `evidence/${id}.json`,
          reviewer: "qa-operator",
          notes: "Disposable Windows validation evidence captured.",
          recordedAt: "2026-06-04T00:00:00.000Z"
        }
      ])
    );
  }

  const selected = new Set(guard.actions.filter(guard.selectedByDefault).map((action) => action.id));
  const totals = guard.computeTotals(selected);

  assert(totals.selectedBytes > 0, "default plan should recover some space");
  assert(
    guard.actions.filter((action) => action.gate === "blocked").every((action) => !guard.selectableAction(action)),
    "blocked actions must not be selectable"
  );
  assert(
    !guard.buildSuggestedPlan(90 * guard.GB, new Set()).has("docker-volumes"),
    "suggested plan must not include Docker volumes"
  );
  assert(
    !guard.buildSuggestedPlan(90 * guard.GB, new Set()).has("pagefile"),
    "suggested plan must not include pagefile changes"
  );
  const recycleOnly = new Set(["recycle-bin"]);
  assert.strictEqual(
    guard.getExecutionReadiness(recycleOnly, { groupConfirm: true, reviewed: {}, typed: {} }).ready,
    false,
    "Recycle Bin emptying should need explicit permanent-removal confirmation"
  );
  assert.strictEqual(
    guard.getExecutionReadiness(recycleOnly, { groupConfirm: true, permanentConfirm: true, reviewed: {}, typed: {} }).ready,
    true,
    "Recycle Bin emptying should unlock only after permanent-removal confirmation"
  );
  const intakeBlockedPolicy = guard.buildIntakePolicy({
    targetDrive: "c",
    goalBytes: 120 * guard.GB,
    mode: "emergency",
    protectedPaths: [],
    adminAllowed: false
  });
  assert.strictEqual(intakeBlockedPolicy.schemaVersion, "spaceguard-intake-policy/v1", "intake policy should expose a schema version");
  assert.strictEqual(intakeBlockedPolicy.targetDrive, "C:", "intake policy should normalize target drive");
  assert.strictEqual(guard.normalizeTargetDrive("d"), "D:", "target drive normalizer should accept drive letters");
  assert.strictEqual(guard.normalizeTargetDrive("E:\\"), "E:", "target drive normalizer should accept root drive syntax");
  assert.strictEqual(guard.normalizeTargetDrive("D:\\Users\\demo"), "C:", "target drive normalizer should reject path-like scan scope");
  assert.strictEqual(intakeBlockedPolicy.adminSensitiveBlocked, true, "admin-sensitive routes should default to blocked by intake");
  assert.strictEqual(guard.actionRequiresAdminConsent(guard.actions.find((action) => action.id === "windows-old")), true, "Windows.old should require admin consent");
  assert.strictEqual(guard.actionRequiresAdminConsent(guard.actions.find((action) => action.id === "hibernation")), true, "hibernation should require admin consent");
  assert.strictEqual(
    guard.selectableAction(guard.actions.find((action) => action.id === "windows-old"), [], intakeBlockedPolicy),
    false,
    "intake policy should remove admin-sensitive actions from selection"
  );
  const intakeBlockedPlan = guard.buildSuggestedPlan(220 * guard.GB, new Set(), guard.actions, [], intakeBlockedPolicy);
  assert(!intakeBlockedPlan.has("windows-old"), "suggested plan must not include Windows.old when admin allowance is off");
  assert(!intakeBlockedPlan.has("hibernation"), "suggested plan must not include hibernation when admin allowance is off");
  assert(!intakeBlockedPlan.has("wsl-vhdx"), "suggested plan must not include WSL compaction when admin allowance is off");
  const intakeAllowedPolicy = guard.buildIntakePolicy({ targetDrive: "C:", goalBytes: 120 * guard.GB, mode: "emergency", adminAllowed: true });
  assert.strictEqual(
    guard.selectableAction(guard.actions.find((action) => action.id === "windows-old"), [], intakeAllowedPolicy),
    true,
    "admin allowance should make admin-sensitive dry-run routes selectable again"
  );
  const reviewSelection = new Set(["downloads-installers"]);
  const reviewApprovals = makeReviewApprovals(guard.actions);
  const reviewItems = guard.buildReviewItemsByAction(guard.actions, null, [], reviewApprovals);
  const safeRiskBudget = guard.buildRiskBudget({
    mode: "safe",
    actionList: guard.actions,
    selectedIds: reviewSelection
  });
  assert.strictEqual(safeRiskBudget.schemaVersion, "spaceguard-risk-budget/v1", "risk budget should expose a schema version");
  assert.strictEqual(safeRiskBudget.status, "risk-overrun", "safe mode should block review-gated selections");
  assert.strictEqual(safeRiskBudget.realRunAllowed, false, "risk budget must not grant real execution");
  assert.strictEqual(safeRiskBudget.counts.realRun, 0, "risk budget should keep real-run rows at zero");
  const safeReviewReadiness = guard.getExecutionReadinessForActions(reviewSelection, reviewApprovals, guard.actions, [], reviewItems, intakeAllowedPolicy);
  assert.strictEqual(safeReviewReadiness.ready, true, "review selection fixture should have approval gates resolved");
  const safeReviewPreflight = guard.buildExecutionPreflight({
    scanned: true,
    scanning: false,
    selectedIds: reviewSelection,
    actionList: guard.actions,
    readiness: safeReviewReadiness,
    protectedPaths: [],
    ledger: [],
    riskBudget: safeRiskBudget
  });
  assert.strictEqual(safeReviewPreflight.ready, false, "risk budget overrun should block execution preflight");
  assert(safeReviewPreflight.items.some((item) => item.id === "risk-budget" && !item.passed), "preflight should expose risk-budget blocker");
  const balancedRiskBudget = guard.buildRiskBudget({
    mode: "balanced",
    actionList: guard.actions,
    selectedIds: reviewSelection
  });
  assert.strictEqual(balancedRiskBudget.status, "within-risk-budget", "balanced mode should allow review-gated selections");
  const advancedRiskBudget = guard.buildRiskBudget({
    mode: "balanced",
    actionList: guard.actions,
    selectedIds: new Set(["hibernation"])
  });
  assert.strictEqual(advancedRiskBudget.status, "risk-overrun", "balanced mode should block advanced system selections");
  const emergencyRiskBudget = guard.buildRiskBudget({
    mode: "emergency",
    actionList: guard.actions,
    selectedIds: new Set(["hibernation"])
  });
  assert.strictEqual(emergencyRiskBudget.status, "within-risk-budget", "emergency mode should allow advanced routes at the risk ceiling");
  const lockSelection = new Set(["windows-temp"]);
  const lockApprovals = { groupConfirm: true, permanentConfirm: true, reviewed: {}, reviewItems: {}, typed: {} };
  const lockScanSession = {
    status: "native-current",
    readyForPlanning: true,
    currentFingerprint: "scan-lock-1",
    primary: "Native scan evidence is current."
  };
  const lockPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: lockSelection,
    actionList: guard.actions,
    approvals: lockApprovals,
    intakePolicy: intakeAllowedPolicy,
    scanSession: lockScanSession
  });
  const lockRiskBudget = guard.buildRiskBudget({
    actionList: guard.actions,
    selectedIds: lockSelection,
    intakePolicy: intakeAllowedPolicy
  });
  const waitingPlanLock = guard.buildPlanLock({
    planSnapshot: lockPlanSnapshot,
    scanSession: lockScanSession,
    riskBudget: lockRiskBudget
  });
  assert.strictEqual(waitingPlanLock.schemaVersion, "spaceguard-plan-lock/v1", "plan locks should expose a schema version");
  assert.strictEqual(waitingPlanLock.status, "plan-lock-ready", "fresh plan, scan, and risk evidence should create a preflight-ready lock");
  assert.strictEqual(waitingPlanLock.readyForPreflight, true, "plan lock should allow preflight before consent");
  assert.strictEqual(waitingPlanLock.readyForLaunch, false, "plan lock should not allow launch before consent");
  assert.strictEqual(waitingPlanLock.counts.realRun, 0, "plan locks must not grant real execution");
  const lockReadiness = guard.getExecutionReadinessForActions(lockSelection, lockApprovals, guard.actions, [], null, intakeAllowedPolicy);
  const lockPreflight = guard.buildExecutionPreflight({
    scanned: true,
    scanning: false,
    selectedIds: lockSelection,
    actionList: guard.actions,
    readiness: lockReadiness,
    protectedPaths: [],
    ledger: [],
    planSnapshot: lockPlanSnapshot,
    scanSession: lockScanSession,
    riskBudget: lockRiskBudget,
    planLock: waitingPlanLock
  });
  assert.strictEqual(lockPreflight.ready, true, "current plan lock should pass execution preflight");
  assert(lockPreflight.items.some((item) => item.id === "plan-lock" && item.passed), "preflight should expose passing plan-lock evidence");
  const lockExecutorPlan = guard.buildExecutorPlan({
    selectedIds: lockSelection,
    actionList: guard.actions,
    approvals: lockApprovals,
    preflight: lockPreflight,
    intakePolicy: intakeAllowedPolicy
  });
  const lockRunReadiness = guard.buildRunReadiness(lockPreflight, guard.buildExecutorReadiness(lockExecutorPlan, lockPreflight));
  assert.strictEqual(lockRunReadiness.ready, true, "lock fixture should be run-ready before consent");
  const stalePlanLockConsent = { accepted: true, planId: lockPlanSnapshot.id, planLockId: "lock-stale", acceptedAt: "2026-06-04T10:00:00.000Z" };
  const stalePlanLock = guard.buildPlanLock({
    planSnapshot: lockPlanSnapshot,
    scanSession: lockScanSession,
    riskBudget: lockRiskBudget,
    consent: stalePlanLockConsent
  });
  assert.strictEqual(stalePlanLock.status, "plan-lock-stale-consent", "stale lock id should invalidate consent");
  assert.strictEqual(stalePlanLock.readyForLaunch, false, "stale consent must block launch");
  const staleConsentReceipt = guard.buildExecutionConsentReceipt({
    planSnapshot: lockPlanSnapshot,
    executorPlan: lockExecutorPlan,
    runReadiness: lockRunReadiness,
    consent: stalePlanLockConsent,
    planLock: stalePlanLock
  });
  assert.strictEqual(staleConsentReceipt.ready, false, "consent receipt should reject stale plan-lock ids");
  assert.strictEqual(staleConsentReceipt.planLockCurrent, false, "stale consent should be visible on the receipt");
  const currentConsent = { accepted: true, planId: lockPlanSnapshot.id, planLockId: waitingPlanLock.lockId, acceptedAt: "2026-06-04T10:01:00.000Z" };
  const consentedPlanLock = guard.buildPlanLock({
    planSnapshot: lockPlanSnapshot,
    scanSession: lockScanSession,
    riskBudget: lockRiskBudget,
    consent: currentConsent
  });
  assert.strictEqual(consentedPlanLock.status, "plan-lock-consented", "matching lock id should consent the current plan lock");
  assert.strictEqual(consentedPlanLock.readyForLaunch, true, "matching lock consent should be launch-ready");
  const consentReceipt = guard.buildExecutionConsentReceipt({
    planSnapshot: lockPlanSnapshot,
    executorPlan: lockExecutorPlan,
    runReadiness: lockRunReadiness,
    consent: currentConsent,
    planLock: consentedPlanLock
  });
  assert.strictEqual(consentReceipt.ready, true, "current plan-lock consent should produce a ready receipt");
  assert.strictEqual(consentReceipt.acceptedLockId, waitingPlanLock.lockId, "receipt should carry the accepted lock id");
  const lockLaunchGuard = guard.buildDryRunLaunchGuard({
    runReadiness: lockRunReadiness,
    consentReceipt,
    safetyInterlock: { dryRunAllowed: true, status: "dry-run-interlocked", realRunAllowed: false, destructiveCommands: false, primary: "safe" },
    planLock: consentedPlanLock
  });
  assert.strictEqual(lockLaunchGuard.ready, true, "dry-run launch should allow a current consented plan lock");
  const stalePlanLockLaunchGuard = guard.buildDryRunLaunchGuard({
    runReadiness: lockRunReadiness,
    consentReceipt: staleConsentReceipt,
    safetyInterlock: { dryRunAllowed: true, status: "dry-run-interlocked", realRunAllowed: false, destructiveCommands: false, primary: "safe" },
    planLock: stalePlanLock
  });
  assert.strictEqual(stalePlanLockLaunchGuard.ready, false, "dry-run launch should block stale plan locks");
  assert(stalePlanLockLaunchGuard.items.some((item) => item.id === "plan-lock" && !item.passed), "launch guard should name the plan-lock blocker");
  const driftScanSession = {
    ...lockScanSession,
    currentFingerprint: "scan-lock-2",
    primary: "Native scan settings changed."
  };
  const driftPlanLock = guard.buildPlanLock({
    planSnapshot: lockPlanSnapshot,
    scanSession: driftScanSession,
    riskBudget: lockRiskBudget
  });
  assert.strictEqual(driftPlanLock.status, "plan-lock-drift", "scan fingerprint drift should invalidate the plan lock");
  assert.strictEqual(driftPlanLock.readyForPreflight, false, "scan drift should block preflight");
  const driftPreflight = guard.buildExecutionPreflight({
    scanned: true,
    scanning: false,
    selectedIds: lockSelection,
    actionList: guard.actions,
    readiness: lockReadiness,
    protectedPaths: [],
    ledger: [],
    planSnapshot: lockPlanSnapshot,
    scanSession: driftScanSession,
    riskBudget: lockRiskBudget,
    planLock: driftPlanLock
  });
  assert.strictEqual(driftPreflight.ready, false, "preflight should fail when lock fingerprint drifts");
  assert(driftPreflight.items.some((item) => item.id === "plan-lock" && !item.passed), "drift preflight should expose plan-lock blocker");
  const lockedPowerCatalog = guard.buildTaskPowerCatalog({
    actionList: guard.actions,
    selectedIds: new Set(["windows-old"]),
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    intakePolicy: intakeBlockedPolicy
  });
  assert.strictEqual(lockedPowerCatalog.schemaVersion, "spaceguard-task-powers/v1", "task power catalog should expose a schema version");
  assert.strictEqual(lockedPowerCatalog.realRunEnabled, false, "task powers must not enable real execution");
  assert.strictEqual(
    lockedPowerCatalog.rows.find((row) => row.id === "admin-cleanup").status,
    "locked",
    "admin cleanup power should lock behind intake"
  );
  const cachePowerCatalog = guard.buildTaskPowerCatalog({
    actionList: guard.actions,
    selectedIds: new Set(["gradle-cache"]),
    approvals: { groupConfirm: false, reviewed: {}, typed: {} },
    intakePolicy: intakeAllowedPolicy
  });
  assert.strictEqual(
    cachePowerCatalog.rows.find((row) => row.id === "rebuildable-cache-cleanup").status,
    "needs-approval",
    "rebuildable cache power should wait for approval"
  );
  const activeCachePowerCatalog = guard.buildTaskPowerCatalog({
    actionList: guard.actions,
    selectedIds: new Set(["gradle-cache"]),
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    intakePolicy: intakeAllowedPolicy
  });
  assert.strictEqual(
    activeCachePowerCatalog.rows.find((row) => row.id === "rebuildable-cache-cleanup").status,
    "active",
    "rebuildable cache power should activate after approval"
  );
  const grantScanSession = {
    status: "current",
    readyForPlanning: true,
    currentFingerprint: "scan-grant-1"
  };
  const grantSelectedIds = new Set(["gradle-cache"]);
  const grantApprovals = { groupConfirm: true, reviewed: {}, reviewItems: {}, typed: {} };
  const unapprovedGrantPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: grantSelectedIds,
    actionList: guard.actions,
    approvals: { groupConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
    intakePolicy: intakeAllowedPolicy,
    scanSession: grantScanSession
  });
  const unapprovedGrantExecutorPlan = guard.buildExecutorPlan({
    selectedIds: grantSelectedIds,
    actionList: guard.actions,
    approvals: { groupConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
    intakePolicy: intakeAllowedPolicy
  });
  const unapprovedTaskGrants = guard.buildTaskCapabilityGrants({
    executorPlan: unapprovedGrantExecutorPlan,
    taskPowerCatalog: cachePowerCatalog,
    planSnapshot: unapprovedGrantPlanSnapshot,
    scanSession: grantScanSession,
    consentReceipt: { ready: false, planId: unapprovedGrantPlanSnapshot.id },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(unapprovedTaskGrants.status, "grants-waiting", "unapproved cache grants should wait rather than block");
  assert.strictEqual(unapprovedTaskGrants.rows[0].status, "waiting-gate", "unapproved cache grant should show a gate wait state");
  const grantPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: grantSelectedIds,
    actionList: guard.actions,
    approvals: grantApprovals,
    intakePolicy: intakeAllowedPolicy,
    scanSession: grantScanSession
  });
  const grantExecutorPlan = guard.buildExecutorPlan({
    selectedIds: grantSelectedIds,
    actionList: guard.actions,
    approvals: grantApprovals,
    intakePolicy: intakeAllowedPolicy
  });
  const waitingTaskGrants = guard.buildTaskCapabilityGrants({
    executorPlan: grantExecutorPlan,
    taskPowerCatalog: activeCachePowerCatalog,
    planSnapshot: grantPlanSnapshot,
    scanSession: grantScanSession,
    consentReceipt: { ready: false, planId: grantPlanSnapshot.id },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(waitingTaskGrants.schemaVersion, "spaceguard-task-capability-grants/v1", "task grants should expose a schema version");
  assert.strictEqual(waitingTaskGrants.status, "grants-waiting", "task grants should wait on current consent");
  assert.strictEqual(waitingTaskGrants.rows[0].status, "waiting-consent", "selected task grant should show consent wait state");
  assert.strictEqual(waitingTaskGrants.rows[0].realRunAvailable, false, "task grant must not expose real-run authority");
  const grantConsent = guard.buildExecutionConsentReceipt({
    planSnapshot: grantPlanSnapshot,
    executorPlan: grantExecutorPlan,
    runReadiness: { ready: true },
    consent: { accepted: true, planId: grantPlanSnapshot.id, acceptedAt: "2026-06-04T09:30:00.000Z" }
  });
  const issuedTaskGrants = guard.buildTaskCapabilityGrants({
    executorPlan: grantExecutorPlan,
    taskPowerCatalog: activeCachePowerCatalog,
    planSnapshot: grantPlanSnapshot,
    scanSession: grantScanSession,
    consentReceipt: grantConsent,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(issuedTaskGrants.status, "dry-run-grants-issued", "task grants should issue after scan and consent evidence are current");
  assert.strictEqual(issuedTaskGrants.counts.issued, 1, "one selected action should receive one dry-run grant");
  assert.strictEqual(issuedTaskGrants.rows[0].authority, "dry-run-only", "task grant authority should be dry-run only");
  assert(issuedTaskGrants.rows[0].expiresWith.includes("scan:scan-grant-1"), "task grant should expire with scan fingerprint");
  const unsafeTaskGrants = guard.buildTaskCapabilityGrants({
    executorPlan: grantExecutorPlan,
    taskPowerCatalog: activeCachePowerCatalog,
    planSnapshot: grantPlanSnapshot,
    scanSession: grantScanSession,
    consentReceipt: grantConsent,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafeTaskGrants.status, "unsafe-runtime", "runtime write capability should refuse task grants");
  assert.strictEqual(unsafeTaskGrants.realRunEnabled, false, "task grants must not inherit runtime write authority");
  const grantQuestionQueue = guard.buildAgentQuestionQueue({
    scanned: true,
    scanning: false,
    scanMode: "native-readonly",
    scanSession: grantScanSession,
    nativeCapability: { available: true },
    actionList: guard.actions,
    selectedIds: grantSelectedIds,
    approvals: grantApprovals,
    readiness: { ready: true, unresolved: [] },
    runReadiness: { ready: true },
    consentReceipt: { ready: false, planId: grantPlanSnapshot.id },
    intakePolicy: intakeAllowedPolicy
  });
  const waitingPowerBroker = guard.buildTaskPowerBroker({
    taskPowerCatalog: activeCachePowerCatalog,
    taskCapabilityGrants: waitingTaskGrants,
    agentQuestionQueue: grantQuestionQueue,
    runReadiness: { ready: true },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(waitingPowerBroker.schemaVersion, "spaceguard-task-power-broker/v1", "task power broker should expose a schema version");
  assert.strictEqual(waitingPowerBroker.status, "broker-waiting", "broker should wait while a selected power lacks current consent");
  assert.strictEqual(waitingPowerBroker.authority, "task-scoped-dry-run", "broker should keep task authority scoped to dry-run");
  assert.strictEqual(waitingPowerBroker.standingPermission, false, "broker must not create standing permission");
  assert.strictEqual(waitingPowerBroker.realRunEnabled, false, "broker must not enable real cleanup");
  assert.strictEqual(waitingPowerBroker.activeQuestion.id, "arm-dry-run", "broker should preserve the active user question");
  assert.strictEqual(waitingPowerBroker.currentRequest.powerId, "rebuildable-cache-cleanup", "broker should focus the selected power request");
  assert(waitingPowerBroker.currentRequest.expiresWith.includes(`plan:${grantPlanSnapshot.id}`), "broker request should expire with the current plan");
  const issuedPowerBroker = guard.buildTaskPowerBroker({
    taskPowerCatalog: activeCachePowerCatalog,
    taskCapabilityGrants: issuedTaskGrants,
    agentQuestionQueue: grantQuestionQueue,
    runReadiness: { ready: true },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(issuedPowerBroker.status, "broker-ready", "broker should become ready when dry-run grants are issued");
  assert.strictEqual(issuedPowerBroker.counts.granted, 1, "broker should count issued dry-run requests");
  const issuedPowerLeaseAudit = guard.buildTaskPowerLeaseAudit({
    taskCapabilityGrants: issuedTaskGrants,
    taskPowerBroker: issuedPowerBroker,
    planSnapshot: grantPlanSnapshot,
    scanSession: grantScanSession,
    consentReceipt: grantConsent,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(issuedPowerLeaseAudit.schemaVersion, "spaceguard-task-power-leases/v1", "task power lease audit should expose a schema version");
  assert.strictEqual(issuedPowerLeaseAudit.status, "leases-current", "issued task grants should create current dry-run leases");
  assert.strictEqual(issuedPowerLeaseAudit.counts.current, 1, "lease audit should count the current lease");
  assert.strictEqual(issuedPowerLeaseAudit.rows[0].canRealRun, false, "lease audit must not expose real-run authority");
  assert(issuedPowerLeaseAudit.rows[0].checks.every((check) => check.passed), "current lease should pass plan, scan, consent, broker, and runtime checks");
  const stalePowerLeaseAudit = guard.buildTaskPowerLeaseAudit({
    taskCapabilityGrants: issuedTaskGrants,
    taskPowerBroker: issuedPowerBroker,
    planSnapshot: { id: "changed-plan" },
    scanSession: grantScanSession,
    consentReceipt: { ready: true, planId: "changed-plan" },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(stalePowerLeaseAudit.status, "leases-stale", "lease audit should expire grants when the plan changes");
  assert.strictEqual(stalePowerLeaseAudit.rows[0].status, "stale", "mismatched plan evidence should stale the lease row");
  assert.strictEqual(stalePowerLeaseAudit.rows[0].checks.find((check) => check.id === "plan").passed, false, "stale lease should show failed plan check");
  const unsafePowerLeaseAudit = guard.buildTaskPowerLeaseAudit({
    taskCapabilityGrants: issuedTaskGrants,
    taskPowerBroker: issuedPowerBroker,
    planSnapshot: grantPlanSnapshot,
    scanSession: grantScanSession,
    consentReceipt: grantConsent,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafePowerLeaseAudit.status, "unsafe-runtime", "runtime write capability should refuse task power leases");
  assert.strictEqual(unsafePowerLeaseAudit.realRunEnabled, false, "lease audit must keep real execution disabled");
  const standingPermissionLeaseAudit = guard.buildTaskPowerLeaseAudit({
    taskCapabilityGrants: issuedTaskGrants,
    taskPowerBroker: { ...issuedPowerBroker, standingPermission: true },
    planSnapshot: grantPlanSnapshot,
    scanSession: grantScanSession,
    consentReceipt: grantConsent,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(standingPermissionLeaseAudit.status, "unsafe-runtime", "standing permission should make power leases unsafe");
  assert.strictEqual(standingPermissionLeaseAudit.standingPermission, true, "lease audit should surface standing permission violations");
  assert.strictEqual(standingPermissionLeaseAudit.counts.standingPermission, 1, "lease audit should count standing permission violations");
  const dryRunSafetyInterlock = guard.buildSafetyInterlock({
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false },
    nativeScan: { writeCapability: false, destructiveCommands: false },
    scanSession: grantScanSession,
    runReadiness: { ready: true, blockedCount: 0 },
    consentReceipt: grantConsent,
    executorPlan: grantExecutorPlan,
    taskPowerBroker: issuedPowerBroker,
    taskCapabilityGrants: issuedTaskGrants,
    taskPowerLeaseAudit: issuedPowerLeaseAudit,
    writeBoundaryProbe: { status: "not-run", rejectionEvidence: false },
    releaseReviewPacket: { status: "review-waiting", writeSignalVisible: false },
    writeReadiness: { status: "implementation-locked", readyForRealExecution: false, primary: "Real execution remains locked." }
  });
  assert.strictEqual(dryRunSafetyInterlock.schemaVersion, "spaceguard-safety-interlock/v1", "safety interlock should expose a schema version");
  assert.strictEqual(dryRunSafetyInterlock.status, "dry-run-interlocked", "current safe evidence should allow dry-run only");
  assert.strictEqual(dryRunSafetyInterlock.dryRunAllowed, true, "interlock should allow dry-run when all dry-run gates pass");
  assert.strictEqual(dryRunSafetyInterlock.realRunAllowed, false, "interlock must never allow real execution in this build");
  assert.strictEqual(dryRunSafetyInterlock.rows.find((row) => row.id === "write-boundary").blocksDryRun, false, "write-boundary evidence should not block current dry-run simulation");
  const staleSafetyInterlock = guard.buildSafetyInterlock({
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false },
    nativeScan: { writeCapability: false, destructiveCommands: false },
    scanSession: grantScanSession,
    runReadiness: { ready: true, blockedCount: 0 },
    consentReceipt: grantConsent,
    executorPlan: grantExecutorPlan,
    taskPowerBroker: issuedPowerBroker,
    taskCapabilityGrants: issuedTaskGrants,
    taskPowerLeaseAudit: stalePowerLeaseAudit,
    writeReadiness: { status: "implementation-locked", readyForRealExecution: false }
  });
  assert.strictEqual(staleSafetyInterlock.status, "interlock-hold", "stale task leases should hold the safety interlock");
  assert.strictEqual(staleSafetyInterlock.dryRunAllowed, false, "stale task leases should block dry-run");
  assert(staleSafetyInterlock.holdRows.some((row) => row.id === "power-lease-current"), "stale interlock should name task power leases as the hold row");
  const unsafeSafetyInterlock = guard.buildSafetyInterlock({
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true },
    nativeScan: { writeCapability: true, destructiveCommands: true },
    scanSession: grantScanSession,
    runReadiness: { ready: true, blockedCount: 0 },
    consentReceipt: grantConsent,
    executorPlan: grantExecutorPlan,
    taskPowerBroker: issuedPowerBroker,
    taskCapabilityGrants: issuedTaskGrants,
    taskPowerLeaseAudit: issuedPowerLeaseAudit,
    releaseReviewPacket: { status: "unsafe-stop", writeSignalVisible: true },
    writeReadiness: { status: "ready-for-real-execution", readyForRealExecution: true }
  });
  assert.strictEqual(unsafeSafetyInterlock.status, "unsafe-stop", "unsafe runtime signals should stop the safety interlock");
  assert.strictEqual(unsafeSafetyInterlock.counts.unsafe > 0, true, "unsafe interlock should count unsafe rows");
  assert.strictEqual(unsafeSafetyInterlock.dryRunAllowed, false, "unsafe interlock should block dry-run");
  const readyLaunchGuard = guard.buildDryRunLaunchGuard({
    runReadiness: { ready: true },
    consentReceipt: grantConsent,
    safetyInterlock: dryRunSafetyInterlock
  });
  assert.strictEqual(readyLaunchGuard.schemaVersion, "spaceguard-dry-run-launch-guard/v1", "dry-run launch guard should expose a schema version");
  assert.strictEqual(readyLaunchGuard.status, "dry-run-launch-ready", "launch guard should pass when consent and safety interlock are current");
  assert.strictEqual(readyLaunchGuard.ready, true, "launch guard should allow dry-run launch when all launch checks pass");
  assert.strictEqual(readyLaunchGuard.realRunAllowed, false, "launch guard must not allow real execution");
  const staleLaunchGuard = guard.buildDryRunLaunchGuard({
    runReadiness: { ready: true },
    consentReceipt: grantConsent,
    safetyInterlock: staleSafetyInterlock
  });
  assert.strictEqual(staleLaunchGuard.status, "dry-run-launch-blocked", "stale interlock should block dry-run launch");
  assert.strictEqual(staleLaunchGuard.ready, false, "stale launch guard must not allow dry-run");
  assert(staleLaunchGuard.blockedItems.some((item) => item.id === "safety-interlock"), "stale launch guard should name safety interlock as blocker");
  const unsafeLaunchGuard = guard.buildDryRunLaunchGuard({
    runReadiness: { ready: true },
    consentReceipt: grantConsent,
    safetyInterlock: unsafeSafetyInterlock
  });
  assert.strictEqual(unsafeLaunchGuard.status, "unsafe-stop", "unsafe interlock should stop dry-run launch");
  assert.strictEqual(unsafeLaunchGuard.ready, false, "unsafe launch guard should block dry-run");
  const unsafePowerBroker = guard.buildTaskPowerBroker({
    taskPowerCatalog: activeCachePowerCatalog,
    taskCapabilityGrants: unsafeTaskGrants,
    agentQuestionQueue: grantQuestionQueue,
    runReadiness: { ready: true },
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafePowerBroker.status, "unsafe-stop", "runtime write capability should stop the broker");
  assert.strictEqual(unsafePowerBroker.counts.realRun, 0, "broker should never count real-run requests");
  const waitingTaskRunbook = guard.buildAgentTaskRunbook({
    executorPlan: grantExecutorPlan,
    taskCapabilityGrants: waitingTaskGrants,
    agentQuestionQueue: grantQuestionQueue
  });
  assert.strictEqual(waitingTaskRunbook.schemaVersion, "spaceguard-agent-task-runbook/v1", "task runbook should expose a schema version");
  assert.strictEqual(waitingTaskRunbook.authority, "task-scoped-dry-run", "task runbook should stay task-scoped");
  assert.strictEqual(waitingTaskRunbook.noCrossTaskAuthority, true, "task runbook must refuse cross-task authority");
  assert.strictEqual(waitingTaskRunbook.rows[0].status, "waiting-consent", "task runbook should surface grant wait state");
  assert.strictEqual(waitingTaskRunbook.rows[0].questionId, "arm-dry-run", "task runbook should attach the next user question");
  assert(waitingTaskRunbook.rows[0].forbiddenOperations.some((operation) => operation.includes("Mutate files")), "task runbook should list forbidden mutation");
  const issuedTaskRunbook = guard.buildAgentTaskRunbook({
    executorPlan: grantExecutorPlan,
    taskCapabilityGrants: issuedTaskGrants,
    agentQuestionQueue: grantQuestionQueue
  });
  assert.strictEqual(issuedTaskRunbook.status, "ready-for-dry-run", "issued task grants should create ready dry-run work orders");
  assert.strictEqual(issuedTaskRunbook.counts.ready, 1, "one selected grant should create one ready work order");
  assert.strictEqual(issuedTaskRunbook.rows[0].canDryRun, true, "ready work order can enter dry-run simulation");
  assert.strictEqual(issuedTaskRunbook.rows[0].canRealRun, false, "task runbook must keep real run locked");
  const unsafeTaskRunbook = guard.buildAgentTaskRunbook({
    executorPlan: grantExecutorPlan,
    taskCapabilityGrants: unsafeTaskGrants,
    agentQuestionQueue: grantQuestionQueue
  });
  assert.strictEqual(unsafeTaskRunbook.status, "unsafe-stop", "unsafe runtime should stop task runbook");
  assert.strictEqual(unsafeTaskRunbook.counts.realRun, 0, "task runbook should never count real-run work orders");
  const taskRunbookReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: guard.actions,
    selectedIds: grantSelectedIds,
    readiness: { ready: true, unresolved: [] },
    ledger: [],
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    taskRunbook: issuedTaskRunbook,
    taskPowerBroker: issuedPowerBroker,
    taskCapabilityGrants: issuedTaskGrants,
    taskPowerLeaseAudit: issuedPowerLeaseAudit,
    safetyInterlock: dryRunSafetyInterlock,
    dryRunLaunchGuard: readyLaunchGuard,
    taskPowerCatalog: activeCachePowerCatalog
  });
  assert(taskRunbookReport.includes("## Task Power Broker"), "report should include task power broker");
  assert(taskRunbookReport.includes("Standing permission: no"), "task power broker report should preserve no-standing-permission boundary");
  assert(taskRunbookReport.includes("## Safety Interlock"), "report should include safety interlock");
  assert(taskRunbookReport.includes("Dry-run allowed: yes"), "safety interlock report should capture dry-run allowance");
  assert(taskRunbookReport.includes("## Dry-Run Launch Guard"), "report should include dry-run launch guard");
  assert(taskRunbookReport.includes("Ready: yes"), "dry-run launch guard report should capture launch readiness");
  assert(taskRunbookReport.includes("## Task Power Lease Audit"), "report should include task power lease audit");
  assert(taskRunbookReport.includes("Current leases: 1"), "task power lease report should capture current lease count");
  assert(taskRunbookReport.includes("## Task Runbook"), "report should include task runbook");
  assert(taskRunbookReport.includes("No cross-task authority: yes"), "task runbook report should preserve scope boundary");
  const restrictionMatrix = guard.buildRestrictionPolicyMatrix({
    actionList: guard.actions,
    selectedIds: new Set(["browser-identity", "partitioning", "windows-old"]),
    intakePolicy: intakeBlockedPolicy,
    taskRunbook: issuedTaskRunbook,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(restrictionMatrix.schemaVersion, "spaceguard-restriction-policy-matrix/v1", "restriction matrix should expose a schema version");
  assert.strictEqual(restrictionMatrix.realRunEnabled, false, "restriction matrix should not enable real runs");
  assert.strictEqual(restrictionMatrix.counts.realRun, 0, "restriction matrix should never count real-run routes");
  assert.strictEqual(
    restrictionMatrix.rows.find((row) => row.id === "browser-identity").canCreateExecutor,
    false,
    "browser identity restriction should never create executor routes"
  );
  assert.strictEqual(
    restrictionMatrix.rows.find((row) => row.id === "partitioning").status,
    "advisory-only",
    "partition restriction should stay advisory-only"
  );
  assert.strictEqual(
    restrictionMatrix.rows.find((row) => row.id === "admin-system").status,
    "intake-gated",
    "admin/system restriction should follow intake gate"
  );
  const unsafeRestrictionMatrix = guard.buildRestrictionPolicyMatrix({
    actionList: guard.actions,
    selectedIds: grantSelectedIds,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafeRestrictionMatrix.status, "unsafe-runtime", "runtime write capability should stop restriction policy");
  const restrictionReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: guard.actions,
    selectedIds: grantSelectedIds,
    readiness: { ready: true, unresolved: [] },
    ledger: [],
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    restrictionPolicyMatrix: restrictionMatrix
  });
  assert(restrictionReport.includes("## Restriction Policy Matrix"), "report should include restriction policy matrix");
  assert(restrictionReport.includes("Real-run routes: 0"), "restriction matrix report should keep real-run routes at zero");
  assert.strictEqual(
    guard.buildTaskPowerCatalog({ actionList: guard.actions }).rows.find((row) => row.id === "restricted-zones").status,
    "blocked",
    "restricted-zone power should always remain blocked"
  );
  const sessionSettings = {
    targetDrive: "C:",
    includeProjectArtifacts: true,
    maxDepth: 8,
    maxEntriesPerRoot: 25000,
    customRoots: ["C:\\Users\\demo\\Archives"]
  };
  const scanRequestGuard = guard.buildNativeScanRequestGuard({
    scanSettings: sessionSettings,
    protectedPaths: ["C:\\Users\\demo\\ClientWork"]
  });
  assert.strictEqual(scanRequestGuard.schemaVersion, "spaceguard-native-scan-request-guard/v1", "native scan request guard should expose a schema version");
  assert.strictEqual(scanRequestGuard.canScan, true, "valid native scan settings should pass the request guard");
  assert.strictEqual(scanRequestGuard.rows.some((row) => row.status === "blocked"), false, "valid native scan settings should not expose blockers");
  const duplicateRootGuard = guard.buildNativeScanRequestGuard({
    scanSettings: {
      ...sessionSettings,
      customRoots: ["C:\\Users\\demo\\Archives", "c:\\users\\demo\\archives"]
    },
    protectedPaths: []
  });
  assert.strictEqual(duplicateRootGuard.canScan, true, "duplicate custom roots should be dedupe warnings, not scan blockers");
  assert.strictEqual(duplicateRootGuard.rows.find((row) => row.id === "duplicate-custom-roots").status, "review", "duplicate custom roots should be visible for review");
  const blockedScanRequestGuard = guard.buildNativeScanRequestGuard({
    scanSettings: {
      targetDrive: "CD",
      includeProjectArtifacts: true,
      maxDepth: 99,
      maxEntriesPerRoot: 999999,
      customRoots: ["C:\\", "C:\\Windows", "C:\\Users\\demo\\ClientWork", "/"]
    },
    protectedPaths: ["C:\\Users\\demo\\ClientWork"]
  });
  assert.strictEqual(blockedScanRequestGuard.canScan, false, "unsafe native scan settings should block scan invocation");
  assert(blockedScanRequestGuard.blockers.some((row) => row.id === "target-drive"), "native scan guard should block malformed target drives");
  assert(blockedScanRequestGuard.blockers.some((row) => row.id === "traversal-depth"), "native scan guard should block unapproved traversal depth");
  assert(blockedScanRequestGuard.blockers.some((row) => row.id === "entry-cap"), "native scan guard should block unapproved entry caps");
  assert(blockedScanRequestGuard.blockers.some((row) => row.id === "system-root-boundary"), "native scan guard should block broad system roots");
  assert(blockedScanRequestGuard.blockers.some((row) => row.id === "protected-root-overlap"), "native scan guard should block protected path overlap");
  const capturedNativeScan = {
    available: true,
    generatedAt: "2026-06-04T09:00:00.000Z",
    targetDrive: "C:",
    request: {
      ...sessionSettings,
      protectedPaths: ["C:\\Users\\demo\\ClientWork"]
    },
    findings: [],
    warnings: [],
    writeCapability: false,
    destructiveCommands: false
  };
  const currentScanSession = guard.buildScanSessionEvidence({
    scanned: true,
    scanning: false,
    scanMode: "native-readonly",
    scanSettings: sessionSettings,
    protectedPaths: ["C:\\Users\\demo\\ClientWork"],
    nativeScan: capturedNativeScan
  });
  assert.strictEqual(currentScanSession.schemaVersion, "spaceguard-scan-session/v1", "scan sessions should expose a schema version");
  assert.strictEqual(currentScanSession.status, "native-current", "matching native request evidence should be current");
  assert.strictEqual(currentScanSession.readyForPlanning, true, "current native session should allow planning");
  const browserSetupAssistant = guard.buildWindowsSetupAssistant({
    nativeCapability: { available: false },
    runtimeCapabilities: { available: false, realRunEnabled: false, destructiveCommands: false },
    scanMode: "demo",
    scanSession: null
  });
  assert.strictEqual(browserSetupAssistant.schemaVersion, "spaceguard-windows-setup-assistant/v1", "setup assistant should expose a schema version");
  assert.strictEqual(browserSetupAssistant.status, "browser-demo", "browser setup should identify demo-only mode");
  assert.strictEqual(browserSetupAssistant.realCleanupEnabled, false, "setup assistant must not enable real cleanup");
  assert.strictEqual(browserSetupAssistant.counts.realRun, 0, "setup assistant should never count real-run setup routes");
  assert(browserSetupAssistant.commands.every((command) => command.destructive === false), "setup commands must be non-destructive");
  assert(browserSetupAssistant.forbiddenCommands.includes("Remove-Item"), "setup assistant should explicitly forbid direct delete commands");
  const nativeSetupAssistant = guard.buildWindowsSetupAssistant({
    nativeCapability: { available: true },
    runtimeCapabilities: { available: true, platform: "windows", scanKnownRoots: true, realRunEnabled: false, destructiveCommands: false },
    scanMode: "native-readonly",
    scanSession: currentScanSession,
    scanCoverage: { confidenceScore: 80 },
    privacyBoundary: { cloudDisabled: true, telemetryDisabled: true, exportOnly: true },
    publicBetaReadiness: { readyForNativeBeta: false },
    validationPack: { readyForRealRun: false },
    releaseGate: { readyForRealRun: false }
  });
  assert.strictEqual(nativeSetupAssistant.status, "native-scan-ready", "setup assistant should recognize current native scan evidence");
  assert.strictEqual(nativeSetupAssistant.nativeScanCurrent, true, "setup assistant should expose current scan state");
  assert.strictEqual(nativeSetupAssistant.destructiveCommands, false, "native setup assistant should keep destructive commands disabled");
  const unsafeSetupAssistant = guard.buildWindowsSetupAssistant({
    nativeCapability: { available: true },
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true },
    scanMode: "native-readonly",
    scanSession: currentScanSession
  });
  assert.strictEqual(unsafeSetupAssistant.status, "unsafe-runtime", "setup assistant should stop when runtime write capability appears");
  const setupReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: guard.actions,
    selectedIds: new Set(["windows-temp"]),
    readiness: { ready: true, unresolved: [] },
    ledger: [],
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    windowsSetupAssistant: nativeSetupAssistant
  });
  assert(setupReport.includes("## Windows Setup Assistant"), "report should include setup assistant");
  assert(setupReport.includes("Real-run setup routes: 0"), "setup report should keep real-run setup routes at zero");
  const demoNoScanRunbook = guard.buildDemoRehearsalRunbook({
    scanned: false,
    scanning: false,
    scanMode: "demo",
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(demoNoScanRunbook.schemaVersion, "spaceguard-demo-rehearsal-runbook/v1", "demo rehearsal should expose a schema version");
  assert.strictEqual(demoNoScanRunbook.status, "demo-scan-waiting", "demo rehearsal should start by waiting for a demo scan");
  assert.strictEqual(demoNoScanRunbook.requiresNativeData, false, "demo rehearsal should not require real local data");
  assert.strictEqual(demoNoScanRunbook.realCleanupEnabled, false, "demo rehearsal must not enable real cleanup");
  assert.strictEqual(demoNoScanRunbook.safeForPublicDemo, true, "browser demo rehearsal should be safe while writes are locked");
  assert(demoNoScanRunbook.inAppActions.every((action) => action.destructive === false), "demo rehearsal actions must be non-destructive");
  const demoScanSession = guard.buildScanSessionEvidence({
    scanned: true,
    scanning: false,
    scanMode: "demo",
    scanSettings: sessionSettings,
    protectedPaths: [],
    nativeScan: null
  });
  const demoSelectedIds = new Set(["gradle-cache"]);
  const demoApprovals = { groupConfirm: true, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} };
  const demoReadiness = guard.getExecutionReadinessForActions(demoSelectedIds, demoApprovals, guard.actions, [], {}, intakeAllowedPolicy);
  const demoPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: demoSelectedIds,
    actionList: guard.actions,
    approvals: demoApprovals,
    scanMode: "demo",
    scanSession: demoScanSession,
    intakePolicy: intakeAllowedPolicy
  });
  const demoPreflight = guard.buildExecutionPreflight({
    scanned: true,
    scanning: false,
    selectedIds: demoSelectedIds,
    actionList: guard.actions,
    readiness: demoReadiness,
    protectedPaths: [],
    ledger: [],
    planSnapshot: demoPlanSnapshot,
    scanSession: demoScanSession
  });
  const demoExecutorPlan = guard.buildExecutorPlan({
    selectedIds: demoSelectedIds,
    actionList: guard.actions,
    approvals: demoApprovals,
    protectedPaths: [],
    scanMode: "demo",
    preflight: demoPreflight,
    intakePolicy: intakeAllowedPolicy
  });
  const demoRunReadiness = guard.buildRunReadiness(demoPreflight, guard.buildExecutorReadiness(demoExecutorPlan, demoPreflight));
  const demoConsentReceipt = guard.buildExecutionConsentReceipt({
    planSnapshot: demoPlanSnapshot,
    executorPlan: demoExecutorPlan,
    runReadiness: demoRunReadiness,
    consent: { accepted: true, planId: demoPlanSnapshot.id, acceptedAt: "2026-06-04T10:00:00.000Z" }
  });
  const simulationReadyRunbook = guard.buildDemoRehearsalRunbook({
    scanned: true,
    scanning: false,
    scanMode: "demo",
    scanSession: demoScanSession,
    actionList: guard.actions,
    selectedIds: demoSelectedIds,
    readiness: demoReadiness,
    executorPlan: demoExecutorPlan,
    windowsSetupAssistant: browserSetupAssistant,
    runReadiness: demoRunReadiness,
    consentReceipt: demoConsentReceipt,
    planSnapshot: demoPlanSnapshot,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(simulationReadyRunbook.status, "demo-simulation-ready", "armed demo rehearsal should be ready for simulated ledger");
  assert.strictEqual(simulationReadyRunbook.counts.realRun, 0, "demo rehearsal should never count real-run routes");
  const demoGateApprovals = { groupConfirm: false, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} };
  const demoGateReadiness = guard.getExecutionReadinessForActions(demoSelectedIds, demoGateApprovals, guard.actions, [], {}, intakeAllowedPolicy);
  const demoGateQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    scanning: false,
    scanMode: "demo",
    scanSession: demoScanSession,
    actionList: guard.actions,
    selectedIds: demoSelectedIds,
    approvals: demoGateApprovals,
    readiness: demoGateReadiness,
    intakePolicy: intakeAllowedPolicy
  });
  const gateWaitingRunbook = guard.buildDemoRehearsalRunbook({
    scanned: true,
    scanning: false,
    scanMode: "demo",
    scanSession: demoScanSession,
    actionList: guard.actions,
    selectedIds: demoSelectedIds,
    readiness: demoGateReadiness,
    executorPlan: demoExecutorPlan,
    windowsSetupAssistant: browserSetupAssistant,
    agentQuestionQueue: demoGateQuestions,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(gateWaitingRunbook.status, "demo-gates-waiting", "demo rehearsal should wait on unresolved gates");
  assert.strictEqual(gateWaitingRunbook.activeQuestionId, demoGateQuestions.activeQuestion.id, "demo rehearsal should preserve active question id");
  assert.strictEqual(gateWaitingRunbook.activeQuestion, demoGateQuestions.activeQuestion.prompt, "demo rehearsal should preserve active question prompt");
  assert.strictEqual(gateWaitingRunbook.primary, demoGateQuestions.activeQuestion.prompt, "demo rehearsal primary should use active question prompt");
  const demoLedger = guard.makeExecutionLedgerForActions(demoSelectedIds, guard.actions, [], {
    approvals: demoApprovals,
    planSnapshot: demoPlanSnapshot,
    executedAt: "2026-06-04T10:02:00.000Z"
  });
  const evidenceReadyRunbook = guard.buildDemoRehearsalRunbook({
    scanned: true,
    scanning: false,
    scanMode: "demo",
    scanSession: demoScanSession,
    actionList: guard.actions,
    selectedIds: demoSelectedIds,
    readiness: demoReadiness,
    executorPlan: demoExecutorPlan,
    windowsSetupAssistant: browserSetupAssistant,
    runReadiness: demoRunReadiness,
    consentReceipt: demoConsentReceipt,
    ledger: demoLedger,
    planSnapshot: demoPlanSnapshot,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(evidenceReadyRunbook.status, "demo-evidence-ready", "demo ledger should complete rehearsal evidence");
  assert.strictEqual(evidenceReadyRunbook.evidenceComplete, true, "demo rehearsal should expose complete evidence state");
  const nativeModeRehearsal = guard.buildDemoRehearsalRunbook({
    scanned: true,
    scanning: false,
    scanMode: "native-readonly",
    scanSession: currentScanSession,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(nativeModeRehearsal.status, "switch-to-demo", "rehearsal should not use native local data");
  const unsafeDemoRehearsal = guard.buildDemoRehearsalRunbook({
    scanned: true,
    scanning: false,
    scanMode: "demo",
    scanSession: demoScanSession,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafeDemoRehearsal.status, "unsafe-stop", "demo rehearsal should stop on runtime write capability");
  assert.strictEqual(unsafeDemoRehearsal.safeForPublicDemo, false, "unsafe runtime should not be public-demo safe");
  const demoRehearsalReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: guard.actions,
    selectedIds: demoSelectedIds,
    readiness: demoReadiness,
    ledger: demoLedger,
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    demoRehearsalRunbook: evidenceReadyRunbook
  });
  assert(demoRehearsalReport.includes("## Demo Rehearsal Runbook"), "report should include demo rehearsal runbook");
  assert(demoRehearsalReport.includes("Requires native data: no"), "demo rehearsal report should keep native-data boundary visible");
  assert(demoRehearsalReport.includes("Real-run routes: 0"), "demo rehearsal report should keep real-run routes at zero");
  const productCompletionAudit = guard.buildProductCompletionAudit({
    scanned: true,
    scanMode: "demo",
    actionList: guard.actions,
    selectedIds: demoSelectedIds,
    readiness: demoReadiness,
    scanSession: demoScanSession,
    scanCoverage: { schemaVersion: "spaceguard-scan-coverage/v1", confidenceScore: 40 },
    demoRehearsalRunbook: evidenceReadyRunbook,
    windowsSetupAssistant: browserSetupAssistant,
    taskPowerCatalog: activeCachePowerCatalog,
    taskCapabilityGrants: issuedTaskGrants,
    taskRunbook: issuedTaskRunbook,
    restrictionPolicyMatrix: restrictionMatrix,
    agentQuestionQueue: grantQuestionQueue,
    executorPlan: demoExecutorPlan,
    runReadiness: demoRunReadiness,
    consentReceipt: demoConsentReceipt,
    ledger: demoLedger,
    planSnapshot: demoPlanSnapshot,
    privacyBoundary: { cloudDisabled: true, telemetryDisabled: true, exportOnly: true, status: "demo-local-only" },
    supportBundle: { schemaVersion: "spaceguard-support-bundle/v1" },
    validationPack: { schemaVersion: "spaceguard-validation-pack/v1" },
    releaseReviewPacket: { schemaVersion: "spaceguard-release-review-packet/v1", status: "review-waiting", counts: { passed: 4, total: 12 }, writeSignalVisible: false, readyForRealExecution: false },
    writeReadiness: { schemaVersion: "spaceguard-write-readiness/v1", status: "implementation-locked", readyForRealExecution: false, primary: "Real executor implementation is missing." },
    realExecutorCapsule: { schemaVersion: "spaceguard-real-executor-capsule/v1", destructiveActionAvailable: false },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(productCompletionAudit.schemaVersion, "spaceguard-product-completion-audit/v1", "product audit should expose a schema version");
  assert.strictEqual(productCompletionAudit.status, "demo-workflow-proven", "product audit should recognize proven demo workflow");
  assert.strictEqual(productCompletionAudit.publicDemoReady, true, "product audit should mark public demo ready when rehearsal is safe");
  assert.strictEqual(productCompletionAudit.productComplete, false, "product audit must not mark full product complete while real cleanup is locked");
  assert.strictEqual(productCompletionAudit.realCleanupLocked, true, "product audit should keep real cleanup lock visible");
  assert.strictEqual(
    productCompletionAudit.rows.find((row) => row.id === "real-cleanup").status,
    "future-locked",
    "real cleanup row should remain future locked"
  );
  const scopedExecutorAudit = guard.buildProductCompletionAudit({
    scanned: true,
    scanMode: "native-readonly",
    scanSession: { status: "native-current", readyForPlanning: true, nativeEvidence: true },
    runtimeCapabilities: {
      realRunEnabled: true,
      destructiveCommands: true,
      safeExecutorsEnabled: true,
      executorFlags: { tempCleanupExecutor: true }
    }
  });
  assert.strictEqual(scopedExecutorAudit.status, "scoped-real-cleanup-ready", "product audit should recognize scoped native executor readiness");
  assert.strictEqual(scopedExecutorAudit.realCleanupLocked, false, "scoped executor flags should unlock scoped real cleanup status");
  assert.strictEqual(scopedExecutorAudit.broadCleanupLocked, true, "broad cleanup should remain locked even when scoped executors are enabled");
  assert.deepStrictEqual(scopedExecutorAudit.scopedRealExecutorRoutes, ["known-temp-delete"], "product audit should list enabled scoped executor routes");
  assert.strictEqual(
    scopedExecutorAudit.rows.find((row) => row.id === "real-cleanup").status,
    "native-proven",
    "real cleanup row should be native-proven for scoped executor flags"
  );
  const scopedExecutorHandoff = guard.buildWorkflowHandoffPacket({
    productCompletionAudit: scopedExecutorAudit,
    runtimeCapabilities: {
      realRunEnabled: true,
      destructiveCommands: true,
      executorFlags: { tempCleanupExecutor: true }
    }
  });
  assert.strictEqual(scopedExecutorHandoff.status, "scoped-handoff-ready", "workflow handoff should allow scoped executor resume state");
  assert.strictEqual(scopedExecutorHandoff.realCleanupLocked, false, "workflow handoff should not report scoped executor cleanup as locked");
  assert.strictEqual(scopedExecutorHandoff.broadCleanupLocked, true, "workflow handoff should keep broad cleanup locked");
  assert.strictEqual(scopedExecutorHandoff.scopedRealCleanupAvailable, true, "workflow handoff should expose scoped cleanup availability");
  const questionAwareAudit = guard.buildProductCompletionAudit({
    scanned: true,
    scanMode: "demo",
    actionList: guard.actions,
    selectedIds: demoSelectedIds,
    readiness: demoGateReadiness,
    scanSession: demoScanSession,
    agentQuestionQueue: demoGateQuestions,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(
    questionAwareAudit.rows.find((row) => row.id === "ask-and-follow").detail,
    demoGateQuestions.activeQuestion.prompt,
    "product audit should preserve active question prompt"
  );
  assert.strictEqual(
    questionAwareAudit.rows.find((row) => row.id === "ask-and-follow").nextStep,
    `Use ${demoGateQuestions.activeQuestion.action}.`,
    "product audit should preserve active question action"
  );
  const unsafeProductAudit = guard.buildProductCompletionAudit({
    scanned: true,
    scanMode: "demo",
    demoRehearsalRunbook: evidenceReadyRunbook,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafeProductAudit.status, "unsafe-stop", "product audit should stop on runtime write signals");
  const productAuditReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: guard.actions,
    selectedIds: demoSelectedIds,
    readiness: demoReadiness,
    ledger: demoLedger,
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    productCompletionAudit
  });
  assert(productAuditReport.includes("## Product Completion Audit"), "report should include product completion audit");
  assert(productAuditReport.includes("Product complete: no"), "product audit report should not overclaim full completion");
  assert(productAuditReport.includes("Real cleanup locked: yes"), "product audit report should preserve real cleanup lock");
  const staleScanSession = guard.buildScanSessionEvidence({
    scanned: true,
    scanning: false,
    scanMode: "native-readonly",
    scanSettings: { ...sessionSettings, targetDrive: "D:" },
    protectedPaths: ["C:\\Users\\demo\\ClientWork", "C:\\Users\\demo\\DoNotTouch"],
    nativeScan: capturedNativeScan
  });
  assert.strictEqual(staleScanSession.status, "native-stale", "changed scan settings should stale native evidence");
  assert.strictEqual(staleScanSession.readyForPlanning, false, "stale native sessions must block planning");
  assert(staleScanSession.changedSettings.includes("target drive"), "stale scan session should name target drive changes");
  assert(staleScanSession.changedSettings.includes("protected paths"), "stale scan session should name protected path changes");
  const scanSessionPlan = guard.buildPlanSnapshot({
    selectedIds: new Set(["windows-temp"]),
    actionList: guard.actions,
    scanMode: "native-readonly",
    scanSession: currentScanSession
  });
  const staleScanSessionPlan = guard.buildPlanSnapshot({
    selectedIds: new Set(["windows-temp"]),
    actionList: guard.actions,
    scanMode: "native-readonly",
    scanSession: staleScanSession
  });
  assert.notStrictEqual(scanSessionPlan.id, staleScanSessionPlan.id, "plan snapshots should change when scan-session evidence changes");
  const staleSessionPreflight = guard.buildExecutionPreflight({
    scanned: true,
    scanning: false,
    selectedIds: new Set(["windows-temp"]),
    actionList: guard.actions,
    readiness: { unresolved: [] },
    ledger: [],
    planSnapshot: staleScanSessionPlan,
    scanSession: staleScanSession
  });
  assert.strictEqual(staleSessionPreflight.ready, false, "stale scan sessions should block execution preflight");
  assert.strictEqual(
    staleSessionPreflight.items.find((item) => item.id === "scan-session-current").passed,
    false,
    "preflight should expose stale scan session as a failed item"
  );
  const staleSessionQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    scanning: false,
    scanMode: "native-readonly",
    scanSession: staleScanSession,
    nativeCapability: { available: true },
    actionList: guard.actions,
    selectedIds: new Set(["windows-temp"]),
    approvals: {},
    readiness: { unresolved: [] }
  });
  assert.strictEqual(staleSessionQuestions.activeQuestion.id, "refresh-scan-session", "agent should ask for a fresh scan when session evidence is stale");
  assert.strictEqual(staleSessionQuestions.activeQuestion.action, "run-real-scan", "stale native evidence should route to a fresh real scan");

  const wslOnly = new Set(["wsl-vhdx"]);
  assert.strictEqual(
    guard.getExecutionReadiness(wslOnly, { groupConfirm: true, reviewed: {}, typed: {} }).ready,
    false,
    "typed advanced actions need exact phrase"
  );
  assert.strictEqual(
    guard.getExecutionReadiness(wslOnly, { groupConfirm: true, reviewed: {}, typed: { "wsl-vhdx": "COMPACT WSL" } }).ready,
    true,
    "typed advanced action should unlock with exact phrase"
  );

  const reviewOnly = new Set(["downloads-installers"]);
  assert.strictEqual(
    guard.getExecutionReadiness(reviewOnly, { groupConfirm: true, reviewed: {}, typed: {} }).ready,
    false,
    "review actions need item review approval"
  );
  assert.strictEqual(
    guard.getExecutionReadiness(reviewOnly, { groupConfirm: true, reviewed: { "downloads-installers": true }, reviewItems: {}, typed: {} }).ready,
    false,
    "broad review approval must not unlock item-level review actions"
  );
  const downloadsItemApprovals = makeReviewApprovals(guard.actions);
  const downloadsItemReviews = guard.buildReviewItemsByAction(guard.actions, null, [], downloadsItemApprovals);
  assert.strictEqual(
    guard.getExecutionReadinessForActions(reviewOnly, downloadsItemApprovals, guard.actions, [], downloadsItemReviews).ready,
    true,
    "review action should unlock only after explicit item decisions"
  );
  const largeFileOnly = new Set(["large-user-files"]);
  assert.strictEqual(
    guard.getExecutionReadiness(largeFileOnly, { groupConfirm: true, reviewed: { "large-user-files": true }, reviewItems: {}, typed: {} }).ready,
    false,
    "large personal files must not unlock from broad review approval"
  );
  const largeFileReview = guard.buildItemReview("large-user-files", guard.actions, null, []);
  assert.strictEqual(largeFileReview.source, "demo-review", "large file review should expose demo discovery candidates");
  assert(largeFileReview.items.some((item) => item.recommendation === "keep"), "large file review should preserve keep recommendations");
  assert(largeFileReview.items.some((item) => item.recommendation === "review"), "large file review should preserve review recommendations");
  assert.strictEqual(largeFileReview.undecidedCount, largeFileReview.items.length, "large files should start undecided");
  const largeFileArchiveApprovals = {
    groupConfirm: true,
    reviewed: {},
    reviewItems: {
      "large-user-files": Object.fromEntries(
        largeFileReview.items
          .filter((item) => !item.protected)
          .map((item) => [item.id, item.recommendation === "review" ? "archive" : "keep"])
      )
    },
    typed: {}
  };
  const largeFileArchiveReviews = guard.buildReviewItemsByAction(guard.actions, null, [], largeFileArchiveApprovals);
  assert.strictEqual(largeFileArchiveReviews["large-user-files"].removeBytes, 0, "archive decisions must not count as executor removal bytes");
  assert(largeFileArchiveReviews["large-user-files"].manualDispositionBytes > 0, "archive decisions should be tracked as manual recovery bytes");
  assert.strictEqual(
    guard.getExecutionReadinessForActions(largeFileOnly, largeFileArchiveApprovals, guard.actions, [], largeFileArchiveReviews).ready,
    true,
    "move/archive/keep decisions should resolve item review without requiring deletion"
  );
  const largeFileArchiveExecutorPlan = guard.buildExecutorPlan({
    selectedIds: largeFileOnly,
    actionList: guard.actions,
    approvals: largeFileArchiveApprovals,
    protectedPaths: [],
    scanMode: "demo",
    itemReviewsByAction: largeFileArchiveReviews
  });
  const largeFileArchiveRow = largeFileArchiveExecutorPlan.rows.find((row) => row.id === "large-user-files");
  assert.strictEqual(
    largeFileArchiveExecutorPlan.dryRunBytes,
    largeFileArchiveReviews["large-user-files"].manualDispositionBytes,
    "reviewed large-file archive bytes should become scoped executor bytes"
  );
  assert.strictEqual(largeFileArchiveExecutorPlan.dryRunCount, 1, "reviewed large-file archive should create one scoped executor route");
  assert.strictEqual(largeFileArchiveRow.route, "item-review-large-files", "large-file archive should stay on the reviewed item route");
  assert.strictEqual(
    largeFileArchiveRow.archiveTargets.length,
    largeFileArchiveReviews["large-user-files"].archiveCount,
    "archive decisions should be carried as exact archive executor targets"
  );
  assert.strictEqual(
    guard.getExecutionReadinessForActions(largeFileOnly, downloadsItemApprovals, guard.actions, [], downloadsItemReviews).ready,
    true,
    "large personal files should unlock only after explicit item decisions"
  );

  const ledger = guard.makeExecutionLedger(new Set(["windows-temp", "browser-identity"]));
  assert.strictEqual(ledger.find((entry) => entry.id === "browser-identity").bytes, 0, "non-executable demo action must reclaim 0 bytes");

  const developerActions = guard.buildScenarioActions("developer");
  const protectedPaths = ["C:\\Users\\demo\\Code"];
  const nodeModules = developerActions.find((action) => action.id === "node-modules-old");
  assert(guard.isActionProtected(nodeModules, protectedPaths), "protected paths should match action paths");
  assert.strictEqual(
    guard.selectableAction(nodeModules, protectedPaths),
    false,
    "protected matching action must not be selectable"
  );
  assert(
    !guard.buildSuggestedPlan(90 * guard.GB, new Set(), developerActions, protectedPaths).has("node-modules-old"),
    "suggested plan must not include user-protected paths"
  );

  const protectedReadiness = guard.getExecutionReadinessForActions(
    new Set(["node-modules-old"]),
    { groupConfirm: true, reviewed: { "node-modules-old": true }, typed: {} },
    developerActions,
    protectedPaths
  );
  assert.strictEqual(protectedReadiness.ready, false, "protected selected action should block readiness");
  assert.strictEqual(protectedReadiness.unresolved[0].gate, "protected", "protected gate should be explicit");
  const intakeBlockedReadiness = guard.getExecutionReadinessForActions(
    new Set(["windows-old"]),
    { groupConfirm: true, reviewed: {}, typed: {} },
    developerActions,
    [],
    null,
    intakeBlockedPolicy
  );
  assert.strictEqual(intakeBlockedReadiness.ready, false, "intake-blocked admin route should block readiness");
  assert.strictEqual(intakeBlockedReadiness.unresolved[0].gate, "intake", "intake gate should be explicit");
  const intakeBlockedExecutor = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-old"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    intakePolicy: intakeBlockedPolicy
  });
  assert.strictEqual(intakeBlockedExecutor.blockedCount, 1, "executor plan should block intake-disallowed admin routes");
  assert(intakeBlockedExecutor.rows[0].blockers.includes("intake admin boundary"), "executor blocker should name the intake admin boundary");

  const report = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: guard.makeExecutionLedgerForActions(new Set(["windows-temp"]), developerActions, protectedPaths),
    protectedPaths,
    goalBytes: 10 * guard.GB,
    intakePolicy: intakeBlockedPolicy
  });
  assert(report.includes("SpaceGuard Dry-Run Report"), "report should have a title");
  assert(report.includes("Protected Paths"), "report should include protected paths");
  assert(report.includes("## Intake Policy"), "report should include intake policy");
  assert(report.includes("Admin/system actions: blocked by intake"), "report should capture admin allowance");

  const demoCoverage = guard.buildScanCoverageSummary({
    actionList: developerActions,
    scanMode: "demo",
    nativeScan: null
  });
  assert.strictEqual(demoCoverage.status, "demo-only", "demo scan coverage should not claim native evidence");
  assert.strictEqual(demoCoverage.confidenceScore, 0, "demo estimates should not count as coverage confidence");
  assert(demoCoverage.steps.some((step) => step.includes("native read-only scan")), "demo coverage should direct user to native scanning");
  const coverageReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: [],
    protectedPaths,
    goalBytes: 10 * guard.GB,
    scanCoverage: demoCoverage,
    scanSettings: {
      includeProjectArtifacts: false,
      maxDepth: 4,
      maxEntriesPerRoot: 5000
    }
  });
  assert(coverageReport.includes("## Scan Coverage"), "report should include scan coverage");
  assert(coverageReport.includes("Confidence: 0%"), "report should include scan confidence");
  assert(coverageReport.includes("## Scan Settings"), "report should include scan settings");
  assert(coverageReport.includes("Project artifacts: excluded"), "report should preserve project artifact scan setting");
  const nativeMeasuredActions = developerActions.map((action) =>
    action.id === "windows-temp"
      ? { ...action, scanSource: "native", scanStatus: "measured" }
      : action
  );
  const nativePartialCoverage = guard.buildScanCoverageSummary({
    actionList: nativeMeasuredActions,
    scanMode: "native-readonly",
    nativeScan: { available: true }
  });
  const diagnosisInventory = guard.buildDriveInventorySummary({
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      driveInventory: [
        {
          id: "drive-users",
          name: "Users",
          path: "C:\\Users",
          bytes: 260 * guard.GB,
          status: "limited",
          files: 12000,
          dirs: 900,
          classification: "user-data-review"
        },
        {
          id: "drive-windows",
          name: "Windows",
          path: "C:\\Windows",
          bytes: 80 * guard.GB,
          status: "limited",
          files: 8000,
          dirs: 600,
          classification: "system-or-protected"
        }
      ]
    }
  });
  const storagePressureDiagnosis = guard.buildStoragePressureDiagnosis({
    scanned: true,
    scanMode: "native-readonly",
    profile: {
      drive: "C:",
      totalBytes: 512 * guard.GB,
      usedBytes: 470 * guard.GB,
      freeBytes: 42 * guard.GB
    },
    goalBytes: 40 * guard.GB,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths,
    scanCoverage: nativePartialCoverage,
    driveInventorySummary: diagnosisInventory,
    recoveryAdvisor: { primary: "Add safe findings first.", steps: ["Add temp cleanup.", "Review rebuildable caches."] }
  });
  assert.strictEqual(storagePressureDiagnosis.schemaVersion, "spaceguard-storage-pressure-diagnosis/v1", "storage pressure diagnosis should expose a schema version");
  assert.strictEqual(storagePressureDiagnosis.status, "native-diagnosis-ready", "native inventory should make diagnosis ready");
  assert.strictEqual(storagePressureDiagnosis.manualOnly, true, "diagnosis should be advice only");
  assert.strictEqual(storagePressureDiagnosis.counts.executorRoutes, 0, "diagnosis must not create executor routes");
  assert.strictEqual(storagePressureDiagnosis.counts.realRun, 0, "diagnosis must not create real-run rows");
  assert(storagePressureDiagnosis.rows.some((row) => row.id === "execution-boundary" && row.status === "real-cleanup-locked"), "diagnosis should keep a visible execution boundary");
  assert(storagePressureDiagnosis.topCauses.some((row) => row.label === "Drive pressure"), "diagnosis should rank drive pressure as a cause");
  const nativeEvidenceQuality = guard.buildNativeEvidenceQualityGate({
    scanned: true,
    scanMode: "native-readonly",
    scanSession: { readyForPlanning: true, nativeEvidence: true, status: "native-current", primary: "Native scan is current." },
    scanCoverage: nativePartialCoverage,
    driveInventorySummary: diagnosisInventory,
    storagePressureDiagnosis,
    nativeCapability: { available: true },
    runtimeCapabilities: { available: true, scanKnownRoots: true, realRunEnabled: false, destructiveCommands: false },
    privacyBoundary: {
      status: "native-local-only",
      destructiveDisabled: true
    }
  });
  assert.strictEqual(nativeEvidenceQuality.schemaVersion, "spaceguard-native-evidence-quality/v1", "native evidence quality should expose a schema version");
  assert.strictEqual(nativeEvidenceQuality.status, "planning-grade-partial", "partial native coverage should still be planning-grade when required evidence is present");
  assert.strictEqual(nativeEvidenceQuality.planningReady, true, "native evidence quality should be ready for planning");
  assert.strictEqual(nativeEvidenceQuality.counts.executorRoutes, 0, "native evidence quality must not create executor routes");
  assert.strictEqual(nativeEvidenceQuality.counts.realRun, 0, "native evidence quality must not create real-run rows");
  assert(nativeEvidenceQuality.rows.some((row) => row.id === "mutation-lock" && row.status === "locked"), "native evidence quality should keep mutation locked");
  const diagnosisReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: nativeMeasuredActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: [],
    protectedPaths,
    goalBytes: 40 * guard.GB,
    scanCoverage: nativePartialCoverage,
    driveInventorySummary: diagnosisInventory,
    storagePressureDiagnosis,
    nativeEvidenceQuality
  });
  assert(diagnosisReport.includes("## Storage Pressure Diagnosis"), "report should include storage pressure diagnosis");
  assert(diagnosisReport.includes("## Native Evidence Quality"), "report should include native evidence quality");
  assert(diagnosisReport.includes("Executor routes: 0"), "diagnosis report should preserve zero executor routes");
  const diagnosisAudit = guard.buildProductCompletionAudit({
    scanned: true,
    scanMode: "native-readonly",
    scanSession: { readyForPlanning: true, nativeEvidence: true, status: "native-current" },
    scanCoverage: nativePartialCoverage,
    driveInventorySummary: diagnosisInventory,
    storagePressureDiagnosis,
    nativeEvidenceQuality
  });
  assert.strictEqual(
    diagnosisAudit.rows.find((row) => row.id === "diagnose-storage-pressure").status,
    "native-proven",
    "product audit should track storage pressure diagnosis"
  );
  assert.strictEqual(
    diagnosisAudit.rows.find((row) => row.id === "grade-native-evidence").status,
    "native-proven",
    "product audit should track native evidence quality"
  );

  const demoPrivacyBoundary = guard.buildPrivacyBoundary({
    scanMode: "demo",
    nativeScan: null,
    runHistory: [],
    validationEvidence: {},
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(demoPrivacyBoundary.schemaVersion, "spaceguard-privacy-boundary/v1", "privacy boundary should expose a schema version");
  assert.strictEqual(demoPrivacyBoundary.status, "demo-local-only", "demo privacy boundary should be local-only");
  assert.strictEqual(demoPrivacyBoundary.cloudDisabled, true, "privacy boundary should keep cloud upload disabled");
  assert.strictEqual(demoPrivacyBoundary.telemetryDisabled, true, "privacy boundary should keep telemetry disabled");
  assert(demoPrivacyBoundary.blockedCollections.includes("Saved logins"), "privacy boundary should list blocked sensitive data classes");
  const nativePrivacyBoundary = guard.buildPrivacyBoundary({
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      destructiveCommands: false,
      findings: [
        {
          recipeId: "downloads-installers",
          title: "Downloads",
          path: "C:\\Users\\demo\\Downloads",
          status: "measured",
          items: [{ id: "installer", path: "C:\\Users\\demo\\Downloads\\tool.exe" }]
        }
      ],
      warnings: []
    },
    runHistory: [{ id: "run-one" }],
    validationEvidence: { "windows-native-build": "passed" },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(nativePrivacyBoundary.status, "native-local-only", "native privacy boundary should remain local-only");
  assert.strictEqual(nativePrivacyBoundary.pathEvidencePresent, true, "native privacy boundary should flag local path evidence");
  assert(nativePrivacyBoundary.warnings.some((warning) => warning.includes("local paths")), "native privacy boundary should warn before sharing path-containing exports");
  const privacyReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: [],
    protectedPaths,
    goalBytes: 10 * guard.GB,
    privacyBoundary: nativePrivacyBoundary
  });
  assert(privacyReport.includes("## Privacy Boundary"), "report should include privacy boundary");
  assert(privacyReport.includes("Cloud disabled: yes"), "report should include cloud boundary");
  const demoPublicReadiness = guard.buildPublicBetaReadiness({
    scanMode: "demo",
    nativeCapability: { available: false },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false },
    privacyBoundary: demoPrivacyBoundary,
    releaseGate: guard.buildReleaseGate({ scanMode: "demo", nativeCapability: { available: false }, executorPlan: null }),
    documentationEvidence: { publicReleaseResearch: true, windowsRealDataSetup: true }
  });
  assert.strictEqual(demoPublicReadiness.schemaVersion, "spaceguard-public-beta-readiness/v1", "public beta readiness should expose a schema version");
  assert.strictEqual(demoPublicReadiness.readyForWebDemo, true, "demo with locked writes and local privacy should be publishable as web demo");
  assert.strictEqual(demoPublicReadiness.readyForNativeBeta, false, "demo should not claim native beta readiness");
  assert(demoPublicReadiness.waitingRows.some((row) => row.id === "native-readonly-beta"), "native beta should wait on native scan evidence");
  const nativePublicReadiness = guard.buildPublicBetaReadiness({
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    runtimeCapabilities: {
      realRunEnabled: false,
      destructiveCommands: false,
      scanKnownRoots: true
    },
    privacyBoundary: nativePrivacyBoundary,
    releaseGate: guard.buildReleaseGate({
      validationEvidence: makePassedEvidence(["signing-and-smartscreen"]),
      scanMode: "native-readonly",
      nativeCapability: { available: true },
      executorPlan: null
    }),
    validationEvidence: makePassedEvidence(["signing-and-smartscreen"]),
    documentationEvidence: { publicReleaseResearch: true, windowsRealDataSetup: true }
  });
  assert.strictEqual(nativePublicReadiness.readyForNativeBeta, true, "native beta should pass when scan, privacy, docs, and signing/support evidence exist");
  assert.strictEqual(nativePublicReadiness.realRunEnabled, false, "native beta readiness should not imply real cleanup");
  const demoDistributionReadiness = guard.buildNativeBetaDistributionReadiness({
    scanMode: "demo",
    nativeCapability: { available: false },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false },
    privacyBoundary: demoPrivacyBoundary,
    releaseGate: guard.buildReleaseGate({ scanMode: "demo", nativeCapability: { available: false }, executorPlan: null }),
    documentationEvidence: {
      publicReleaseResearch: true,
      windowsRealDataSetup: true,
      installUninstallRunbook: true,
      supportRunbook: true,
      supportBundleExport: true
    }
  });
  assert.strictEqual(demoDistributionReadiness.schemaVersion, "spaceguard-native-beta-distribution/v1", "native beta distribution should expose a schema version");
  assert.strictEqual(demoDistributionReadiness.readyForNativeBeta, false, "distribution readiness must not claim native beta from demo data");
  assert.strictEqual(demoDistributionReadiness.readyForWebDemo, true, "distribution readiness should allow web-demo packaging when claims and privacy are safe");
  assert.strictEqual(demoDistributionReadiness.counts.realRun, 0, "distribution readiness must not expose real-run rows");
  const nativeDistributionReadiness = guard.buildNativeBetaDistributionReadiness({
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false, scanKnownRoots: true },
    scanSession: { status: "native-current", readyForPlanning: true, nativeEvidence: true },
    privacyBoundary: nativePrivacyBoundary,
    releaseGate: guard.buildReleaseGate({
      validationEvidence: makePassedEvidence(["signing-and-smartscreen"]),
      scanMode: "native-readonly",
      nativeCapability: { available: true },
      executorPlan: null
    }),
    validationEvidence: makePassedEvidence(["signing-and-smartscreen"]),
    documentationEvidence: {
      publicReleaseResearch: true,
      windowsRealDataSetup: true,
      installUninstallRunbook: true,
      supportRunbook: true,
      supportBundleExport: true
    }
  });
  assert.strictEqual(nativeDistributionReadiness.readyForNativeBeta, true, "native distribution should pass when scan, privacy, signing, install, uninstall, and support evidence exist");
  assert.strictEqual(nativeDistributionReadiness.realRunEnabled, false, "native distribution readiness should not imply real cleanup");
  const signingOnlyDistributionReadiness = guard.buildNativeBetaDistributionReadiness({
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false, scanKnownRoots: true },
    scanSession: { status: "native-current", readyForPlanning: true, nativeEvidence: true },
    privacyBoundary: nativePrivacyBoundary,
    validationEvidence: makePassedEvidence(["signing-and-smartscreen"]),
    documentationEvidence: {
      publicReleaseResearch: true,
      windowsRealDataSetup: true
    }
  });
  const signingOnlyPublicReadiness = guard.buildPublicBetaReadiness({
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false, scanKnownRoots: true },
    privacyBoundary: nativePrivacyBoundary,
    validationEvidence: makePassedEvidence(["signing-and-smartscreen"]),
    documentationEvidence: {
      publicReleaseResearch: true,
      windowsRealDataSetup: true
    },
    distributionReadiness: signingOnlyDistributionReadiness
  });
  assert.strictEqual(signingOnlyDistributionReadiness.readyForNativeBeta, false, "signing alone should not satisfy native beta distribution");
  assert.strictEqual(signingOnlyPublicReadiness.readyForNativeBeta, false, "public beta should respect missing install/uninstall/support evidence when distribution gate is attached");
  const incompleteNativeBetaLedgerPacket = guard.buildReleaseReviewPacket({
    nativeBetaDistributionReadiness: nativeDistributionReadiness,
    nativeBetaEvidenceLedger: {
      schemaVersion: "spaceguard-native-beta-evidence/v1",
      status: "partial",
      complete: false,
      counts: { total: 5, complete: 4, needsDetail: 1, draft: 0, missing: 0 },
      rows: []
    },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(
    incompleteNativeBetaLedgerPacket.rows.find((row) => row.id === "native-beta-evidence-ledger").status,
    "waiting",
    "release review should wait when native beta evidence ledger needs detail"
  );
  const completeNativeBetaLedgerPacket = guard.buildReleaseReviewPacket({
    nativeBetaDistributionReadiness: nativeDistributionReadiness,
    nativeBetaEvidenceLedger: {
      schemaVersion: "spaceguard-native-beta-evidence/v1",
      status: "complete",
      complete: true,
      counts: { total: 5, complete: 5, needsDetail: 0, draft: 0, missing: 0 },
      rows: []
    },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(
    completeNativeBetaLedgerPacket.rows.find((row) => row.id === "native-beta-evidence-ledger").status,
    "passed",
    "release review should pass native beta ledger row only when distribution and evidence are complete"
  );
  const importedNativeBetaEvidence = guard.buildNativeBetaEvidenceImport({
    evidenceText: [
      "# SpaceGuard Native Beta Evidence Ledger",
      "",
      "```json",
      JSON.stringify({
        schemaVersion: "spaceguard-native-beta-evidence/v1",
        rows: [
          {
            id: "publicReleaseResearch",
            status: "complete",
            passed: true,
            reviewer: "Prakh",
            evidencePath: "evidence/release-notes.md",
            notes: "Release copy avoids real cleanup claims."
          },
          {
            id: "supportRunbook",
            status: "complete",
            passed: true,
            reviewer: "",
            evidencePath: "evidence/support-runbook.md"
          },
          {
            id: "unknownEvidence",
            status: "complete",
            reviewer: "Prakh",
            evidencePath: "evidence/unknown.md"
          }
        ]
      }),
      "```"
    ].join("\n"),
    currentEvidence: {},
    importedAt: "2026-06-05T00:00:00.000Z"
  });
  assert.strictEqual(importedNativeBetaEvidence.schemaVersion, "spaceguard-native-beta-evidence-import/v1", "native beta evidence import should expose a schema version");
  assert.strictEqual(importedNativeBetaEvidence.canApply, true, "native beta evidence import should accept exported markdown JSON");
  assert.strictEqual(importedNativeBetaEvidence.counts.importedRows, 2, "native beta evidence import should map known evidence rows");
  assert.strictEqual(importedNativeBetaEvidence.counts.ignoredRows, 1, "native beta evidence import should ignore unknown rows");
  assert.strictEqual(importedNativeBetaEvidence.counts.complete, 1, "native beta evidence import should count complete rows");
  assert.strictEqual(importedNativeBetaEvidence.counts.needsDetail, 1, "native beta evidence import should keep incomplete rows as needs-detail");
  assert.strictEqual(importedNativeBetaEvidence.nativeBetaEvidence.publicReleaseResearch.status, "passed", "complete imported beta row should pass");
  assert.strictEqual(importedNativeBetaEvidence.nativeBetaEvidence.supportRunbook.status, "draft", "missing reviewer should not pass imported beta row");
  const rejectedNativeBetaEvidence = guard.buildNativeBetaEvidenceImport({
    evidenceText: JSON.stringify({ schemaVersion: "spaceguard-fixture-evidence/v1", rows: [] }),
    currentEvidence: { supportRunbook: { status: "draft" } }
  });
  assert.strictEqual(rejectedNativeBetaEvidence.canApply, false, "native beta evidence import should reject wrong schemas");
  assert.strictEqual(rejectedNativeBetaEvidence.nativeBetaEvidence.supportRunbook.status, "draft", "rejected native beta import should preserve current evidence");
  const nativeBetaEvidenceLedger = {
    schemaVersion: "spaceguard-native-beta-evidence/v1",
    status: "partial",
    counts: { total: 5, complete: 1, needsDetail: 1, draft: 0, missing: 3 },
    rows: [
      {
        id: "supportRunbook",
        label: "Support runbook",
        status: "complete",
        reviewer: "Prakh",
        evidencePath: "evidence/support-runbook.md",
        updatedAt: "2026-06-05T00:00:00.000Z",
        notes: "Redacted support flow reviewed."
      }
    ]
  };
  const publicReadinessReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: [],
    protectedPaths,
    goalBytes: 10 * guard.GB,
    publicBetaReadiness: demoPublicReadiness,
    nativeBetaDistributionReadiness: demoDistributionReadiness,
    nativeBetaEvidenceLedger
  });
  assert(publicReadinessReport.includes("## Public Beta Readiness"), "report should include public beta readiness");
  assert(publicReadinessReport.includes("Web demo ready: yes"), "public beta report should distinguish web demo readiness");
  assert(publicReadinessReport.includes("## Native Beta Distribution Readiness"), "report should include native beta distribution readiness");
  assert(publicReadinessReport.includes("Native beta ready: no"), "distribution report should keep native beta separate from web demo");
  assert(publicReadinessReport.includes("## Native Beta Evidence Ledger"), "report should include native beta evidence ledger");
  assert(publicReadinessReport.includes("Support runbook: complete | reviewer=Prakh | artifact=evidence/support-runbook.md"), "report should preserve native beta artifact evidence");
  const supportBundle = guard.buildSupportBundle({
    profile: guard.getScenario("developer").profile,
    scanMode: "native-readonly",
    scanSettings: { includeProjectArtifacts: true, maxDepth: 8, maxEntriesPerRoot: 25000 },
    nativeScan: {
      available: true,
      platform: "windows",
      windows: true,
      totalBytes: 512 * guard.MB,
      findings: [
        {
          recipeId: "downloads-installers",
          title: "Downloads",
          path: "C:\\Users\\demo\\Downloads",
          bytes: 512 * guard.MB,
          status: "measured",
          files: 1,
          dirs: 0,
          errors: 0,
          items: [{ id: "installer", name: "secret-client-tool.exe", path: "C:\\Users\\demo\\Downloads\\secret-client-tool.exe", bytes: 512 * guard.MB }]
        }
      ],
      warnings: ["sample warning"],
      writeCapability: false,
      destructiveCommands: false
    },
    privacyBoundary: nativePrivacyBoundary,
    publicBetaReadiness: demoPublicReadiness,
    releaseGate: guard.buildReleaseGate({ scanMode: "demo", nativeCapability: { available: false }, executorPlan: null }),
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false, platform: "windows" },
    executorPlan: null,
    rollbackPlan: null
  });
  assert.strictEqual(supportBundle.schemaVersion, "spaceguard-support-bundle/v1", "support bundle should expose a schema version");
  assert.strictEqual(supportBundle.redactedPaths, true, "support bundle should be path-redacted by default");
  const supportJson = JSON.stringify(supportBundle);
  const supportMarkdown = guard.buildSupportBundleMarkdown(supportBundle);
  assert(!supportJson.includes("C:\\Users"), "support bundle JSON should not include local paths");
  assert(!supportJson.includes("secret-client-tool.exe"), "support bundle JSON should not include filenames");
  assert(!supportMarkdown.includes("C:\\Users"), "support bundle markdown should not include local paths");
  assert(supportMarkdown.includes("SpaceGuard Support Bundle"), "support bundle markdown should have a title");
  assert(supportMarkdown.includes("Redacted paths: yes"), "support bundle markdown should disclose redaction");
  const supportHandoffQuestions = guard.buildAgentQuestionQueue({
    scanned: false,
    scanning: false,
    nativeCapability: { available: false },
    actionList: developerActions,
    selectedIds: new Set()
  });
  const supportHandoffAudit = guard.buildProductCompletionAudit({
    scanned: false,
    scanMode: "demo",
    actionList: developerActions,
    selectedIds: new Set(),
    agentQuestionQueue: supportHandoffQuestions,
    supportBundle,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  const workflowHandoff = guard.buildWorkflowHandoffPacket({
    agentQuestionQueue: supportHandoffQuestions,
    productCompletionAudit: supportHandoffAudit,
    nativeBetaEvidenceLedger,
    supportBundle,
    releaseReviewPacket: {
      status: "review-waiting",
      writeSignalVisible: false,
      rows: [
        {
          id: "native-beta-evidence-ledger",
          status: "waiting",
          detail: "1 beta evidence row needs reviewer or artifact detail."
        }
      ]
    },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(workflowHandoff.schemaVersion, "spaceguard-workflow-handoff/v1", "workflow handoff should expose a schema version");
  assert.strictEqual(workflowHandoff.redactedPaths, true, "workflow handoff should be redacted");
  assert.strictEqual(workflowHandoff.realCleanupEnabled, false, "workflow handoff must not enable cleanup");
  assert.strictEqual(workflowHandoff.realCleanupLocked, true, "workflow handoff should preserve cleanup lock");
  assert.strictEqual(workflowHandoff.activeQuestion.id, "run-first-scan", "workflow handoff should preserve the active question");
  assert.strictEqual(workflowHandoff.workflow.nativeBetaEvidenceStatus, "partial", "workflow handoff should carry beta evidence status");
  assert.strictEqual(workflowHandoff.workflow.nativeBetaEvidenceComplete, "1/5", "workflow handoff should carry beta evidence completion counts");
  assert(workflowHandoff.nextActions.some((step) => step.includes("Should I scan before suggesting cleanup?")), "workflow handoff should include active question as first next action");
  assert(workflowHandoff.nextActions.some((step) => step.includes("Complete native beta evidence ledger")), "workflow handoff should include beta evidence as a resume action");
  const workflowHandoffJson = JSON.stringify(workflowHandoff);
  const workflowHandoffMarkdown = guard.buildWorkflowHandoffMarkdown(workflowHandoff);
  assert(!workflowHandoffJson.includes("C:\\Users"), "workflow handoff JSON should not include local paths");
  assert(!workflowHandoffMarkdown.includes("C:\\Users"), "workflow handoff markdown should not include local paths");
  assert(workflowHandoffMarkdown.includes("SpaceGuard Workflow Handoff"), "workflow handoff markdown should have a title");
  assert(workflowHandoffMarkdown.includes("Native beta evidence: partial (1/5)"), "workflow handoff markdown should summarize beta evidence state");
  const handoffReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(),
    readiness: { ready: false, unresolved: [] },
    ledger: [],
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    workflowHandoff
  });
  assert(handoffReport.includes("## Workflow Handoff"), "report should include workflow handoff");
  assert(handoffReport.includes("Real cleanup locked: yes"), "workflow handoff report should keep cleanup lock visible");
  const unsafeHandoff = guard.buildWorkflowHandoffPacket({
    agentQuestionQueue: supportHandoffQuestions,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafeHandoff.status, "unsafe-stop", "workflow handoff should stop on unsafe runtime signals");

  const review = guard.buildPlanReview(
    developerActions,
    new Set(["gradle-cache", "node-modules-old", "wsl-vhdx"]),
    { groupConfirm: false, reviewed: { "node-modules-old": true }, typed: {} },
    protectedPaths
  );
  assert(review.pending.some((row) => row.id === "gradle-cache"), "review queue should show rebuildable cache approval as pending");
  assert(review.pending.some((row) => row.id === "wsl-vhdx"), "review queue should show typed gate as pending");
  assert(review.protected.some((row) => row.id === "node-modules-old"), "review queue should show protected paths separately");
  assert(review.blocked.some((row) => row.id === "docker-volumes"), "review queue should keep policy-blocked actions visible");

  const scanFirstAdvisor = guard.buildRecoveryAdvisor({
    scanned: false,
    goalBytes: 25 * guard.GB,
    actionList: developerActions,
    selectedIds: new Set(),
    protectedPaths: []
  });
  assert.strictEqual(scanFirstAdvisor.status, "scan-first", "advisor should require scan before planning");
  const scanFirstQuestions = guard.buildAgentQuestionQueue({
    scanned: false,
    scanning: false,
    nativeCapability: { available: false },
    actionList: developerActions,
    selectedIds: new Set()
  });
  assert.strictEqual(scanFirstQuestions.schemaVersion, "spaceguard-question-queue/v1", "question queue should expose a schema version");
  assert.strictEqual(scanFirstQuestions.activeQuestion.id, "run-first-scan", "question queue should ask for scan first");
  assert.strictEqual(scanFirstQuestions.activeQuestion.action, "run-scan", "scan-first question should be actionable");

  const gatedAdvisor = guard.buildRecoveryAdvisor({
    scanned: true,
    goalBytes: 20 * guard.GB,
    actionList: developerActions,
    selectedIds: new Set(["gradle-cache"]),
    approvals: { groupConfirm: false, reviewed: {}, typed: {} },
    protectedPaths: []
  });
  assert.strictEqual(gatedAdvisor.status, "needs-approval", "advisor should surface unresolved gates before expansion");
  assert(gatedAdvisor.steps[0].includes("Approve"), "advisor should provide gate-specific next step");
  const gatedQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["gradle-cache"]),
    approvals: { groupConfirm: false, reviewed: {}, typed: {} },
    readiness: guard.getExecutionReadinessForActions(new Set(["gradle-cache"]), { groupConfirm: false, reviewed: {}, typed: {} }, developerActions, [])
  });
  assert(gatedQuestions.questions.some((question) => question.id === "approve-rebuildable-caches"), "question queue should ask for rebuildable-cache approval");
  const permanentQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["recycle-bin"]),
    approvals: { groupConfirm: true, permanentConfirm: false, reviewed: {}, typed: {} },
    readiness: guard.getExecutionReadinessForActions(new Set(["recycle-bin"]), { groupConfirm: true, permanentConfirm: false, reviewed: {}, typed: {} }, developerActions, [])
  });
  assert(permanentQuestions.questions.some((question) => question.id === "confirm-permanent-removal"), "question queue should ask for permanent-removal confirmation");
  const typedQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["wsl-vhdx"]),
    approvals: { groupConfirm: true, permanentConfirm: true, reviewed: {}, typed: {} },
    readiness: guard.getExecutionReadinessForActions(new Set(["wsl-vhdx"]), { groupConfirm: true, permanentConfirm: true, reviewed: {}, typed: {} }, developerActions, [])
  });
  assert(typedQuestions.questions.some((question) => question.id === "typed-wsl-vhdx" && question.action === "focus-panel" && question.targetPanel === "gate-panel"), "typed acknowledgement question should focus approval gates");
  const wslWorkOrder = guard.buildWslCompactionWorkOrder({
    nativeScan: {
      findings: [
        {
          recipeId: "wsl-vhdx",
          title: "WSL virtual disk compaction",
          path: "C:\\Users\\demo\\AppData\\Local\\Packages\\Ubuntu\\LocalState\\ext4.vhdx",
          bytes: 24 * guard.GB,
          status: "measured",
          files: 1,
          dirs: 0,
          errors: 0,
          note: "Read-only WSL VHDX measurement."
        }
      ]
    },
    actionList: developerActions,
    selectedIds: new Set(["wsl-vhdx"]),
    approvals: { groupConfirm: true, permanentConfirm: true, reviewed: {}, typed: { "wsl-vhdx": "COMPACT WSL" } },
    planSnapshot: { id: "plan-wsl" },
    scanSession: { currentFingerprint: "scan-wsl-before" },
    rescanComparison: { status: "not-run" }
  });
  assert.strictEqual(wslWorkOrder.schemaVersion, "spaceguard-wsl-compaction-work-order/v1", "WSL compaction work order should expose a stable schema");
  assert.strictEqual(wslWorkOrder.status, "ready-for-manual-compaction", "typed WSL selection with native evidence should create a manual work order");
  assert.strictEqual(wslWorkOrder.manualOnly, true, "WSL compaction work order should stay manual-only");
  assert.strictEqual(wslWorkOrder.canRunShell, false, "WSL compaction work order must not run shell commands");
  assert.strictEqual(wslWorkOrder.canCompactVhdx, false, "WSL compaction work order must not compact VHDX from the app");
  assert(wslWorkOrder.guardrails.includes("No Optimize-VHD execution."), "WSL compaction work order should forbid Optimize-VHD execution");
  assert(wslWorkOrder.steps.some((step) => step.id === "backup-export" && step.status === "ready"), "WSL compaction work order should require backup/export before compaction");
  const wslMarkdown = guard.buildWslCompactionWorkOrderMarkdown(wslWorkOrder);
  assert(wslMarkdown.includes("SpaceGuard WSL Compaction Work Order"), "WSL compaction work order should export markdown");
  assert(wslMarkdown.includes("No shell command execution."), "WSL compaction work order export should preserve shell-execution guardrail");

  const normalSelection = new Set(
    developerActions
      .filter((action) => guard.selectableAction(action) && action.gate !== "typed")
      .map((action) => action.id)
  );
  const normalApprovals = makeReviewApprovals(developerActions);
  const normalReviewItems = guard.buildReviewItemsByAction(developerActions, null, [], normalApprovals);
  const normalBytes = guard.computeTotals(normalSelection, developerActions, {
    approvals: normalApprovals,
    itemReviewsByAction: normalReviewItems
  }).selectedBytes;
  const advancedAdvisor = guard.buildRecoveryAdvisor({
    scanned: true,
    goalBytes: normalBytes + guard.GB,
    actionList: developerActions,
    selectedIds: normalSelection,
    approvals: normalApprovals,
    protectedPaths: [],
    itemReviewsByAction: normalReviewItems
  });
  assert.strictEqual(advancedAdvisor.status, "advanced-options", "advisor should separate typed system options from normal expansion");
  const intakeLimitedSelection = new Set(
    developerActions
      .filter((action) => guard.selectableAction(action, [], intakeBlockedPolicy))
      .map((action) => action.id)
  );
  const intakeLimitedApprovals = makeReviewApprovals(developerActions);
  const intakeLimitedReviews = guard.buildReviewItemsByAction(developerActions, null, [], intakeLimitedApprovals);
  const intakeLimitedAdvisor = guard.buildRecoveryAdvisor({
    scanned: true,
    goalBytes: 500 * guard.GB,
    actionList: developerActions,
    selectedIds: intakeLimitedSelection,
    approvals: intakeLimitedApprovals,
    protectedPaths: [],
    itemReviewsByAction: intakeLimitedReviews,
    intakePolicy: intakeBlockedPolicy
  });
  assert.strictEqual(intakeLimitedAdvisor.status, "strategy-needed", "intake-blocked admin routes should keep exhausted normal cleanup in strategy-needed state");
  const intakeLimitedQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: intakeLimitedSelection,
    approvals: intakeLimitedApprovals,
    readiness: guard.getExecutionReadinessForActions(intakeLimitedSelection, intakeLimitedApprovals, developerActions, [], intakeLimitedReviews, intakeBlockedPolicy),
    recoveryAdvisor: intakeLimitedAdvisor,
    intakePolicy: intakeBlockedPolicy
  });
  assert(intakeLimitedQuestions.questions.some((question) => question.id === "allow-admin-system-routes"), "question queue should ask to allow admin/system routes when normal cleanup is exhausted");
  assert.strictEqual(intakeLimitedQuestions.counts.intake, 1, "question queue should count intake questions");
  const adminAllowedQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: intakeLimitedSelection,
    approvals: intakeLimitedApprovals,
    readiness: guard.getExecutionReadinessForActions(intakeLimitedSelection, intakeLimitedApprovals, developerActions, [], intakeLimitedReviews, intakeAllowedPolicy),
    recoveryAdvisor: intakeLimitedAdvisor,
    intakePolicy: intakeAllowedPolicy
  });
  assert(!adminAllowedQuestions.questions.some((question) => question.id === "allow-admin-system-routes"), "question queue should not ask admin allowance after it is enabled");

  const strategyApprovals = {
    ...makeReviewApprovals(developerActions),
    typed: { "wsl-vhdx": "COMPACT WSL", hibernation: "DISABLE HIBERNATION" }
  };
  const strategyReviewItems = guard.buildReviewItemsByAction(developerActions, null, [], strategyApprovals);
  const strategySelection = guard.buildSuggestedPlan(500 * guard.GB, new Set(), developerActions, []);
  const strategyAdvisor = guard.buildRecoveryAdvisor({
    scanned: true,
    goalBytes: 500 * guard.GB,
    actionList: developerActions,
    selectedIds: strategySelection,
    approvals: strategyApprovals,
    protectedPaths: [],
    itemReviewsByAction: strategyReviewItems
  });
  assert.strictEqual(strategyAdvisor.status, "strategy-needed", "advisor should move to strategy when cleanup cannot meet target");
  const storageStrategy = guard.buildStorageStrategyPlan({
    scanned: true,
    profile: guard.getScenario("developer").profile,
    advisor: strategyAdvisor,
    actionList: developerActions,
    selectedIds: strategySelection,
    approvals: strategyApprovals,
    itemReviewsByAction: strategyReviewItems,
    scanCoverage: {
      customRootBytes: 64 * guard.GB,
      customRootRows: [
        {
          id: "custom-root-1",
          title: "Custom folder: Archives",
          bytes: 64 * guard.GB,
          evidence: "measured",
          verified: true
        }
      ]
    },
    goalBytes: 500 * guard.GB
  });
  assert.strictEqual(storageStrategy.status, "manual-strategy", "storage strategy should activate when cleanup cannot hit the target");
  assert.strictEqual(storageStrategy.manualOnly, true, "storage strategies must be manual-only");
  assert(storageStrategy.options.some((option) => option.id === "uninstall-apps-manually"), "storage strategy should include manual installed-app review");
  assert(storageStrategy.options.some((option) => option.id === "review-custom-roots"), "storage strategy should include custom root manual review");
  assert.strictEqual(storageStrategy.options.find((option) => option.id === "review-custom-roots").impact, 64 * guard.GB, "custom root strategy should carry advisory impact bytes");
  assert(storageStrategy.options.some((option) => option.id === "partition-or-drive-plan"), "storage strategy should include backup-first partition guidance");
  assert(storageStrategy.options.every((option) => option.automation === "manual"), "storage strategy options must not create automation routes");
  const customRootTriage = guard.buildCustomRootTriage({
    scanCoverage: storageStrategy.scanCoverage || {
      customRootBytes: 64 * guard.GB,
      customRootRows: [
        {
          id: "custom-root-1",
          title: "Custom folder: Archives",
          path: "C:\\Users\\demo\\Archives",
          bytes: 64 * guard.GB,
          evidence: "measured",
          verified: true
        }
      ]
    }
  });
  assert.strictEqual(customRootTriage.schemaVersion, "spaceguard-custom-root-triage/v1", "custom root triage should expose a schema version");
  assert.strictEqual(customRootTriage.status, "triage-open", "custom root triage should start open until dispositions are chosen");
  assert.strictEqual(customRootTriage.manualOnly, true, "custom root triage should be manual-only");
  assert.strictEqual(customRootTriage.counts.executorRoutes, 0, "custom root triage must not create executor routes");
  assert.strictEqual(customRootTriage.rows[0].canCreateExecutor, false, "custom root rows must not become executor candidates");
  const documentedCustomRootTriage = guard.buildCustomRootTriage({
    scanCoverage: {
      customRootBytes: 64 * guard.GB,
      customRootRows: [
        {
          id: "custom-root-1",
          title: "Custom folder: Archives",
          path: "C:\\Users\\demo\\Archives",
          bytes: 64 * guard.GB,
          evidence: "measured",
          verified: true
        }
      ]
    },
    evidence: {
      "custom-root-1": {
        disposition: "archive",
        owner: "old backups",
        notes: "external drive candidate",
        updatedAt: "2026-06-04T10:00:00.000Z"
      }
    }
  });
  assert.strictEqual(documentedCustomRootTriage.status, "triage-documented", "custom root triage should complete after every row has a disposition");
  assert.strictEqual(documentedCustomRootTriage.manualDispositionBytes, 64 * guard.GB, "archive disposition should count advisory manual bytes");
  assert.strictEqual(documentedCustomRootTriage.rows[0].noExecutorRoute, true, "documented custom roots should still have no executor route");
  assert.strictEqual(guard.normalizeCustomRootTriageRecord("move").disposition, "move", "custom root triage should migrate string evidence records");
  const customRootQuestionQueue = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: strategySelection,
    approvals: strategyApprovals,
    customRootTriage
  });
  assert(customRootQuestionQueue.questions.some((question) => question.id === "custom-root-triage" && question.targetPanel === "custom-root-triage-panel"), "question queue should ask for custom root triage");
  const manualChecklist = guard.buildManualStrategyChecklist({ storageStrategy });
  assert.strictEqual(manualChecklist.schemaVersion, "spaceguard-manual-strategy-checklist/v1", "manual strategy checklist should have a schema version");
  assert.strictEqual(manualChecklist.manualOnly, true, "manual strategy checklist must remain manual-only");
  assert.strictEqual(manualChecklist.status, "manual-work-open", "manual strategy should start with waiting evidence");
  assert(manualChecklist.checks.some((check) => check.id === "partition-or-drive-plan:full-backup"), "partition strategy should require full backup evidence");
  assert(manualChecklist.checks.some((check) => check.id === "review-custom-roots:no-executor-route"), "custom root strategy should require no-executor-route acknowledgement");
  assert(manualChecklist.checks.some((check) => check.id === "uninstall-apps-manually:no-automated-uninstall"), "installed app strategy should block automated uninstall");
  const manualStrategyQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: strategySelection,
    approvals: strategyApprovals,
    manualStrategyChecklist: manualChecklist
  });
  assert(manualStrategyQuestions.questions.some((question) => question.id === "manual-strategy-evidence" && question.action === "focus-panel" && question.targetPanel === "manual-strategy-checklist-panel"), "manual strategy question should focus manual checklist");
  const completedManualEvidence = Object.fromEntries(manualChecklist.checks.filter((check) => check.required).map((check) => [check.id, "done"]));
  const completedManualChecklist = guard.buildManualStrategyChecklist({ storageStrategy, evidence: completedManualEvidence });
  assert.strictEqual(completedManualChecklist.status, "manual-plan-documented", "manual checklist should complete only when required evidence is marked");
  const strategyReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: strategySelection,
    approvals: strategyApprovals,
    readiness: guard.getExecutionReadinessForActions(strategySelection, strategyApprovals, developerActions, [], strategyReviewItems),
    ledger: [],
    protectedPaths: [],
    goalBytes: 500 * guard.GB,
    advisor: strategyAdvisor,
    storageStrategy,
    manualStrategyChecklist: manualChecklist,
    customRootTriage,
    itemReviewsByAction: strategyReviewItems
  });
  assert(strategyReport.includes("## Storage Strategy"), "dry-run report should include storage strategy");
  assert(strategyReport.includes("No automated partition writes"), "storage strategy report should include partition guardrails");
  assert(strategyReport.includes("## Manual Strategy Checklist"), "dry-run report should include manual strategy checklist");
  assert(strategyReport.includes("Manual only: yes"), "manual strategy report should keep manual boundary visible");
  assert(strategyReport.includes("## Custom Root Triage"), "dry-run report should include custom root triage");
  assert(strategyReport.includes("Executor routes: 0"), "custom root triage report should keep executor routes at zero");

  const decisionLog = guard.buildDecisionLog({
    scanned: true,
    scanMode: "native-readonly",
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    goalBytes: 10 * guard.GB,
    protectedPaths
  });
  assert(decisionLog.some((entry) => entry.id === "source" && entry.status === "real-readonly"), "decision log should record native read-only data source");

  const workbench = guard.buildReviewWorkbench(
    developerActions,
    new Set(["gradle-cache", "node-modules-old"]),
    { groupConfirm: false, reviewed: {}, typed: {} },
    protectedPaths
  );
  assert(workbench.needsDecision.some((row) => row.id === "gradle-cache"), "workbench should show unresolved selected gates");
  assert(workbench.protected.some((row) => row.id === "node-modules-old"), "workbench should separate protected paths");

  const demoItemReview = guard.buildItemReview("node-modules-old", developerActions, null, protectedPaths);
  assert.strictEqual(demoItemReview.source, "demo-review", "item review should fall back to demo candidates");
  assert(demoItemReview.items.some((item) => item.protected), "item review should mark protected child paths");
  assert(demoItemReview.protectedBytes > 0, "item review should total protected bytes");
  assert.strictEqual(demoItemReview.removeBytes, 0, "item review should not select removal bytes without explicit decisions");
  const undecidedDownloadsReview = guard.buildItemReview("downloads-installers", developerActions, null, []);
  assert(undecidedDownloadsReview.undecidedCount > 0, "item review should keep undecided candidates gated");
  const receiptSelection = new Set(["gradle-cache", "downloads-installers"]);
  const receiptApprovals = {
    groupConfirm: true,
    permanentConfirm: false,
    reviewed: {},
    reviewItems: {
      "downloads-installers": Object.fromEntries(
        undecidedDownloadsReview.items.map((item, index) => [item.id, index === 0 ? "remove" : "keep"])
      )
    },
    typed: {}
  };
  const receiptReviewsByAction = guard.buildReviewItemsByAction(developerActions, null, [], receiptApprovals);
  const receiptPlan = guard.buildPlanSnapshot({
    selectedIds: receiptSelection,
    actionList: developerActions,
    approvals: receiptApprovals,
    protectedPaths,
    scanMode: "demo"
  });
  const userDecisionReceipt = guard.buildUserDecisionReceipt({
    actionList: developerActions,
    selectedIds: receiptSelection,
    approvals: receiptApprovals,
    itemReviewsByAction: receiptReviewsByAction,
    protectedPaths,
    intakePolicy: { adminAllowed: true, adminSensitiveBlocked: false, status: "admin-dry-run-allowed" },
    consentReceipt: { ready: true, planId: receiptPlan.id, acceptedAt: "2026-06-04T12:00:00.000Z" },
    planSnapshot: receiptPlan,
    agentQuestionQueue: { activeQuestion: { id: "simulate-current-plan", prompt: "Should I simulate the current plan?", action: "simulate" } },
    operatingChecklist: { status: "dry-run-ready", safeActionNow: { label: "Dry-run launch guard", action: "simulate" } },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(userDecisionReceipt.schemaVersion, "spaceguard-user-decision-receipt/v1", "user decision receipt should expose a schema version");
  assert.strictEqual(userDecisionReceipt.status, "decisions-current", "user decision receipt should recognize current decisions");
  assert.strictEqual(userDecisionReceipt.realRunAllowed, false, "decision receipts must not grant real execution");
  assert.strictEqual(userDecisionReceipt.counts.realRun, 0, "decision receipts should keep real-run rows at zero");
  assert(userDecisionReceipt.rows.some((row) => row.id === "group-confirm" && row.status === "accepted"), "receipt should capture rebuildable-cache approval");
  assert(userDecisionReceipt.rows.some((row) => row.id === "item-review:downloads-installers" && row.removeCount === 1), "receipt should capture per-item remove decisions");
  assert(userDecisionReceipt.rows.some((row) => row.id === "protected-paths" && row.count === protectedPaths.length), "receipt should capture protected path count");
  const decisionReceiptReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: receiptSelection,
    readiness: guard.getExecutionReadinessForActions(receiptSelection, receiptApprovals, developerActions, protectedPaths, receiptReviewsByAction),
    ledger: [],
    protectedPaths,
    goalBytes: 10 * guard.GB,
    userDecisionReceipt
  });
  assert(decisionReceiptReport.includes("## User Decision Receipt"), "report should include user decision receipt");
  assert(decisionReceiptReport.includes("Real-run rows: 0"), "receipt report should keep real-run rows at zero");
  const unsafeDecisionReceipt = guard.buildUserDecisionReceipt({
    actionList: developerActions,
    selectedIds: receiptSelection,
    approvals: receiptApprovals,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafeDecisionReceipt.status, "unsafe-stop", "receipt should stop on runtime write signals");

  const nativeItemReview = guard.buildItemReview(
    "downloads-installers",
    developerActions,
    {
      findings: [
        {
          recipeId: "downloads-installers",
          title: "Old installers and archives in Downloads",
          path: "C:\\Users\\demo\\Downloads",
          items: [
            {
              id: "native-installer",
              name: "tool.msi",
              path: "C:\\Users\\demo\\Downloads\\tool.msi",
              bytes: 512 * guard.MB,
              ageDays: 90,
              kind: "installer",
              recommendation: "review",
              reason: "Native item"
            }
          ]
        }
      ]
    },
    []
  );
  assert.strictEqual(nativeItemReview.source, "native-readonly", "native item candidates should override demo items");
  assert.strictEqual(nativeItemReview.items[0].name, "tool.msi", "native item candidate should be preserved");
  assert.strictEqual(nativeItemReview.items[0].decision, "undecided", "native item candidate should start undecided");

  const nativeItemApprovals = {
    groupConfirm: true,
    reviewed: {},
    reviewItems: { "downloads-installers": { "native-installer": "remove" } },
    typed: {}
  };
  const decidedNativeItemReview = guard.buildItemReview(
    "downloads-installers",
    developerActions,
    {
      findings: [
        {
          recipeId: "downloads-installers",
          title: "Old installers and archives in Downloads",
          path: "C:\\Users\\demo\\Downloads",
          items: [
            {
              id: "native-installer",
              name: "tool.msi",
              path: "C:\\Users\\demo\\Downloads\\tool.msi",
              bytes: 512 * guard.MB,
              ageDays: 90,
              kind: "installer",
              recommendation: "review",
              reason: "Native item"
            }
          ]
        }
      ]
    },
    [],
    nativeItemApprovals
  );
  assert.strictEqual(decidedNativeItemReview.removeBytes, 512 * guard.MB, "explicit item decision should count selected removal bytes");
  assert.strictEqual(decidedNativeItemReview.undecidedCount, 0, "explicit item decision should clear the review gate");

  const executorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-temp", "docker-volumes", "gradle-cache"]),
    actionList: developerActions,
    approvals: { groupConfirm: false, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo"
  });
  assert.strictEqual(executorPlan.realRunEnabled, false, "real execution must remain globally disabled");
  assert(executorPlan.rows.find((row) => row.id === "windows-temp").canSimulate, "safe temp cleanup should be simulatable");
  assert.strictEqual(executorPlan.rows.find((row) => row.id === "docker-volumes").status, "blocked", "Docker volumes must remain executor-blocked");
  assert.strictEqual(executorPlan.rows.find((row) => row.id === "gradle-cache").status, "blocked", "unapproved rebuildable cache should be blocked by gate");
  assert(executorPlan.rows.every((row) => row.canRealRun === false), "no executor row should allow real run");
  const toolCommandExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["npm-cache", "pnpm-store", "docker-build-cache"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo"
  });
  const toolCommandInventory = guard.buildToolCommandInventory({
    actionList: developerActions,
    executorPlan: toolCommandExecutorPlan,
    releaseGate: guard.buildReleaseGate({ scanMode: "demo", nativeCapability: { available: false }, executorPlan: toolCommandExecutorPlan })
  });
  assert.strictEqual(toolCommandInventory.schemaVersion, "spaceguard-tool-command-inventory/v1", "tool command inventory should have a schema version");
  assert.strictEqual(toolCommandInventory.commandExecutionEnabled, false, "tool command inventory must not enable shell execution");
  assert.strictEqual(toolCommandInventory.realRunEnabled, false, "tool command inventory must not imply real execution");
  assert(toolCommandInventory.selectedRows.some((row) => row.id === "npm-cache" && row.inspectCommand === "npm cache verify"), "npm inventory should prefer npm cache verify");
  assert(toolCommandInventory.selectedRows.some((row) => row.id === "docker-build-cache" && row.guardrails.some((guardrail) => guardrail.includes("No Docker volumes"))), "Docker command inventory should block volumes");
  const commandInventoryReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["npm-cache"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["npm-cache"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, []),
    ledger: [],
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    executorPlan: toolCommandExecutorPlan,
    toolCommandInventory
  });
  assert(commandInventoryReport.includes("## Tool Command Inventory"), "dry-run report should include command inventory");
  assert(commandInventoryReport.includes("Command execution enabled: no"), "command inventory report should keep shell execution disabled");

  const itemExecutorApprovals = makeReviewApprovals(developerActions);
  const itemExecutorReviews = guard.buildReviewItemsByAction(developerActions, null, [], itemExecutorApprovals);
  const downloadsSelectedBytes = itemExecutorReviews["downloads-installers"].selectedBytes;
  const itemExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["downloads-installers"]),
    actionList: developerActions,
    approvals: itemExecutorApprovals,
    protectedPaths: [],
    scanMode: "demo",
    itemReviewsByAction: itemExecutorReviews
  });
  assert(downloadsSelectedBytes > 0, "review item approvals should select some Downloads bytes");
  assert.strictEqual(
    itemExecutorPlan.rows.find((row) => row.id === "downloads-installers").bytes,
    downloadsSelectedBytes,
    "executor plan should use selected item bytes, not broad category bytes"
  );
  assert(itemExecutorPlan.rows.find((row) => row.id === "downloads-installers").canSimulate, "reviewed item route should simulate after item decisions");
  const itemLedger = guard.makeExecutionLedgerForActions(new Set(["downloads-installers"]), developerActions, [], {
    approvals: itemExecutorApprovals,
    itemReviewsByAction: itemExecutorReviews
  });
  assert.strictEqual(itemLedger[0].bytes, downloadsSelectedBytes, "ledger should only reclaim selected reviewed item bytes");

  const itemPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["downloads-installers"]),
    actionList: developerActions,
    approvals: itemExecutorApprovals,
    protectedPaths: [],
    itemReviewsByAction: itemExecutorReviews,
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  const sameItemPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["downloads-installers"]),
    actionList: developerActions,
    approvals: itemExecutorApprovals,
    protectedPaths: [],
    itemReviewsByAction: itemExecutorReviews,
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  assert.strictEqual(itemPlanSnapshot.id, sameItemPlanSnapshot.id, "same plan inputs should produce the same plan id");
  const changedItemApprovals = {
    ...itemExecutorApprovals,
    reviewItems: {
      ...itemExecutorApprovals.reviewItems,
      "downloads-installers": {
        ...itemExecutorApprovals.reviewItems["downloads-installers"],
        "downloads-installers-vscode": "keep"
      }
    }
  };
  const changedItemReviews = guard.buildReviewItemsByAction(developerActions, null, [], changedItemApprovals);
  const changedItemPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["downloads-installers"]),
    actionList: developerActions,
    approvals: changedItemApprovals,
    protectedPaths: [],
    itemReviewsByAction: changedItemReviews,
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  assert.notStrictEqual(itemPlanSnapshot.id, changedItemPlanSnapshot.id, "item decision changes should change the plan id");
  const itemExecutedAt = "2026-06-04T10:00:00.000Z";
  const taggedItemLedger = guard.makeExecutionLedgerForActions(new Set(["downloads-installers"]), developerActions, [], {
    approvals: itemExecutorApprovals,
    itemReviewsByAction: itemExecutorReviews,
    planSnapshot: itemPlanSnapshot,
    executedAt: itemExecutedAt
  });
  assert.strictEqual(taggedItemLedger[0].planId, itemPlanSnapshot.id, "ledger entries should carry the plan id");
  assert.strictEqual(taggedItemLedger[0].executedAt, itemExecutedAt, "ledger entries should carry an absolute execution timestamp");
  const currentVerification = guard.buildVerificationSummary({
    planSnapshot: itemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo"
  });
  assert.strictEqual(currentVerification.status, "ledger-current", "matching ledger and plan should verify as current");
  const postRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: itemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo"
  });
  assert.strictEqual(postRunVerification.schemaVersion, "spaceguard-post-run-verification/v1", "post-run verification should have a schema version");
  assert.strictEqual(postRunVerification.status, "needs-native-rescan", "post-run verification should require native evidence in demo mode");
  assert.strictEqual(postRunVerification.current, true, "matching post-run ledger should be current");
  assert.strictEqual(postRunVerification.checkpoints.length, taggedItemLedger.length, "post-run verification should create one checkpoint per ledger entry");
  assert(postRunVerification.checkpoints[0].path.includes("Downloads"), "post-run checkpoint should include affected root path");
  const postRunMarkdown = guard.buildPostRunVerificationMarkdown(postRunVerification);
  assert(postRunMarkdown.includes("SpaceGuard Post-Run Verification Checklist"), "post-run verification markdown should have a title");
  assert(postRunMarkdown.includes("needs-native-rescan"), "post-run verification markdown should include status");
  const demoRescanComparison = guard.buildRescanComparison({
    postRunVerification,
    ledger: taggedItemLedger,
    scanMode: "demo"
  });
  assert.strictEqual(demoRescanComparison.schemaVersion, "spaceguard-rescan-comparison/v1", "rescan comparison should have a schema version");
  assert.strictEqual(demoRescanComparison.status, "needs-native-rescan", "demo comparison should require native scan evidence");
  assert.strictEqual(demoRescanComparison.rows[0].state, "needs-native-rescan", "demo row should wait for native rescan evidence");
  const proofRequiredHandoff = guard.buildExecutionProofHandoff({
    ledger: taggedItemLedger,
    verificationSummary: currentVerification,
    postRunVerification,
    rescanComparison: demoRescanComparison,
    nativeCapability: { available: false }
  });
  assert.strictEqual(proofRequiredHandoff.schemaVersion, "spaceguard-execution-proof-handoff/v1", "execution proof handoff should have a schema version");
  assert.strictEqual(proofRequiredHandoff.status, "proof-required", "ledgered execution should require post-run proof");
  assert.strictEqual(proofRequiredHandoff.canRunRescan, false, "handoff should not offer post-run rescan outside the native shell");
  assert.strictEqual(proofRequiredHandoff.ledgerEntries, taggedItemLedger.length, "handoff should count ledger rows");

  const tempPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["windows-temp"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "native-readonly",
    goalBytes: 10 * guard.GB
  });
  const tempExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-temp"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "native-readonly"
  });
  const tempLedger = guard.makeExecutionLedgerForActions(new Set(["windows-temp"]), developerActions, [], {
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    planSnapshot: tempPlanSnapshot,
    executedAt: "2026-06-04T10:00:00.000Z"
  });
  const tempPostRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: tempPlanSnapshot,
    ledger: tempLedger,
    executorPlan: tempExecutorPlan,
    scanMode: "native-readonly",
    nativeScan: { available: true, generatedAt: "2026-06-04T09:59:00.000Z", findings: [] }
  });
  const earlyNativeComparison = guard.buildRescanComparison({
    postRunVerification: tempPostRunVerification,
    ledger: tempLedger,
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      generatedAt: "2026-06-04T09:59:00.000Z",
      findings: [{ recipeId: "windows-temp", title: "Windows temp", path: "%TEMP%", bytes: tempLedger[0].bytes, status: "measured" }]
    }
  });
  assert.strictEqual(earlyNativeComparison.status, "needs-post-run-native-rescan", "native scan older than the ledger should not count as post-run proof");
  assert.strictEqual(earlyNativeComparison.rows[0].state, "needs-post-run-native-rescan", "row should wait for a later native scan");
  const mismatchComparison = guard.buildRescanComparison({
    postRunVerification: tempPostRunVerification,
    ledger: tempLedger,
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      generatedAt: "2026-06-04T10:05:00.000Z",
      findings: [{ recipeId: "windows-temp", title: "Windows temp", path: "%TEMP%", bytes: tempLedger[0].bytes, status: "measured" }]
    }
  });
  assert.strictEqual(mismatchComparison.status, "mismatch", "native bytes still present after the ledger should be a mismatch");
  assert.strictEqual(mismatchComparison.rows[0].state, "mismatch", "comparison row should flag affected-root mismatch");
  const matchedComparison = guard.buildRescanComparison({
    postRunVerification: tempPostRunVerification,
    ledger: tempLedger,
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      generatedAt: "2026-06-04T10:05:00.000Z",
      findings: [{ recipeId: "windows-temp", title: "Windows temp", path: "%TEMP%", bytes: 0, status: "measured" }]
    }
  });
  assert.strictEqual(matchedComparison.status, "matched", "zero remaining bytes after a full temp cleanup should match within tolerance");
  const matchedHandoff = guard.buildExecutionProofHandoff({
    ledger: tempLedger,
    postRunVerification: tempPostRunVerification,
    rescanComparison: matchedComparison,
    nativeCapability: { available: true }
  });
  assert.strictEqual(matchedHandoff.status, "proof-complete", "matched rescan comparison should complete proof handoff");
  assert.strictEqual(matchedHandoff.canRunRescan, false, "completed proof handoff should not ask for another rescan");
  const mismatchHandoff = guard.buildExecutionProofHandoff({
    ledger: tempLedger,
    postRunVerification: tempPostRunVerification,
    rescanComparison: mismatchComparison,
    nativeCapability: { available: true }
  });
  assert.strictEqual(mismatchHandoff.status, "proof-mismatch", "mismatched rescan comparison should block proof handoff");
  assert.strictEqual(mismatchHandoff.canRunRescan, true, "mismatched proof handoff should allow a repeat post-run rescan");
  const unixTimestampComparison = guard.buildRescanComparison({
    postRunVerification: tempPostRunVerification,
    ledger: tempLedger,
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      generatedAt: "unix:1780574700",
      findings: [{ recipeId: "windows-temp", title: "Windows temp", path: "%TEMP%", bytes: 0, status: "measured" }]
    }
  });
  assert.strictEqual(unixTimestampComparison.postRunScanEvidence, true, "native unix timestamps should compare against ISO ledger timestamps");
  assert.strictEqual(unixTimestampComparison.status, "matched", "native unix timestamp scans should be allowed to prove matched parity");
  const skippedPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["browser-identity"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "native-readonly",
    goalBytes: 10 * guard.GB
  });
  const skippedExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["browser-identity"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "native-readonly"
  });
  const skippedLedger = guard.makeExecutionLedgerForActions(new Set(["browser-identity"]), developerActions, [], {
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    planSnapshot: skippedPlanSnapshot,
    executedAt: "2026-06-04T10:00:00.000Z"
  });
  const skippedPostRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: skippedPlanSnapshot,
    ledger: skippedLedger,
    executorPlan: skippedExecutorPlan,
    scanMode: "native-readonly",
    nativeScan: { available: true, generatedAt: "2026-06-04T10:05:00.000Z", findings: [] }
  });
  const skippedComparison = guard.buildRescanComparison({
    postRunVerification: skippedPostRunVerification,
    ledger: skippedLedger,
    scanMode: "native-readonly",
    nativeScan: { available: true, generatedAt: "2026-06-04T10:05:00.000Z", findings: [] }
  });
  assert.strictEqual(skippedComparison.status, "skipped", "all-skipped ledgers should stay skipped in rescan comparison");
  assert.strictEqual(skippedComparison.rows[0].state, "skipped", "skipped checkpoint should not be treated as mismatch");
  const rescanMarkdown = guard.buildRescanComparisonMarkdown(mismatchComparison);
  assert(rescanMarkdown.includes("SpaceGuard Rescan Comparison"), "rescan comparison markdown should have a title");
  assert(rescanMarkdown.includes("mismatch"), "rescan comparison markdown should include row state");
  const itemRollbackPlan = guard.buildRollbackPlan({
    planSnapshot: itemPlanSnapshot,
    executorPlan: itemExecutorPlan,
    itemReviewsByAction: itemExecutorReviews,
    postRunVerification,
    scanMode: "demo"
  });
  const downloadsRollbackRow = itemRollbackPlan.rows.find((row) => row.id === "downloads-installers");
  assert.strictEqual(itemRollbackPlan.schemaVersion, "spaceguard-rollback-plan/v1", "rollback plan should have a schema version");
  assert.strictEqual(itemRollbackPlan.status, "needs-rollback-proof", "reviewed item routes should require restore proof");
  assert.strictEqual(itemRollbackPlan.realRunEnabled, false, "rollback plan must not imply real execution");
  assert.strictEqual(downloadsRollbackRow.status, "restore-proof-required", "downloads review route should require a restore location");
  assert.strictEqual(downloadsRollbackRow.proofRequired, true, "downloads review route should require structured rollback proof");
  assert.strictEqual(downloadsRollbackRow.proof.status, "missing", "missing rollback evidence should be visible");
  assert(downloadsRollbackRow.restoreTarget.includes("Recycle Bin"), "downloads rollback row should prefer Recycle Bin or quarantine");
  assert(downloadsRollbackRow.requiredEvidence.some((item) => item.includes("Per-item")), "rollback plan should require item-decision evidence");
  const rollbackProofQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["downloads-installers"]),
    approvals: itemExecutorApprovals,
    rollbackPlan: itemRollbackPlan
  });
  assert(rollbackProofQuestions.questions.some((question) => question.id === "rollback-proof-detail" && question.action === "focus-panel"), "question queue should ask for rollback proof details");
  assert.strictEqual(rollbackProofQuestions.counts.rollback, 1, "question queue should count rollback questions");
  const incompleteRollbackPlan = guard.buildRollbackPlan({
    planSnapshot: itemPlanSnapshot,
    executorPlan: itemExecutorPlan,
    itemReviewsByAction: itemExecutorReviews,
    postRunVerification,
    rollbackEvidence: {
      "downloads-installers": {
        status: "proved",
        evidencePath: "evidence/downloads-rollback.json",
        reviewer: "qa-operator"
      }
    },
    scanMode: "demo"
  });
  assert.strictEqual(incompleteRollbackPlan.status, "needs-rollback-proof", "marked rollback proof without restore reference should still block");
  assert.strictEqual(incompleteRollbackPlan.counts.proofDraft, 1, "incomplete rollback proof should count as a draft");
  assert.strictEqual(incompleteRollbackPlan.rows[0].proof.complete, false, "incomplete rollback proof must not become complete");
  const completeRollbackPlan = guard.buildRollbackPlan({
    planSnapshot: itemPlanSnapshot,
    executorPlan: itemExecutorPlan,
    itemReviewsByAction: itemExecutorReviews,
    postRunVerification,
    rollbackEvidence: {
      "downloads-installers": {
        status: "proved",
        restoreLocation: "Recycle Bin restore check SG-RB-001",
        evidencePath: "evidence/downloads-rollback.json",
        reviewer: "qa-operator",
        notes: "Reviewed items have a visible restore location.",
        recordedAt: "2026-06-04T11:00:00.000Z"
      }
    },
    scanMode: "demo"
  });
  assert.strictEqual(completeRollbackPlan.status, "rebuildable-routes", "complete rollback proof should clear rollback-proof blockers only");
  assert.strictEqual(completeRollbackPlan.realRunEnabled, false, "complete rollback proof still must not imply real execution");
  assert.strictEqual(completeRollbackPlan.counts.needsProof, 0, "complete rollback proof should clear the proof count");
  assert.strictEqual(completeRollbackPlan.counts.proofComplete, 1, "complete rollback proof should be counted");
  assert.strictEqual(completeRollbackPlan.rows[0].status, "proof-complete", "complete rollback proof should be visible on the route row");
  const legacyRollbackProof = guard.normalizeRollbackEvidenceRecord("downloads-installers", { status: "restore-proof-required" }, true);
  assert.strictEqual(legacyRollbackProof.status, "legacy-needs-detail", "legacy rollback proof should need structured detail");
  assert.strictEqual(legacyRollbackProof.complete, false, "legacy rollback proof must not satisfy write readiness");
  const tempRollbackPlan = guard.buildRollbackPlan({
    executorPlan: guard.buildExecutorPlan({
      selectedIds: new Set(["windows-temp"]),
      actionList: developerActions,
      approvals: { groupConfirm: true, reviewed: {}, typed: {} },
      protectedPaths: [],
      scanMode: "demo"
    }),
    scanMode: "demo"
  });
  assert.strictEqual(tempRollbackPlan.status, "rebuildable-routes", "safe temp route should be classified as rebuildable/disposable");
  assert.strictEqual(tempRollbackPlan.rows[0].status, "rebuildable-rescan", "temp rollback should require rescan proof");
  assert(tempRollbackPlan.steps.some((step) => step.includes("native read-only rescan")), "rebuildable rollback should point to native rescan parity");
  const rollbackReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["downloads-installers"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["downloads-installers"]), itemExecutorApprovals, developerActions, [], itemExecutorReviews),
    ledger: taggedItemLedger,
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    itemReviewsByAction: itemExecutorReviews,
    rollbackPlan: itemRollbackPlan,
    rescanComparison: demoRescanComparison
  });
  assert(rollbackReport.includes("## Rollback Plan"), "dry-run report should include rollback plan");
  assert(rollbackReport.includes("Routes needing proof: 1"), "rollback report should include proof count");
  const completeRollbackReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["downloads-installers"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["downloads-installers"]), itemExecutorApprovals, developerActions, [], itemExecutorReviews),
    ledger: taggedItemLedger,
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    itemReviewsByAction: itemExecutorReviews,
    rollbackPlan: completeRollbackPlan,
    rescanComparison: demoRescanComparison
  });
  assert(completeRollbackReport.includes("Proof complete: 1"), "rollback report should include completed proof count");
  assert(completeRollbackReport.includes("evidence/downloads-rollback.json"), "rollback report should include proof evidence path");
  assert(rollbackReport.includes("## Rescan Comparison"), "dry-run report should include rescan comparison");
  assert(rollbackReport.includes("Post-run scan evidence: no"), "rescan comparison report should show missing post-run evidence");
  const staleVerification = guard.buildVerificationSummary({
    planSnapshot: changedItemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo"
  });
  assert.strictEqual(staleVerification.status, "stale-ledger", "ledger from an older plan should be marked stale");
  const stalePostRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: changedItemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo"
  });
  assert.strictEqual(stalePostRunVerification.status, "stale-ledger", "post-run verification must reject stale ledger evidence");

  const executorReadiness = guard.buildExecutorReadiness(
    executorPlan,
    guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: new Set(["windows-temp"]),
      actionList: developerActions,
      readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, []),
      protectedPaths: [],
      ledger: []
    })
  );
  assert(executorReadiness.items.some((item) => item.id === "real-disabled" && item.passed), "executor readiness should explicitly pass because real deletion is disabled");

  const cleanRunPreflight = guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: new Set(["windows-temp"]),
      actionList: developerActions,
      readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, []),
      protectedPaths: [],
      ledger: []
    });
  const cleanRunExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-temp"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    preflight: cleanRunPreflight
  });
  const runReady = guard.buildRunReadiness(
    cleanRunPreflight,
    guard.buildExecutorReadiness(cleanRunExecutorPlan, cleanRunPreflight)
  );
  assert.strictEqual(runReady.ready, true, "run readiness should pass for approved dry-run routes");
  const cleanRunSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["windows-temp"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  const unarmedConsent = guard.buildExecutionConsentReceipt({
    planSnapshot: cleanRunSnapshot,
    executorPlan: cleanRunExecutorPlan,
    runReadiness: runReady,
    consent: { accepted: false, planId: "" }
  });
  assert.strictEqual(unarmedConsent.ready, false, "execution consent should be required even when run readiness passes");
  assert(unarmedConsent.items.some((item) => item.id === "plan-accepted" && !item.passed), "consent receipt should surface missing final acknowledgement");
  const consentQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    runReadiness: runReady,
    consentReceipt: unarmedConsent,
    verificationSummary: { current: false }
  });
  assert.strictEqual(consentQuestions.activeQuestion.id, "arm-dry-run", "question queue should ask to arm dry-run when run readiness passes");
  const armedConsent = guard.buildExecutionConsentReceipt({
    planSnapshot: cleanRunSnapshot,
    executorPlan: cleanRunExecutorPlan,
    runReadiness: runReady,
    consent: { accepted: true, planId: cleanRunSnapshot.id, acceptedAt: "2026-06-03T00:00:00.000Z" }
  });
  assert.strictEqual(armedConsent.ready, true, "matching consent should arm the current dry-run plan");
  assert.strictEqual(armedConsent.expectedBytes, cleanRunExecutorPlan.dryRunBytes, "consent receipt should summarize expected dry-run bytes");
  const simulateQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    runReadiness: runReady,
    consentReceipt: armedConsent,
    dryRunLaunchGuard: { ready: true, status: "dry-run-launch-ready", dryRunAllowed: true },
    verificationSummary: { current: false }
  });
  assert(simulateQuestions.questions.some((question) => question.id === "simulate-current-plan" && question.action === "simulate"), "question queue should ask to simulate an armed plan");
  const blockedLaunchQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    runReadiness: runReady,
    consentReceipt: armedConsent,
    dryRunLaunchGuard: staleLaunchGuard,
    verificationSummary: { current: false }
  });
  assert.strictEqual(blockedLaunchQuestions.activeQuestion.id, "resolve-dry-run-launch", "question queue should ask to resolve a blocked launch guard before simulation");
  assert(!blockedLaunchQuestions.questions.some((question) => question.id === "simulate-current-plan"), "blocked launch guard must suppress simulate question");
  const unsafeLaunchQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    runReadiness: runReady,
    consentReceipt: armedConsent,
    dryRunLaunchGuard: unsafeLaunchGuard,
    verificationSummary: { current: false }
  });
  assert.strictEqual(unsafeLaunchQuestions.activeQuestion.id, "resolve-safety-interlock", "unsafe launch guard should route the agent to safety review");
  const launchOperatingChecklist = guard.buildOperatingChecklist({
    scanned: true,
    scanning: false,
    scanMode: "demo",
    scanSession: demoScanSession,
    agentQuestionQueue: simulateQuestions,
    runReadiness: runReady,
    consentReceipt: armedConsent,
    dryRunLaunchGuard: { ready: true, status: "dry-run-launch-ready", dryRunAllowed: true, realRunAllowed: false },
    safetyInterlock: { status: "dry-run-interlocked", dryRunAllowed: true, realRunAllowed: false, destructiveCommands: false },
    ledger: [],
    planSnapshot: cleanRunSnapshot,
    writeReadiness: { readyForRealExecution: false, status: "implementation-locked" },
    releaseReviewPacket: { status: "review-waiting", readyForRealExecution: false, writeSignalVisible: false },
    runtimeCapabilities: { available: false, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(launchOperatingChecklist.schemaVersion, "spaceguard-operating-checklist/v1", "operating checklist should expose a schema version");
  assert.strictEqual(launchOperatingChecklist.status, "dry-run-ready", "operating checklist should surface dry-run launch readiness");
  assert.strictEqual(launchOperatingChecklist.safeActionNow.action, "simulate", "operating checklist should route the next safe action to simulation");
  assert.strictEqual(launchOperatingChecklist.realRunAllowed, false, "operating checklist must not open real execution");
  assert.strictEqual(launchOperatingChecklist.counts.realRun, 0, "operating checklist should keep real-run count at zero");
  const operatingChecklistReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: { ready: true, unresolved: [] },
    ledger: [],
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    operatingChecklist: launchOperatingChecklist
  });
  assert(operatingChecklistReport.includes("## Operating Checklist"), "report should include operating checklist");
  assert(operatingChecklistReport.includes("Real-run rows: 0"), "operating checklist report should keep real-run rows at zero");
  const unsafeOperatingChecklist = guard.buildOperatingChecklist({
    scanned: true,
    scanning: false,
    scanMode: "demo",
    scanSession: demoScanSession,
    agentQuestionQueue: unsafeLaunchQuestions,
    runReadiness: runReady,
    consentReceipt: armedConsent,
    dryRunLaunchGuard: unsafeLaunchGuard,
    safetyInterlock: { status: "unsafe-stop", dryRunAllowed: false, realRunAllowed: false, destructiveCommands: true },
    writeReadiness: { readyForRealExecution: false, status: "implementation-locked" },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: true }
  });
  assert.strictEqual(unsafeOperatingChecklist.status, "unsafe-stop", "operating checklist should stop on unsafe execution signals");
  assert.strictEqual(unsafeOperatingChecklist.safeActionNow.action, "focus-panel", "unsafe checklist should route to review, not simulation");
  assert(!unsafeOperatingChecklist.rows.some((row) => row.action === "simulate" && row.canAct), "unsafe checklist must suppress actionable simulation");
  const staleConsent = guard.buildExecutionConsentReceipt({
    planSnapshot: changedItemPlanSnapshot,
    executorPlan: cleanRunExecutorPlan,
    runReadiness: runReady,
    consent: { accepted: true, planId: cleanRunSnapshot.id, acceptedAt: "2026-06-03T00:00:00.000Z" }
  });
  assert.strictEqual(staleConsent.ready, false, "consent must reset when the plan snapshot changes");

  const blockedOnlySelection = new Set(["docker-volumes"]);
  const blockedOnlyPreflight = guard.buildExecutionPreflight({
    scanned: true,
    scanning: false,
    selectedIds: blockedOnlySelection,
    actionList: developerActions,
    readiness: { ready: true, unresolved: [] },
    protectedPaths: [],
    ledger: []
  });
  const blockedOnlyExecutorPlan = guard.buildExecutorPlan({
    selectedIds: blockedOnlySelection,
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    preflight: blockedOnlyPreflight
  });
  const blockedOnlyRunReady = guard.buildRunReadiness(
    blockedOnlyPreflight,
    guard.buildExecutorReadiness(blockedOnlyExecutorPlan, blockedOnlyPreflight)
  );
  assert.strictEqual(blockedOnlyPreflight.ready, true, "workflow preflight alone can pass with synthetic blocked selections");
  assert.strictEqual(blockedOnlyRunReady.ready, false, "run readiness must block selections with no valid dry-run route");
  assert(blockedOnlyRunReady.items.some((item) => item.id === "executor-policy" && !item.passed), "run readiness should surface executor policy blockers");

  const adminRoutePlan = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-old"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo"
  });
  const standardPrivilegeBoundary = guard.buildPrivilegeBoundary({
    runtimeCapabilities: {
      available: true,
      platform: "windows",
      elevated: false,
      elevationSource: "IsUserAnAdmin",
      realRunEnabled: false
    },
    executorPlan: adminRoutePlan
  });
  assert.strictEqual(standardPrivilegeBoundary.status, "admin-required", "admin-sensitive routes should be flagged under standard-user runtime");
  assert.strictEqual(standardPrivilegeBoundary.readyForAdminRoutes, false, "standard-user runtime should not be ready for admin-sensitive routes");
  assert(standardPrivilegeBoundary.adminRows.some((row) => row.id === "windows-old"), "privilege boundary should list selected admin-sensitive routes");
  const elevatedPrivilegeBoundary = guard.buildPrivilegeBoundary({
    runtimeCapabilities: {
      available: true,
      platform: "windows",
      elevated: true,
      elevationSource: "IsUserAnAdmin",
      realRunEnabled: false
    },
    executorPlan: adminRoutePlan
  });
  assert.strictEqual(elevatedPrivilegeBoundary.status, "elevated", "elevated runtime should be visible in privilege boundary");
  assert.strictEqual(elevatedPrivilegeBoundary.readyForAdminRoutes, true, "elevated runtime can satisfy admin route boundary evidence");

  const releaseGate = guard.buildReleaseGate({
    scanMode: "demo",
    nativeCapability: { available: false },
    executorPlan
  });
  assert.strictEqual(releaseGate.readyForRealRun, false, "release gate should block real execution by default");
  assert.strictEqual(releaseGate.realFlagEnabled, false, "real executor feature flag should default off");
  assert(releaseGate.missingRows.length > 0, "release gate should require validation evidence");
  assert(releaseGate.vmRows.some((row) => row.totalCount > 0), "release gate should include disposable VM matrix");
  const perExecutorFlagGate = guard.buildReleaseGate({
    featureFlags: {
      realExecutors: true,
      tempCleanupExecutor: true,
      recycleBinExecutor: false,
      browserCacheExecutor: false,
      toolNativePruneExecutors: false
    },
    validationEvidence: makePassedEvidence(["windows-native-build", "scanner-fixtures"]),
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  assert.strictEqual(perExecutorFlagGate.flags.tempCleanupExecutor, true, "release gate should preserve per-executor temp flag");
  assert.strictEqual(perExecutorFlagGate.flags.recycleBinExecutor, false, "release gate should keep unrelated executor flags separate");

  const partialEvidenceGate = guard.buildReleaseGate({
    featureFlags: { realExecutors: true },
    validationEvidence: makePassedEvidence(["windows-native-build"]),
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  assert.strictEqual(partialEvidenceGate.rows.find((row) => row.id === "windows-native-build").passed, true, "release gate should accept recorded validation evidence");
  assert.strictEqual(partialEvidenceGate.readyForRealRun, false, "partial validation evidence must not open real run");
  const fixtureEvidence = {
    schemaVersion: "spaceguard-fixture-evidence/v1",
    generatedAt: "2026-06-04T12:00:00.000Z",
    manifestPath: "C:\\Temp\\spaceguard-fixture-manifest.json",
    profileRoot: "C:\\Users\\demo",
    destructiveCommands: false,
    passed: true,
    counts: {
      records: 4,
      missing: 0,
      sizeMismatches: 0,
      ageMismatches: 0
    },
    records: [
      { purpose: "known-temp-fixture", exists: true, sizeMatches: true, oldEnough: true, expectedBytes: 1024, actualBytes: 1024 },
      { purpose: "protected-path-fixture", exists: true, sizeMatches: true, oldEnough: true, expectedBytes: 1024, actualBytes: 1024 },
      { purpose: "review-data-fixture", exists: true, sizeMatches: true, oldEnough: true, expectedBytes: 1024, actualBytes: 1024 },
      { purpose: "developer-tooling-fixture", exists: true, sizeMatches: true, oldEnough: true, expectedBytes: 1024, actualBytes: 1024 }
    ],
    dryRunScopeCheck: {
      provided: true,
      destructiveCommands: false,
      passed: true,
      counts: { cases: 2, allowed: 1, rejected: 1, failed: 0 },
      cases: [
        { id: "windows-temp", route: "known-temp-delete", targetScopeStatus: "target-allowed", rejectCode: "", candidateCount: 1, passed: true },
        { id: "downloads-forbidden-as-temp", route: "known-temp-delete", targetScopeStatus: "target-blocked", rejectCode: "target-forbidden", candidateCount: 0, passed: true }
      ]
    }
  };
  const fixtureImport = guard.buildFixtureEvidenceImport({
    evidenceObject: fixtureEvidence,
    reviewer: "qa-operator",
    artifactId: "evidence/fixture-evidence.json",
    currentEvidence: {}
  });
  assert.strictEqual(fixtureImport.schemaVersion, "spaceguard-fixture-evidence-import/v1", "fixture import should expose a schema version");
  assert.strictEqual(fixtureImport.status, "ready", "passing fixture evidence should be importable");
  assert.strictEqual(fixtureImport.canApply, true, "passing fixture evidence with reviewer should be applicable");
  assert.deepStrictEqual(fixtureImport.mappedCheckIds, ["scanner-fixtures", "dry-run-target-scope"], "fixture import should map scanner and explicit dry-run scope validation only");
  assert.strictEqual(fixtureImport.validationEvidence["scanner-fixtures"].status, "passed", "fixture import should prepare scanner-fixtures evidence");
  assert.strictEqual(fixtureImport.validationEvidence["dry-run-target-scope"].status, "passed", "fixture import should prepare dry-run target-scope evidence when explicit scope cases pass");
  assert.strictEqual(fixtureImport.validationEvidence["scanner-fixtures"].evidencePath, "evidence/fixture-evidence.json", "fixture import should keep the artifact id");
  assert.strictEqual(fixtureImport.validationEvidence["protected-path-fixtures"], undefined, "fixture import must not overclaim protected-path validation");
  assert(fixtureImport.warnings.some((warning) => warning.includes("Protected-path fixture presence")), "fixture import should warn about non-imported protected-path proof");
  const fixtureImportGate = guard.buildReleaseGate({
    featureFlags: { realExecutors: true },
    validationEvidence: fixtureImport.validationEvidence,
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  assert.strictEqual(fixtureImportGate.rows.find((row) => row.id === "scanner-fixtures").passed, true, "fixture import should feed validation evidence");
  assert.strictEqual(fixtureImportGate.rows.find((row) => row.id === "dry-run-target-scope").passed, true, "explicit dry-run scope fixture evidence should feed target-scope validation");
  assert.strictEqual(fixtureImportGate.rows.find((row) => row.id === "protected-path-fixtures").passed, false, "fixture import must leave protected-path validation manual");
  assert.strictEqual(fixtureImportGate.readyForRealRun, false, "fixture import alone must not open real execution");
  const noDryRunScopeImport = guard.buildFixtureEvidenceImport({
    evidenceObject: { ...fixtureEvidence, dryRunScopeCheck: undefined },
    reviewer: "qa-operator",
    artifactId: "evidence/fixture-evidence.json",
    currentEvidence: {}
  });
  assert.deepStrictEqual(noDryRunScopeImport.mappedCheckIds, ["scanner-fixtures"], "fixture import without dry-run scope proof should map scanner fixtures only");
  assert.strictEqual(noDryRunScopeImport.validationEvidence["dry-run-target-scope"], undefined, "missing dry-run scope proof must not create target-scope validation evidence");
  assert(noDryRunScopeImport.warnings.some((warning) => warning.includes("Dry-run target-scope evidence was not present")), "fixture import should warn when dry-run scope evidence is missing");
  const nativeScopeEvidence = guard.buildNativeDryRunScopeEvidence({
    nativeExecutorDryRun: {
      result: {
        mode: "native-dry-run",
        realRunEnabled: false,
        destructiveCommands: false,
        entries: [
          {
            id: "windows-temp",
            title: "Windows temp",
            route: "known-temp-delete",
            targetPath: "%TEMP%",
            targetScopeStatus: "target-allowed",
            rejectCode: "",
            candidateCount: 1,
            candidates: [{ name: "secret.tmp" }]
          },
          {
            id: "downloads-forbidden-as-temp",
            title: "Downloads forbidden",
            route: "known-temp-delete",
            targetPath: "C:\\Users\\demo\\Downloads",
            targetScopeStatus: "target-blocked",
            rejectCode: "target-forbidden",
            candidateCount: 0,
            candidates: [{ name: "should-not-export.zip" }]
          }
        ]
      }
    },
    planSnapshot: { id: "plan-scope" },
    scanSession: { fingerprint: "scan-scope" },
    exportedAt: "2026-06-04T12:30:00.000Z"
  });
  assert.strictEqual(nativeScopeEvidence.schemaVersion, "spaceguard-native-dry-run-scope/v1", "native dry-run scope evidence should expose a schema");
  assert.strictEqual(nativeScopeEvidence.passed, true, "native dry-run scope evidence should pass with allowed and rejected scope entries");
  assert.strictEqual(nativeScopeEvidence.counts.rejectedWithSamples, 0, "rejected target scopes should export zero candidate samples");
  assert.strictEqual(nativeScopeEvidence.entries[0].candidates, undefined, "native dry-run scope evidence must not export candidate filenames");
  assert.strictEqual(nativeScopeEvidence.planId, "plan-scope", "native scope evidence should include plan id");
  assert.strictEqual(nativeScopeEvidence.scanFingerprint, "scan-scope", "native scope evidence should include scan fingerprint");
  const candidateSafetyManifest = guard.buildCandidateSafetyManifest({
    nativeExecutorDryRun: {
      status: "complete",
      result: {
        mode: "native-dry-run",
        realRunEnabled: false,
        destructiveCommands: false,
        entries: [
          {
            id: "windows-temp",
            title: "Windows temp",
            route: "known-temp-delete",
            targetPath: "%TEMP%",
            targetScopeStatus: "target-allowed",
            rejectCode: "",
            candidateBytes: 4096,
            candidateCount: 2,
            skippedCount: 1,
            candidates: [{ name: "a.tmp" }, { name: "b.tmp" }]
          },
          {
            id: "downloads-forbidden-as-temp",
            title: "Downloads forbidden",
            route: "known-temp-delete",
            targetPath: "C:\\Users\\demo\\Downloads",
            targetScopeStatus: "target-blocked",
            rejectCode: "target-forbidden",
            candidateBytes: 0,
            candidateCount: 0,
            skippedCount: 1,
            candidates: []
          }
        ]
      }
    },
    executorPlan: { rows: [{ route: "known-temp-delete" }] },
    firstSafeExecutorContract: { route: { id: "known-temp-delete" } },
    nativeEvidenceQuality: { planningReady: true },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(candidateSafetyManifest.schemaVersion, "spaceguard-candidate-safety-manifest/v1", "candidate safety manifest should expose a schema");
  assert.strictEqual(candidateSafetyManifest.status, "candidate-manifest-ready", "candidate manifest should be ready when allowed samples and rejected sample-free scopes exist");
  assert.strictEqual(candidateSafetyManifest.readyForImplementationEvidence, true, "candidate manifest should mark implementation evidence ready");
  assert.strictEqual(candidateSafetyManifest.counts.executorRoutes, 0, "candidate manifest must not create executor routes");
  assert.strictEqual(candidateSafetyManifest.counts.realRun, 0, "candidate manifest must not create real-run rows");
  assert(candidateSafetyManifest.rows.some((row) => row.id === "downloads-forbidden-as-temp" && row.status === "target-rejected"), "candidate manifest should preserve rejected target rows");
  const candidateSafetyReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: [],
    protectedPaths,
    goalBytes: 10 * guard.GB,
    candidateSafetyManifest
  });
  assert(candidateSafetyReport.includes("## Candidate Safety Manifest"), "report should include candidate safety manifest");
  assert(candidateSafetyReport.includes("Real-run rows: 0"), "candidate safety report should preserve zero real-run rows");
  const candidateSafetyAudit = guard.buildProductCompletionAudit({
    scanned: true,
    scanMode: "native-readonly",
    candidateSafetyManifest
  });
  assert.strictEqual(
    candidateSafetyAudit.rows.find((row) => row.id === "prove-candidate-safety").status,
    "native-proven",
    "product audit should track candidate safety evidence"
  );
  const unsafeNativeScopeEvidence = guard.buildNativeDryRunScopeEvidence({
    nativeExecutorDryRun: {
      result: {
        realRunEnabled: false,
        destructiveCommands: false,
        entries: [
          { id: "bad", route: "known-temp-delete", targetScopeStatus: "target-blocked", rejectCode: "target-forbidden", candidateCount: 1 }
        ]
      }
    }
  });
  assert.strictEqual(unsafeNativeScopeEvidence.passed, false, "native dry-run scope evidence should fail if rejected targets report samples");
  const unsafeCandidateManifest = guard.buildCandidateSafetyManifest({
    nativeExecutorDryRun: {
      status: "complete",
      result: {
        realRunEnabled: false,
        destructiveCommands: false,
        entries: [
          { id: "bad", title: "Bad target", route: "known-temp-delete", targetScopeStatus: "target-blocked", rejectCode: "target-forbidden", candidateCount: 1, candidates: [{ name: "leak.tmp" }] }
        ]
      }
    },
    firstSafeExecutorContract: { route: { id: "known-temp-delete" } },
    nativeEvidenceQuality: { planningReady: true }
  });
  assert.strictEqual(unsafeCandidateManifest.status, "scope-leak", "candidate safety should block rejected scopes that return samples");
  assert.strictEqual(unsafeCandidateManifest.readyForImplementationEvidence, false, "scope leak must not be implementation evidence");
  const statusOnlyRejectedSamplesEvidence = guard.buildNativeDryRunScopeEvidence({
    nativeExecutorDryRun: {
      result: {
        realRunEnabled: false,
        destructiveCommands: false,
        entries: [
          { id: "allowed", route: "known-temp-delete", targetScopeStatus: "target-allowed", rejectCode: "", candidateCount: 0 },
          { id: "blocked", route: "known-temp-delete", targetScopeStatus: "target-blocked", rejectCode: "", candidateCount: 1 }
        ]
      }
    }
  });
  assert.strictEqual(statusOnlyRejectedSamplesEvidence.counts.rejectedWithSamples, 1, "blocked target scopes with samples should be counted even without a reject code");
  assert.strictEqual(statusOnlyRejectedSamplesEvidence.passed, false, "blocked target scopes with samples should fail evidence even without a reject code");
  const noReviewerFixtureImport = guard.buildFixtureEvidenceImport({
    evidenceObject: fixtureEvidence,
    reviewer: "",
    currentEvidence: {}
  });
  assert.strictEqual(noReviewerFixtureImport.status, "missing-reviewer", "fixture import should require reviewer detail");
  assert.strictEqual(noReviewerFixtureImport.canApply, false, "fixture import without reviewer should not apply");
  const destructiveFixtureImport = guard.buildFixtureEvidenceImport({
    evidenceObject: { ...fixtureEvidence, destructiveCommands: true },
    reviewer: "qa-operator",
    currentEvidence: {}
  });
  assert.strictEqual(destructiveFixtureImport.status, "destructive-evidence", "destructive fixture evidence should be rejected");
  const failedFixtureImport = guard.buildFixtureEvidenceImport({
    evidenceObject: { ...fixtureEvidence, passed: false, counts: { ...fixtureEvidence.counts, missing: 1 } },
    reviewer: "qa-operator",
    currentEvidence: {}
  });
  assert.strictEqual(failedFixtureImport.status, "fixture-failed", "failed fixture evidence should be rejected");
  const missingFixtureValidationPack = guard.buildValidationEvidencePack({
    releaseGate,
    executorPlan,
    scanMode: "native-readonly",
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false }
  });
  const fixtureImportQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    validationPack: missingFixtureValidationPack,
    fixtureImportResult: null
  });
  assert(fixtureImportQuestions.questions.some((question) => question.id === "import-fixture-evidence" && question.targetPanel === "validation-evidence-panel"), "question queue should ask to import missing fixture evidence");
  const legacyEvidenceGate = guard.buildReleaseGate({
    featureFlags: { realExecutors: true },
    validationEvidence: { "windows-native-build": "passed" },
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  assert.strictEqual(legacyEvidenceGate.rows.find((row) => row.id === "windows-native-build").passed, false, "legacy checkbox evidence should need reviewer and artifact details");
  assert.strictEqual(legacyEvidenceGate.rows.find((row) => row.id === "windows-native-build").status, "legacy-needs-detail", "legacy evidence should stay visible as detail-needed");
  const legacyValidationPack = guard.buildValidationEvidencePack({
    releaseGate: legacyEvidenceGate,
    executorPlan,
    scanMode: "native-readonly",
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false }
  });
  const validationDetailQuestions = guard.buildAgentQuestionQueue({
    scanned: true,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    validationPack: legacyValidationPack
  });
  assert(validationDetailQuestions.questions.some((question) => question.id === "validation-evidence-detail" && question.action === "focus-panel" && question.targetPanel === "validation-evidence-panel"), "question queue should ask for validation evidence details");

  const executorManifest = guard.buildExecutorManifest({
    actionList: developerActions,
    executorPlan,
    releaseGate
  });
  const tempRoute = executorManifest.routes.find((route) => route.route === "known-temp-delete");
  const largeFileRoute = executorManifest.routes.find((route) => route.route === "item-review-large-files");
  const blockedRoute = executorManifest.routes.find((route) => route.route === "blocked");
  assert.strictEqual(executorManifest.schemaVersion, "spaceguard-executor-manifest/v1", "executor manifest should have a schema version");
  assert(tempRoute, "executor manifest should include known temp route");
  assert(tempRoute.requiredChecks.some((check) => check.id === "temp-locked-files"), "temp route should require locked-file evidence");
  assert(tempRoute.fixtureIds.includes("known-temp-fixture"), "temp route should point to the temp fixture");
  assert.strictEqual(tempRoute.status, "needs-validation", "first-safe route should still need Windows validation by default");
  assert.strictEqual(tempRoute.realRunEnabled, false, "manifest must keep temp real execution disabled");
  assert(largeFileRoute, "executor manifest should include large-file item review route");
  assert(largeFileRoute.fixtureIds.includes("review-data-fixture"), "large-file route should point to review data fixtures");
  assert.strictEqual(largeFileRoute.realRunEnabled, false, "large-file route must keep real execution disabled");
  assert.strictEqual(blockedRoute.status, "blocked", "blocked policy route should stay blocked in manifest");
  assert(executorManifest.nextSteps.some((step) => step.includes("Windows validation")), "manifest should produce route validation next steps");

  const validationPack = guard.buildValidationEvidencePack({
    releaseGate,
    executorPlan,
    executorManifest,
    scanMode: "demo",
    runtimeCapabilities: {
      available: false,
      mode: "browser-demo",
      platform: "browser",
      windows: false,
      realRunEnabled: false,
      destructiveCommands: false,
      scanKnownRoots: false,
      simulateCleanupPlan: false,
      safeExecutorsEnabled: false
    }
  });
  assert.strictEqual(validationPack.readyForRealRun, false, "validation pack must not mark real execution ready by default");
  assert.strictEqual(validationPack.vmScenarios.length, guard.disposableVmScenarios.length, "validation pack should include every disposable VM scenario");
  assert(validationPack.fixtureRoots.length >= 5, "validation pack should include concrete fixture roots");
  assert(validationPack.validationChecks.every((check) => !check.evidenceComplete && !check.evidencePath && !check.reviewer), "default validation checks should be evidence templates");
  assert(validationPack.commands.some((command) => command.command === "npm run native:build"), "validation pack should include the Windows native build command");
  assert(validationPack.executorRoutes.some((route) => route.route === "known-temp-delete"), "validation pack should include selected executor routes under review");
  assert(validationPack.executorManifest.routes.some((route) => route.route === "browser-cache-only"), "validation pack should include the full executor manifest");
  const validationMarkdown = guard.buildValidationPackMarkdown(validationPack);
  assert(validationMarkdown.includes("SpaceGuard Validation Evidence Pack"), "validation pack markdown should have a title");
  assert(validationMarkdown.includes("Disposable VM Matrix"), "validation pack markdown should include the VM matrix");
  assert(validationMarkdown.includes("Executor Manifest"), "validation pack markdown should include the executor manifest");
  const npmSmokeExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["npm-cache"]),
    actionList: guard.actions,
    approvals: { groupConfirm: true, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
    scanMode: "native-readonly"
  });
  const npmSmokePacket = guard.buildExecutorSmokeRunPacket({
    executorPlan: npmSmokeExecutorPlan,
    runtimeCapabilities: {
      available: true,
      windows: true,
      platform: "windows",
      realRunEnabled: true,
      destructiveCommands: true,
      executorFlags: { npmCacheExecutor: true }
    },
    scanSession: { currentFingerprint: "scan-npm-smoke" },
    consentReceipt: { planId: "plan-npm-smoke" },
    executionProofHandoff: { status: "waiting-for-execution" },
    rescanComparison: { status: "not-run", postRunScanEvidence: false },
    validationPack,
    planSnapshot: { id: "plan-npm-smoke" },
    nativeScan: {
      findings: [
        {
          recipeId: "npm-cache",
          status: "measured",
          path: "C:\\Users\\qa\\AppData\\Local\\npm-cache\\_cacache",
          bytes: 1024 * 1024 * 512
        }
      ]
    }
  });
  assert.strictEqual(npmSmokePacket.schemaVersion, "spaceguard-executor-smoke-run-packet/v1", "smoke packet should expose a schema");
  assert.strictEqual(npmSmokePacket.status, "ready-for-smoke", "enabled scoped route should be ready for a smoke run");
  assert.strictEqual(npmSmokePacket.rows[0].envVar, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "smoke packet should name the executor env var");
  assert.strictEqual(npmSmokePacket.rows[0].requestMode, "execute-npm-cache", "smoke packet should name the native request mode");
  assert.strictEqual(npmSmokePacket.rows[0].panelId, "npm-cache-executor-panel", "smoke packet should point to the executor panel");
  assert(npmSmokePacket.rows[0].checks.some((check) => check.id === "post-run-proof" && check.passed), "smoke packet should verify proof clearance");
  const smokeMarkdown = guard.buildExecutorSmokeRunPacketMarkdown(npmSmokePacket);
  assert(smokeMarkdown.includes("SpaceGuard Executor Smoke-Run Packet"), "smoke packet markdown should have a title");
  assert(smokeMarkdown.includes("Export rescan comparison"), "smoke packet markdown should include proof export steps");
  const userCacheSmokePacket = guard.buildExecutorSmokeRunPacket({
    executorPlan: guard.buildExecutorPlan({
      selectedIds: new Set(["user-cache"]),
      actionList: guard.actions,
      approvals: { groupConfirm: true, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
      scanMode: "native-readonly"
    }),
    runtimeCapabilities: {
      available: true,
      windows: true,
      platform: "windows",
      realRunEnabled: true,
      destructiveCommands: true,
      executorFlags: { userCacheExecutor: true }
    },
    scanSession: { currentFingerprint: "scan-user-cache-smoke" },
    consentReceipt: { planId: "plan-user-cache-smoke" },
    executionProofHandoff: { status: "waiting-for-execution" },
    planSnapshot: { id: "plan-user-cache-smoke" },
    nativeScan: {
      findings: [
        {
          recipeId: "user-cache",
          status: "measured",
          path: "C:\\Users\\qa\\.cache",
          bytes: 1024 * 1024 * 256
        }
      ]
    }
  });
  assert.strictEqual(userCacheSmokePacket.status, "ready-for-smoke", "enabled user .cache route should be ready for a smoke run");
  assert.strictEqual(userCacheSmokePacket.rows[0].envVar, "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR", "user .cache smoke packet should name the executor env var");
  assert.strictEqual(userCacheSmokePacket.rows[0].requestMode, "execute-user-cache", "user .cache smoke packet should name the native request mode");
  assert.strictEqual(userCacheSmokePacket.rows[0].panelId, "user-cache-executor-panel", "user .cache smoke packet should point to the executor panel");
  const androidCacheSmokePacket = guard.buildExecutorSmokeRunPacket({
    executorPlan: guard.buildExecutorPlan({
      selectedIds: new Set(["android-cache"]),
      actionList: guard.actions,
      approvals: { groupConfirm: true, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
      scanMode: "native-readonly"
    }),
    runtimeCapabilities: {
      available: true,
      windows: true,
      platform: "windows",
      realRunEnabled: true,
      destructiveCommands: true,
      executorFlags: { androidCacheExecutor: true }
    },
    scanSession: { currentFingerprint: "scan-android-cache-smoke" },
    consentReceipt: { planId: "plan-android-cache-smoke" },
    executionProofHandoff: { status: "waiting-for-execution" },
    planSnapshot: { id: "plan-android-cache-smoke" },
    nativeScan: {
      findings: [
        {
          recipeId: "android-cache",
          status: "measured",
          path: "C:\\Users\\qa\\AppData\\Local\\Google\\AndroidStudio2025.1\\caches",
          bytes: 1024 * 1024 * 384
        }
      ]
    }
  });
  assert.strictEqual(androidCacheSmokePacket.status, "ready-for-smoke", "enabled Android cache route should be ready for a smoke run");
  assert.strictEqual(androidCacheSmokePacket.rows[0].envVar, "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR", "Android cache smoke packet should name the executor env var");
  assert.strictEqual(androidCacheSmokePacket.rows[0].requestMode, "execute-android-cache", "Android cache smoke packet should name the native request mode");
  assert.strictEqual(androidCacheSmokePacket.rows[0].panelId, "android-cache-executor-panel", "Android cache smoke packet should point to the executor panel");
  const shaderCacheSmokePacket = guard.buildExecutorSmokeRunPacket({
    executorPlan: guard.buildExecutorPlan({
      selectedIds: new Set(["steam-shader-cache"]),
      actionList: guard.actions,
      approvals: { groupConfirm: true, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
      scanMode: "native-readonly"
    }),
    runtimeCapabilities: {
      available: true,
      windows: true,
      platform: "windows",
      realRunEnabled: true,
      destructiveCommands: true,
      executorFlags: { shaderCacheExecutor: true }
    },
    scanSession: { currentFingerprint: "scan-shader-cache-smoke" },
    consentReceipt: { planId: "plan-shader-cache-smoke" },
    executionProofHandoff: { status: "waiting-for-execution" },
    planSnapshot: { id: "plan-shader-cache-smoke" },
    nativeScan: {
      findings: [
        {
          recipeId: "steam-shader-cache",
          status: "measured",
          path: "C:\\Users\\qa\\AppData\\Local\\NVIDIA\\DXCache",
          bytes: 1024 * 1024 * 256
        }
      ]
    }
  });
  assert.strictEqual(shaderCacheSmokePacket.status, "ready-for-smoke", "enabled shader cache route should be ready for a smoke run");
  assert.strictEqual(shaderCacheSmokePacket.rows[0].envVar, "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR", "shader cache smoke packet should name the executor env var");
  assert.strictEqual(shaderCacheSmokePacket.rows[0].requestMode, "execute-shader-cache", "shader cache smoke packet should name the native request mode");
  assert.strictEqual(shaderCacheSmokePacket.rows[0].panelId, "shader-cache-executor-panel", "shader cache smoke packet should point to the executor panel");
  const pipCacheSmokePacket = guard.buildExecutorSmokeRunPacket({
    executorPlan: guard.buildExecutorPlan({
      selectedIds: new Set(["pip-cache"]),
      actionList: guard.actions,
      approvals: { groupConfirm: true, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
      scanMode: "native-readonly"
    }),
    runtimeCapabilities: {
      available: true,
      windows: true,
      platform: "windows",
      realRunEnabled: true,
      destructiveCommands: true,
      executorFlags: { pipCacheExecutor: true }
    },
    scanSession: { currentFingerprint: "scan-pip-cache-smoke" },
    consentReceipt: { planId: "plan-pip-cache-smoke" },
    executionProofHandoff: { status: "waiting-for-execution" },
    planSnapshot: { id: "plan-pip-cache-smoke" },
    nativeScan: {
      findings: [
        {
          recipeId: "pip-cache",
          status: "measured",
          path: "C:\\Users\\qa\\AppData\\Local\\pip\\Cache",
          bytes: 1024 * 1024 * 128
        }
      ]
    }
  });
  assert.strictEqual(pipCacheSmokePacket.status, "ready-for-smoke", "enabled pip cache route should be ready for a smoke run");
  assert.strictEqual(pipCacheSmokePacket.rows[0].envVar, "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR", "pip cache smoke packet should name the executor env var");
  assert.strictEqual(pipCacheSmokePacket.rows[0].requestMode, "execute-pip-cache", "pip cache smoke packet should name the native request mode");
  assert.strictEqual(pipCacheSmokePacket.rows[0].panelId, "pip-cache-executor-panel", "pip cache smoke packet should point to the executor panel");
  const proofBlockedSmokePacket = guard.buildExecutorSmokeRunPacket({
    executorPlan: npmSmokeExecutorPlan,
    runtimeCapabilities: {
      available: true,
      windows: true,
      platform: "windows",
      realRunEnabled: true,
      destructiveCommands: true,
      executorFlags: { npmCacheExecutor: true }
    },
    scanSession: { currentFingerprint: "scan-npm-smoke" },
    consentReceipt: { planId: "plan-npm-smoke" },
    executionProofHandoff: { status: "proof-required" },
    planSnapshot: { id: "plan-npm-smoke" },
    nativeScan: {
      findings: [
        {
          recipeId: "npm-cache",
          status: "measured",
          path: "C:\\Users\\qa\\AppData\\Local\\npm-cache\\_cacache",
          bytes: 1024
        }
      ]
    }
  });
  assert.strictEqual(proofBlockedSmokePacket.status, "needs-proof", "smoke packet should block another executor while proof is pending");
  assert(proofBlockedSmokePacket.rows[0].checks.some((check) => check.id === "post-run-proof" && !check.passed), "smoke packet should expose pending proof as a failed check");
  const scopedCommandFlow = guard.buildScopedExecutorCommandFlow({
    smokeRunPacket: npmSmokePacket,
    executionProofHandoff: { status: "waiting-for-execution" },
    nativeCapability: { available: true },
    scanning: false
  });
  assert.strictEqual(scopedCommandFlow.schemaVersion, "spaceguard-scoped-executor-command-flow/v1", "scoped executor command flow should expose a schema");
  assert.strictEqual(scopedCommandFlow.status, "ready-to-execute", "ready smoke packet should become a real execution command flow");
  assert.strictEqual(scopedCommandFlow.route, "bounded-npm-cache-delete", "command flow should select the enabled scoped route");
  assert.strictEqual(scopedCommandFlow.nextAction.type, "execute-route", "ready command flow should route to the existing executor handler");
  assert.strictEqual(scopedCommandFlow.nextAction.targetPanel, "npm-cache-executor-panel", "ready command flow should focus the scoped executor panel");
  assert(scopedCommandFlow.steps.some((step) => step.id === "scan" && step.targetPanel === "real-data-readiness-panel"), "command flow should route scan work to the real data panel");
  assert(scopedCommandFlow.steps.some((step) => step.id === "proof" && step.actionType === "run-post-run-rescan"), "command flow should include post-run proof as the final step");
  const multiRouteSmokePacket = guard.buildExecutorSmokeRunPacket({
    executorPlan: guard.buildExecutorPlan({
      selectedIds: new Set(["npm-cache", "pnpm-store"]),
      actionList: guard.actions,
      approvals: { groupConfirm: true, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
      scanMode: "native-readonly"
    }),
    runtimeCapabilities: {
      available: true,
      windows: true,
      platform: "windows",
      realRunEnabled: true,
      destructiveCommands: true,
      executorFlags: { npmCacheExecutor: true, pnpmStoreExecutor: true }
    },
    scanSession: { currentFingerprint: "scan-package-cache-smoke" },
    consentReceipt: { planId: "plan-package-cache-smoke" },
    executionProofHandoff: { status: "waiting-for-execution" },
    planSnapshot: { id: "plan-package-cache-smoke" },
    nativeScan: {
      findings: [
        {
          recipeId: "npm-cache",
          status: "measured",
          path: "C:\\Users\\qa\\AppData\\Local\\npm-cache\\_cacache",
          bytes: 1024
        },
        {
          recipeId: "pnpm-store",
          status: "measured",
          path: "C:\\Users\\qa\\AppData\\Local\\pnpm\\store",
          bytes: 2048
        }
      ]
    }
  });
  const selectedPnpmCommandFlow = guard.buildScopedExecutorCommandFlow({
    smokeRunPacket: multiRouteSmokePacket,
    preferredRoute: "bounded-pnpm-store-delete",
    executionProofHandoff: { status: "waiting-for-execution" },
    nativeCapability: { available: true },
    scanning: false
  });
  assert.strictEqual(selectedPnpmCommandFlow.route, "bounded-pnpm-store-delete", "command flow should honor the user-selected scoped route");
  assert.strictEqual(selectedPnpmCommandFlow.nextAction.targetPanel, "pnpm-store-executor-panel", "selected route should focus the matching executor panel");
  assert.strictEqual(selectedPnpmCommandFlow.routeOptions.length, 2, "command flow should expose route selector options");
  assert.strictEqual(selectedPnpmCommandFlow.routeOptions.filter((row) => row.selected).length, 1, "command flow should select exactly one route option");
  assert.strictEqual(
    selectedPnpmCommandFlow.routeOptions.find((row) => row.selected).route,
    "bounded-pnpm-store-delete",
    "route selector should mark the preferred route"
  );
  const proofRequiredCommandFlow = guard.buildScopedExecutorCommandFlow({
    smokeRunPacket: proofBlockedSmokePacket,
    executionProofHandoff: { status: "proof-required" },
    nativeCapability: { available: true },
    scanning: false
  });
  assert.strictEqual(proofRequiredCommandFlow.status, "proof-required", "command flow should block fresh execution while proof is pending");
  assert.strictEqual(proofRequiredCommandFlow.nextAction.type, "run-post-run-rescan", "proof-required command flow should send the user to post-run rescan");
  const proofCompleteCommandFlow = guard.buildScopedExecutorCommandFlow({
    smokeRunPacket: npmSmokePacket,
    executionProofHandoff: { status: "proof-complete" },
    nativeCapability: { available: true },
    scanning: false
  });
  assert.strictEqual(proofCompleteCommandFlow.status, "proof-complete", "command flow should identify completed post-run proof");
  assert.strictEqual(proofCompleteCommandFlow.nextAction.label, "Review proof", "proof-complete command flow should not lead with another executor run");
  const recordedValidationPack = guard.buildValidationEvidencePack({
    releaseGate: partialEvidenceGate,
    executorPlan,
    executorManifest,
    scanMode: "native-readonly",
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(recordedValidationPack.validationChecks.find((check) => check.id === "windows-native-build").evidenceValue, "passed", "validation pack should export recorded evidence values");
  assert.strictEqual(recordedValidationPack.validationChecks.find((check) => check.id === "windows-native-build").evidenceComplete, true, "validation pack should mark detailed records complete");
  assert.strictEqual(recordedValidationPack.validationChecks.find((check) => check.id === "windows-native-build").reviewer, "qa-operator", "validation pack should export reviewer");
  assert(guard.buildValidationPackMarkdown(recordedValidationPack).includes("- [x] Windows native build"), "validation markdown should check recorded evidence rows");
  const importedValidationPack = guard.buildValidationPackImport({
    evidenceText: [
      "# SpaceGuard Validation Evidence Pack",
      "",
      "```json",
      JSON.stringify({
        schemaVersion: "spaceguard-validation-pack/v1",
        generatedAt: "2026-06-05T00:00:00.000Z",
        validationChecks: [
          {
            id: "windows-native-build",
            status: "passed",
            evidenceValue: "passed",
            evidenceComplete: true,
            reviewer: "qa-operator",
            evidencePath: "evidence/native-build.log",
            notes: "Build passed."
          },
          {
            id: "scanner-fixtures",
            status: "passed",
            evidenceValue: "passed",
            evidenceComplete: false,
            reviewer: "",
            evidencePath: "evidence/fixtures.json"
          },
          {
            id: "rollback-story",
            status: "failed",
            evidenceValue: "failed",
            reviewer: "qa-operator",
            evidencePath: "evidence/rollback-failed.md"
          },
          {
            id: "unknown-check",
            status: "passed",
            reviewer: "qa-operator",
            evidencePath: "evidence/unknown.md"
          }
        ]
      }),
      "```"
    ].join("\n"),
    currentEvidence: {},
    importedAt: "2026-06-05T01:00:00.000Z"
  });
  assert.strictEqual(importedValidationPack.schemaVersion, "spaceguard-validation-pack-import/v1", "validation pack import should expose a schema version");
  assert.strictEqual(importedValidationPack.canApply, true, "validation pack import should accept exported markdown JSON");
  assert.strictEqual(importedValidationPack.counts.importedRows, 3, "validation pack import should map known checks");
  assert.strictEqual(importedValidationPack.counts.ignoredRows, 1, "validation pack import should ignore unknown checks");
  assert.strictEqual(importedValidationPack.counts.complete, 1, "validation pack import should count complete checks");
  assert.strictEqual(importedValidationPack.counts.needsDetail, 1, "validation pack import should preserve detail-needed checks");
  assert.strictEqual(importedValidationPack.counts.failed, 1, "validation pack import should preserve failed checks");
  assert.strictEqual(importedValidationPack.validationEvidence["windows-native-build"].status, "passed", "complete imported validation check should pass");
  assert.strictEqual(importedValidationPack.validationEvidence["scanner-fixtures"].status, "passed", "detail-needed imported validation check should stay marked passed");
  assert.strictEqual(importedValidationPack.validationEvidence["scanner-fixtures"].reviewer, "", "detail-needed imported validation check should still miss reviewer");
  assert.strictEqual(importedValidationPack.validationEvidence["rollback-story"].status, "failed", "failed imported validation check should stay failed");
  const importedValidationGate = guard.buildReleaseGate({
    validationEvidence: importedValidationPack.validationEvidence,
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  assert.strictEqual(importedValidationGate.rows.find((row) => row.id === "windows-native-build").passed, true, "validation pack import should feed complete checks into release gate");
  assert.strictEqual(importedValidationGate.rows.find((row) => row.id === "scanner-fixtures").passed, false, "validation pack import should not pass missing-reviewer checks");
  const rejectedValidationPackImport = guard.buildValidationPackImport({
    evidenceText: JSON.stringify({ schemaVersion: "spaceguard-native-beta-evidence/v1", validationChecks: [] }),
    currentEvidence: { "windows-native-build": { status: "draft" } }
  });
  assert.strictEqual(rejectedValidationPackImport.canApply, false, "validation pack import should reject wrong schemas");
  assert.strictEqual(rejectedValidationPackImport.validationEvidence["windows-native-build"].status, "draft", "rejected validation pack import should preserve current evidence");

  const runRecord = guard.buildLedgerRunRecord({
    planSnapshot: itemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo",
    runtimeCapabilities: {
      realRunEnabled: false,
      destructiveCommands: false
    },
    runReadiness: runReady,
    dryRunLaunchGuard: { ready: true, dryRunAllowed: true, status: "dry-run-launch-ready" },
    createdAt: "2026-06-03T00:00:00.000Z"
  });
  assert.strictEqual(runRecord.schemaVersion, "spaceguard-ledger-run/v1", "run record should have a schema version");
  assert.strictEqual(runRecord.planId, itemPlanSnapshot.id, "run record should keep the plan id");
  assert.strictEqual(runRecord.source, "browser-demo", "demo run records should infer browser demo source");
  assert.strictEqual(runRecord.runKind, "browser-demo", "demo run records should expose browser demo kind");
  assert.strictEqual(runRecord.runLabel, "Browser demo", "demo run records should expose a human run label");
  assert.strictEqual(runRecord.scopedNativeExecution, false, "demo run records should not imply scoped native execution");
  assert.strictEqual(runRecord.entries[0].source, "browser-demo", "run record entries should inherit the run source");
  assert.strictEqual(runRecord.reclaimedBytes, taggedItemLedger[0].bytes, "run record should summarize reclaimed bytes");
  assert.strictEqual(runRecord.realRunEnabled, false, "run record must not imply real execution");
  assert.strictEqual(runRecord.launchGuardReady, true, "run record should capture launch guard readiness");
  assert.strictEqual(runRecord.safety.dryRunOnly, true, "demo run records should remain dry-run-only evidence");
  assert.strictEqual(runRecord.safety.dryRunLaunchGuard, "dry-run-launch-ready", "run record should persist launch guard status");
  assert.strictEqual(runRecord.planSnapshot.id, itemPlanSnapshot.id, "run record should persist the executed plan snapshot");
  assert.strictEqual(runRecord.planSnapshot.rows.length, itemPlanSnapshot.rows.length, "run record should persist compact selected rows");
  assert.strictEqual(runRecord.executorPlan.rows.length, itemExecutorPlan.rows.length, "run record should persist compact executor rows");
  assert.strictEqual(runRecord.executorPlan.rows[0].route, itemExecutorPlan.rows[0].route, "run record should preserve executor route evidence");
  const appendedHistory = guard.appendLedgerRunRecord([], runRecord);
  const dedupedHistory = guard.appendLedgerRunRecord(appendedHistory, runRecord);
  assert.strictEqual(appendedHistory.length, 1, "run history should append valid records");
  assert.strictEqual(dedupedHistory.length, 1, "run history should not duplicate the same record id");
  const currentHistorySummary = guard.buildLedgerHistorySummary(appendedHistory, itemPlanSnapshot);
  const staleHistorySummary = guard.buildLedgerHistorySummary(appendedHistory, changedItemPlanSnapshot);
  assert.strictEqual(currentHistorySummary.hasCurrentPlanRecord, true, "history should identify records for the current plan");
  assert.strictEqual(currentHistorySummary.currentLedger.length, taggedItemLedger.length, "history should expose current plan ledger entries");
  assert.strictEqual(currentHistorySummary.currentPlanSnapshot.id, itemPlanSnapshot.id, "history should expose the stored plan snapshot for reload verification");
  assert.strictEqual(currentHistorySummary.currentExecutorPlan.rows.length, itemExecutorPlan.rows.length, "history should expose stored executor rows for reload verification");
  assert.strictEqual(staleHistorySummary.hasCurrentPlanRecord, false, "changed plans should make previous records stale");
  assert.strictEqual(staleHistorySummary.counts.stale, 1, "stale history count should include old plan records");
  const historyMarkdown = guard.buildLedgerHistoryMarkdown(currentHistorySummary);
  assert(historyMarkdown.includes("SpaceGuard Local Run History"), "history markdown should have a title");
  assert(historyMarkdown.includes(itemPlanSnapshot.id), "history markdown should include plan ids");
  assert(historyMarkdown.includes("Browser demo"), "history markdown should label demo run records");

  const scopedSource = "native-downloads-recycle-bin-executor";
  const scopedItemLedger = taggedItemLedger.map((entry) => ({ ...entry, source: scopedSource }));
  const scopedRunRecord = guard.buildLedgerRunRecord({
    planSnapshot: itemPlanSnapshot,
    ledger: scopedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "native-readonly",
    runtimeCapabilities: {
      realRunEnabled: true,
      destructiveCommands: false
    },
    runReadiness: runReady,
    dryRunLaunchGuard: { ready: true, dryRunAllowed: true, status: "dry-run-launch-ready" },
    source: scopedSource,
    createdAt: "2026-06-03T00:05:00.000Z"
  });
  assert.strictEqual(scopedRunRecord.source, scopedSource, "scoped executor run records should preserve native source");
  assert.strictEqual(scopedRunRecord.runKind, "scoped-native-execution", "scoped executor records should expose execution kind");
  assert.strictEqual(scopedRunRecord.runLabel, "Scoped native execution", "scoped executor records should expose a human run label");
  assert.strictEqual(scopedRunRecord.scopedNativeExecution, true, "scoped executor records should be flagged");
  assert.strictEqual(scopedRunRecord.entries[0].source, scopedSource, "scoped executor entries should preserve source");
  assert.strictEqual(scopedRunRecord.safety.dryRunOnly, false, "scoped executor records should not be labeled dry-run-only");
  const mixedHistorySummary = guard.buildLedgerHistorySummary([runRecord, scopedRunRecord], itemPlanSnapshot);
  assert.strictEqual(mixedHistorySummary.counts.dryRun, 1, "history should count preview records separately");
  assert.strictEqual(mixedHistorySummary.counts.scopedNativeExecution, 1, "history should count scoped executor records separately");
  assert.strictEqual(mixedHistorySummary.counts.currentScopedNativeExecution, 1, "history should count current scoped executor records");
  assert.strictEqual(mixedHistorySummary.scopedNativeExecutionBytes, scopedRunRecord.reclaimedBytes, "history should summarize scoped executor bytes");
  const mixedHistoryMarkdown = guard.buildLedgerHistoryMarkdown(mixedHistorySummary);
  assert(mixedHistoryMarkdown.includes("Scoped native execution"), "history markdown should label scoped executor records");
  assert(mixedHistoryMarkdown.includes("Scoped native execution bytes"), "history markdown should separate scoped executor bytes");
  const scopedPostRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: itemPlanSnapshot,
    ledger: scopedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "native-readonly"
  });
  assert.strictEqual(scopedPostRunVerification.scopedNativeExecution, true, "post-run verification should preserve scoped executor source");
  assert.strictEqual(scopedPostRunVerification.runKind, "scoped-native-execution", "post-run verification should expose scoped executor kind");
  assert(scopedPostRunVerification.steps.join(" ").includes("scoped execution"), "scoped post-run verification should request post-execution rescan");
  const scopedPostRunMarkdown = guard.buildPostRunVerificationMarkdown(scopedPostRunVerification);
  assert(scopedPostRunMarkdown.includes("Run type: Scoped native execution"), "post-run markdown should include run type");
  const scopedRescanComparison = guard.buildRescanComparison({
    postRunVerification: scopedPostRunVerification,
    ledger: scopedItemLedger,
    scanMode: "native-readonly"
  });
  assert.strictEqual(scopedRescanComparison.scopedNativeExecution, true, "rescan comparison should preserve scoped executor source");
  assert.strictEqual(scopedRescanComparison.runLabel, "Scoped native execution", "rescan comparison should expose scoped executor label");
  assert(guard.buildRescanComparisonMarkdown(scopedRescanComparison).includes("Run type: Scoped native execution"), "rescan markdown should include scoped run type");
  const localEvidenceBackup = guard.buildLocalEvidenceBackup({
    validationEvidence: { "windows-native-build": { status: "passed", reviewer: "qa", evidencePath: "evidence/native.log" } },
    rollbackEvidence: { "windows-temp": { status: "proved", reviewer: "qa", evidencePath: "evidence/rollback.md", restoreLocation: "rescan parity" } },
    manualStrategyEvidence: { "archive-large-files:backup": "done" },
    customRootTriageEvidence: { "custom-root-1": { disposition: "archive", owner: "qa", notes: "Move to D drive." } },
    nativeBetaEvidence: { supportRunbook: { status: "passed", reviewer: "qa", evidencePath: "evidence/support.md" } },
    runHistory: appendedHistory,
    generatedAt: "2026-06-05T00:00:00.000Z"
  });
  assert.strictEqual(localEvidenceBackup.schemaVersion, "spaceguard-local-evidence-backup/v1", "local evidence backup should expose a schema version");
  assert.strictEqual(localEvidenceBackup.realCleanupEnabled, false, "local evidence backup must not restore cleanup authority");
  assert(localEvidenceBackup.excludedState.includes("executionConsent"), "local evidence backup should exclude consent state");
  assert.strictEqual(localEvidenceBackup.counts.evidenceRows, 5, "local evidence backup should count evidence rows across ledgers");
  assert.strictEqual(localEvidenceBackup.counts.runHistory, 1, "local evidence backup should include valid run history records");
  const localEvidenceBackupMarkdown = guard.buildLocalEvidenceBackupMarkdown(localEvidenceBackup);
  assert(localEvidenceBackupMarkdown.includes("SpaceGuard Local Evidence Backup"), "local evidence backup markdown should have a title");
  assert(localEvidenceBackupMarkdown.includes("executionConsent"), "local evidence backup markdown should list excluded consent state");
  const localEvidenceBackupImport = guard.buildLocalEvidenceBackupImport({
    evidenceText: [
      "# SpaceGuard Local Evidence Backup",
      "",
      "```json",
      JSON.stringify(localEvidenceBackup),
      "```"
    ].join("\n"),
    currentEvidence: {
      validationEvidence: { "scanner-fixtures": { status: "draft" } },
      rollbackEvidence: {},
      manualStrategyEvidence: {},
      customRootTriageEvidence: {},
      nativeBetaEvidence: {}
    },
    currentRunHistory: appendedHistory,
    importedAt: "2026-06-05T01:00:00.000Z"
  });
  assert.strictEqual(localEvidenceBackupImport.schemaVersion, "spaceguard-local-evidence-backup-import/v1", "local evidence backup import should expose a schema version");
  assert.strictEqual(localEvidenceBackupImport.canApply, true, "local evidence backup import should accept exported markdown JSON");
  assert.strictEqual(localEvidenceBackupImport.evidence.validationEvidence["windows-native-build"].status, "passed", "local backup import should restore validation evidence");
  assert.strictEqual(localEvidenceBackupImport.evidence.validationEvidence["scanner-fixtures"].status, "draft", "local backup import should preserve current evidence rows");
  assert.strictEqual(localEvidenceBackupImport.evidence.rollbackEvidence["windows-temp"].status, "proved", "local backup import should restore rollback evidence");
  assert.strictEqual(localEvidenceBackupImport.counts.importedEvidenceRows, 5, "local backup import should count imported evidence rows");
  assert.strictEqual(localEvidenceBackupImport.counts.importedRunHistory, 1, "local backup import should count valid imported history records");
  assert.strictEqual(localEvidenceBackupImport.runHistory.length, 1, "local backup import should dedupe existing run history");
  const rejectedLocalEvidenceBackupImport = guard.buildLocalEvidenceBackupImport({
    evidenceText: JSON.stringify({ schemaVersion: "spaceguard-validation-pack/v1" }),
    currentEvidence: { validationEvidence: { "windows-native-build": { status: "draft" } } },
    currentRunHistory: appendedHistory
  });
  assert.strictEqual(rejectedLocalEvidenceBackupImport.canApply, false, "local evidence backup import should reject wrong schemas");
  assert.strictEqual(rejectedLocalEvidenceBackupImport.evidence.validationEvidence["windows-native-build"].status, "draft", "rejected local backup import should preserve current evidence");

  const passedEvidence = makePassedEvidence(guard.windowsValidationChecks.map((check) => check.id));
  const enabledGate = guard.buildReleaseGate({
    featureFlags: { realExecutors: true },
    validationEvidence: passedEvidence,
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  assert.strictEqual(enabledGate.readyForRealRun, true, "release gate should only open with flag, native evidence, validations, and candidate routes");
  const currentBuildWriteReadiness = guard.buildWriteReadiness({
    releaseGate: enabledGate,
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true },
    executorPlan,
    rollbackPlan: tempRollbackPlan,
    rescanComparison: matchedComparison,
    privilegeBoundary: guard.buildPrivilegeBoundary({
      runtimeCapabilities: { available: true, elevated: true, realRunEnabled: true },
      executorPlan
    }),
    privacyBoundary: guard.buildPrivacyBoundary({
      scanMode: "native-readonly",
      runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
    }),
    consentReceipt: armedConsent,
    runReadiness: runReady
  });
  assert.strictEqual(currentBuildWriteReadiness.schemaVersion, "spaceguard-write-readiness/v1", "write readiness should have a schema version");
  assert.strictEqual(currentBuildWriteReadiness.readyForRealExecution, false, "write readiness must stay locked when no real executor is implemented");
  assert.strictEqual(currentBuildWriteReadiness.status, "implementation-locked", "current build should be implementation locked");
  assert(currentBuildWriteReadiness.items.some((item) => item.id === "real-route-implementation" && !item.passed), "write readiness should require real route implementation");
  const currentBuildExecutorCapsule = guard.buildRealExecutorCapsule({
    executorManifest,
    executorPlan,
    releaseGate: enabledGate,
    writeReadiness: currentBuildWriteReadiness,
    rollbackPlan: tempRollbackPlan,
    rescanComparison: matchedComparison,
    privilegeBoundary: guard.buildPrivilegeBoundary({
      runtimeCapabilities: { available: true, elevated: true, realRunEnabled: true },
      executorPlan
    }),
    privacyBoundary: guard.buildPrivacyBoundary({
      scanMode: "native-readonly",
      runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
    }),
    runtimeCapabilities: { executeCleanupPlan: true }
  });
  assert.strictEqual(currentBuildExecutorCapsule.schemaVersion, "spaceguard-real-executor-capsule/v1", "real executor capsule should have a schema version");
  assert.strictEqual(currentBuildExecutorCapsule.destructiveActionAvailable, false, "executor capsule must not expose destructive execution");
  assert.strictEqual(currentBuildExecutorCapsule.codePath.status, "rejecting-stub", "capsule should detect the native rejecting write stub");
  assert.strictEqual(currentBuildExecutorCapsule.route.id, "known-temp-delete", "capsule should select the first-safe temp route from the selected plan");
  assert(currentBuildExecutorCapsule.blockers.some((blocker) => blocker.id === "implementation-missing"), "capsule should block on missing write implementation");
  const firstSafeContract = guard.buildFirstSafeExecutorContract({
    realExecutorCapsule: currentBuildExecutorCapsule,
    executorPlan,
    planSnapshot: cleanRunSnapshot,
    scanSession: currentScanSession,
    consentReceipt: armedConsent,
    releaseGate: enabledGate,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(firstSafeContract.schemaVersion, "spaceguard-first-safe-executor-contract/v1", "first-safe executor contract should expose a schema version");
  assert.strictEqual(firstSafeContract.status, "disabled-contract-ready", "first-safe contract should be ready only for rejecting-boundary validation");
  assert.strictEqual(firstSafeContract.route.id, "known-temp-delete", "first-safe contract should use the capsule route");
  assert.strictEqual(firstSafeContract.requestPreview.command, "execute_cleanup_plan", "first-safe contract should name the native write boundary command");
  assert.strictEqual(firstSafeContract.requestPreview.mode, "reject-only-preview", "first-safe request should be reject-only in the current build");
  assert.strictEqual(firstSafeContract.requestPreview.planId, cleanRunSnapshot.id, "first-safe request should include the current plan id");
  assert(firstSafeContract.requestPreview.actions[0].targetPath.includes("Temp"), "first-safe request should include selected target path evidence");
  assert.strictEqual(firstSafeContract.realRunEnabled, false, "first-safe contract must not enable real execution");
  assert.strictEqual(firstSafeContract.destructiveActionAvailable, false, "first-safe contract must not expose destructive execution");
  assert(firstSafeContract.route.forbiddenTargets.includes("Downloads"), "temp contract should explicitly forbid user Downloads");
  assert.strictEqual(firstSafeContract.targetAudit.ready, true, "temp first-safe contract should audit selected target paths");
  assert.strictEqual(firstSafeContract.targetAudit.rows[0].status, "allowed", "windows temp row should match the temp allowlist");
  assert(firstSafeContract.targetAudit.rows[0].allowedRule.includes("Temp"), "target audit should name the matching temp rule");
  const blockedFirstSafeValidationGate = guard.buildFirstSafeValidationGate({
    executorManifest,
    validationPack,
    releaseGate,
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    runtimeCapabilities: { available: false, realRunEnabled: false, destructiveCommands: false, safeExecutorsEnabled: false }
  });
  assert.strictEqual(blockedFirstSafeValidationGate.schemaVersion, "spaceguard-first-safe-validation-gate/v1", "first-safe validation gate should expose a schema version");
  assert.strictEqual(blockedFirstSafeValidationGate.status, "validation-blocked", "missing Windows validation evidence should block first-safe implementation planning");
  assert.strictEqual(blockedFirstSafeValidationGate.realRunAllowed, false, "first-safe validation gate must not allow real cleanup");
  assert.strictEqual(blockedFirstSafeValidationGate.destructiveActionAvailable, false, "first-safe validation gate must not expose destructive actions");
  assert(blockedFirstSafeValidationGate.rows.some((row) => row.id === "temp-locked-files" && !row.passed), "temp route should show locked-file evidence as missing");
  const completedFirstSafeExecutorManifest = guard.buildExecutorManifest({
    actionList: developerActions,
    executorPlan,
    releaseGate: enabledGate
  });
  const completedFirstSafeValidationPack = guard.buildValidationEvidencePack({
    releaseGate: enabledGate,
    executorPlan,
    executorManifest: completedFirstSafeExecutorManifest,
    scanMode: "native-readonly",
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false, safeExecutorsEnabled: false }
  });
  const readyFirstSafeValidationGate = guard.buildFirstSafeValidationGate({
    executorManifest: completedFirstSafeExecutorManifest,
    validationPack: completedFirstSafeValidationPack,
    releaseGate: enabledGate,
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false, safeExecutorsEnabled: false }
  });
  assert.strictEqual(readyFirstSafeValidationGate.status, "implementation-planning-ready", "completed route evidence should make first-safe implementation planning ready");
  assert.strictEqual(readyFirstSafeValidationGate.counts.missingChecks, 0, "ready first-safe validation gate should have no missing route checks");
  assert.strictEqual(readyFirstSafeValidationGate.realRunAllowed, false, "ready validation gate still must not allow real execution");
  const blockedFirstSafeWorkOrder = guard.buildFirstSafeImplementationWorkOrder({
    firstSafeValidationGate: blockedFirstSafeValidationGate,
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    runtimeCapabilities: { available: false, realRunEnabled: false, destructiveCommands: false, safeExecutorsEnabled: false }
  });
  assert.strictEqual(blockedFirstSafeWorkOrder.schemaVersion, "spaceguard-first-safe-work-order/v1", "first-safe work order should expose a schema version");
  assert.strictEqual(blockedFirstSafeWorkOrder.status, "validation-blocked", "missing route evidence should block the implementation work order");
  assert.strictEqual(blockedFirstSafeWorkOrder.realRunAllowed, false, "blocked work order must not allow real cleanup");
  assert(blockedFirstSafeWorkOrder.workItems.some((item) => item.id === "validation-evidence" && item.status === "blocked"), "blocked work order should surface validation evidence blockers");
  const readyFirstSafeWorkOrder = guard.buildFirstSafeImplementationWorkOrder({
    firstSafeValidationGate: readyFirstSafeValidationGate,
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    writeBoundaryProbe: { status: "rejected", rejectionEvidence: true, counts: { bytes: 0 } },
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false, safeExecutorsEnabled: false }
  });
  assert.strictEqual(readyFirstSafeWorkOrder.status, "implementation-work-order-ready", "ready validation gate should produce an implementation work order");
  assert.strictEqual(readyFirstSafeWorkOrder.implementationWorkAllowed, true, "ready work order should allow implementation planning");
  assert.strictEqual(readyFirstSafeWorkOrder.realRunAllowed, false, "ready work order still must not allow real execution");
  assert.strictEqual(readyFirstSafeWorkOrder.destructiveActionAvailable, false, "ready work order must keep destructive actions hidden");
  assert(readyFirstSafeWorkOrder.route.implementation.includes("allowlisted temp roots"), "work order should carry the route implementation boundary");
  assert(readyFirstSafeWorkOrder.workItems.some((item) => item.id === "native-executor" && item.status === "ready-to-build"), "ready work order should include the native executor build item");
  assert(readyFirstSafeWorkOrder.acceptanceTests.some((test) => test.id === "target-allowlist"), "work order should include target allowlist acceptance tests");
  const unsafeFirstSafeValidationGate = guard.buildFirstSafeValidationGate({
    executorManifest: completedFirstSafeExecutorManifest,
    validationPack: completedFirstSafeValidationPack,
    releaseGate: enabledGate,
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true, safeExecutorsEnabled: true }
  });
  assert.strictEqual(unsafeFirstSafeValidationGate.status, "unsafe-runtime", "runtime write flags should stop first-safe implementation planning");
  assert(unsafeFirstSafeValidationGate.blockers.some((blocker) => blocker.id === "runtime-write-capability"), "unsafe runtime should be listed as a blocker");
  const unsafeFirstSafeWorkOrder = guard.buildFirstSafeImplementationWorkOrder({
    firstSafeValidationGate: readyFirstSafeValidationGate,
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true, safeExecutorsEnabled: true }
  });
  assert.strictEqual(unsafeFirstSafeWorkOrder.status, "unsafe-runtime", "unsafe runtime should stop the first-safe implementation work order");
  assert(unsafeFirstSafeWorkOrder.workItems.every((item) => item.status !== "ready-to-build"), "unsafe work order must not expose ready-to-build items");
  const forgedCapsule = {
    ...currentBuildExecutorCapsule,
    selectedRows: [
      {
        ...currentBuildExecutorCapsule.selectedRows[0],
        path: "C:\\Users\\demo\\Downloads"
      }
    ]
  };
  const forgedTargetContract = guard.buildFirstSafeExecutorContract({
    realExecutorCapsule: forgedCapsule,
    executorPlan,
    planSnapshot: cleanRunSnapshot,
    scanSession: currentScanSession,
    consentReceipt: armedConsent,
    releaseGate: enabledGate,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(forgedTargetContract.status, "contract-incomplete", "forbidden target paths should block the first-safe contract");
  assert.strictEqual(forgedTargetContract.targetAudit.ready, false, "forbidden target audit should not be ready");
  assert.strictEqual(forgedTargetContract.targetAudit.rows[0].reason, "forbidden-target", "target audit should explain forbidden target hits");
  const violatedFirstSafeContract = guard.buildFirstSafeExecutorContract({
    realExecutorCapsule: currentBuildExecutorCapsule,
    executorPlan,
    planSnapshot: cleanRunSnapshot,
    scanSession: currentScanSession,
    consentReceipt: armedConsent,
    releaseGate: enabledGate,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(violatedFirstSafeContract.status, "disabled-contract-violated", "first-safe contract should flag runtime write capability as a violation");
  const defaultWriteBoundaryProbe = guard.buildWriteBoundaryProbe({
    realExecutorCapsule: currentBuildExecutorCapsule,
    runtimeCapabilities: { available: true, executeCleanupPlan: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(defaultWriteBoundaryProbe.schemaVersion, "spaceguard-write-boundary-probe/v1", "write boundary probe should expose a schema version");
  assert.strictEqual(defaultWriteBoundaryProbe.status, "not-run", "write boundary probe should default to not-run");
  assert.strictEqual(defaultWriteBoundaryProbe.rejectionEvidence, false, "not-run write boundary probe is not rejection evidence");
  const unavailableWriteBoundaryProbe = guard.buildWriteBoundaryProbe({
    nativeWriteBoundary: {
      status: "complete",
      result: { available: false, accepted: false, realRunEnabled: false, destructiveCommands: false, entries: [], warnings: ["browser"] }
    },
    realExecutorCapsule: currentBuildExecutorCapsule,
    runtimeCapabilities: { available: false, executeCleanupPlan: false, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(unavailableWriteBoundaryProbe.status, "native-unavailable", "browser runtime should not count as write-boundary evidence");
  assert.strictEqual(unavailableWriteBoundaryProbe.counts.bytes, 0, "unavailable probe must report zero reclaimed bytes");
  const rejectedWriteBoundaryProbe = guard.buildWriteBoundaryProbe({
    nativeWriteBoundary: {
      status: "complete",
      result: {
        available: true,
        accepted: false,
        realRunEnabled: false,
        destructiveCommands: false,
        reason: "disabled",
        contractEcho: {
          schemaVersion: firstSafeContract.schemaVersion,
          requestMode: firstSafeContract.requestPreview.mode,
          planId: firstSafeContract.requestPreview.planId,
          route: firstSafeContract.requestPreview.route,
          scanFingerprint: firstSafeContract.requestPreview.scanFingerprint,
          consentPlanId: firstSafeContract.requestPreview.consentPlanId,
          expectedBytes: firstSafeContract.requestPreview.expectedBytes,
          dryRunOnly: true,
          mutationAttempted: false,
          actionCount: firstSafeContract.requestPreview.actionCount
        },
        executorScaffold: {
          route: "known-temp-delete",
          title: "Known temp roots",
          featureFlag: "tempCleanupExecutor",
          status: "feature-flag-disabled",
          validationStatus: "validation-required",
          mutationEnabled: false,
          reason: "Temp cleanup executor scaffold is present but disabled."
        },
        entries: [
          {
            id: "windows-temp",
            title: "Windows temporary files",
            route: "known-temp-delete",
            result: "rejected",
            rejectCode: "real-executor-disabled",
            bytes: 0,
            preflightStatus: "executor-disabled-after-preflight",
            preflightChecks: [
              { id: "target-allowlist", label: "Target allowlist", status: "passed", detail: "Allowed temp root." },
              { id: "feature-flag", label: "Feature flag", status: "blocked", detail: "tempCleanupExecutor disabled." }
            ],
            note: "blocked by runtime"
          }
        ],
        warnings: ["no mutation"]
      }
    },
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    runtimeCapabilities: { available: true, executeCleanupPlan: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(rejectedWriteBoundaryProbe.status, "rejected", "zero-byte rejected native result should pass as rejection evidence");
  assert.strictEqual(rejectedWriteBoundaryProbe.rejectionEvidence, true, "rejected native result should be evidence");
  assert.strictEqual(rejectedWriteBoundaryProbe.contractMatch, true, "rejected native result should match the first-safe contract echo");
  assert.strictEqual(rejectedWriteBoundaryProbe.executorScaffold.featureFlag, "tempCleanupExecutor", "rejected probe should preserve disabled temp scaffold feature flag");
  assert.strictEqual(rejectedWriteBoundaryProbe.executorScaffold.mutationEnabled, false, "rejected probe scaffold must keep mutation disabled");
  assert.strictEqual(rejectedWriteBoundaryProbe.entries[0].preflightStatus, "executor-disabled-after-preflight", "rejected probe should preserve native preflight status");
  assert.strictEqual(rejectedWriteBoundaryProbe.counts.preflightBlocked, 1, "rejected probe should count blocked preflight checks");
  assert.strictEqual(rejectedWriteBoundaryProbe.counts.rejected, 1, "rejected probe should count rejected entries");
  assert.strictEqual(rejectedWriteBoundaryProbe.entries[0].rejectCode, "real-executor-disabled", "rejected probe should preserve native reject codes");
  assert.strictEqual(rejectedWriteBoundaryProbe.counts.bytes, 0, "rejected probe must not reclaim bytes");
  const missingPreflightActivationGate = guard.buildTempExecutorActivationGate({
    runtimeCapabilities: {
      available: true,
      executeCleanupPlan: true,
      realRunEnabled: false,
      destructiveCommands: false,
      safeExecutorsEnabled: false,
      executorFlags: { tempCleanupExecutor: false }
    },
    firstSafeValidationGate: blockedFirstSafeValidationGate,
    firstSafeImplementationWorkOrder: blockedFirstSafeWorkOrder,
    writeBoundaryProbe: defaultWriteBoundaryProbe,
    releaseGate: enabledGate,
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule
  });
  assert.strictEqual(missingPreflightActivationGate.schemaVersion, "spaceguard-temp-executor-activation-gate/v1", "temp activation gate should expose a schema version");
  assert.strictEqual(missingPreflightActivationGate.status, "preflight-missing", "temp activation should require native scaffold and preflight evidence");
  assert.strictEqual(missingPreflightActivationGate.realRunAllowed, false, "missing-preflight activation gate must not allow real cleanup");
  assert.strictEqual(missingPreflightActivationGate.mutationEnabled, false, "missing-preflight activation gate must keep mutation locked");
  assert(missingPreflightActivationGate.blockers.some((blocker) => blocker.id === "preflight-evidence"), "missing-preflight activation gate should name the missing preflight blocker");
  const disabledFlagActivationGate = guard.buildTempExecutorActivationGate({
    runtimeCapabilities: {
      available: true,
      executeCleanupPlan: true,
      realRunEnabled: false,
      destructiveCommands: false,
      safeExecutorsEnabled: false,
      executorFlags: { tempCleanupExecutor: false }
    },
    firstSafeValidationGate: readyFirstSafeValidationGate,
    firstSafeImplementationWorkOrder: readyFirstSafeWorkOrder,
    writeBoundaryProbe: rejectedWriteBoundaryProbe,
    releaseGate: enabledGate,
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule
  });
  assert.strictEqual(disabledFlagActivationGate.status, "feature-flag-disabled", "disabled temp flag should be the blocker after native preflight evidence exists");
  assert.strictEqual(disabledFlagActivationGate.featureFlag.enabled, false, "temp activation should surface the disabled route flag");
  assert.strictEqual(disabledFlagActivationGate.scaffold.present, true, "temp activation should see the disabled native scaffold");
  assert.strictEqual(disabledFlagActivationGate.scaffold.mutationEnabled, false, "temp activation scaffold must remain non-mutating");
  assert.strictEqual(disabledFlagActivationGate.preflight.blocked, 1, "temp activation should preserve blocked native preflight count");
  assert.strictEqual(disabledFlagActivationGate.activationAllowed, false, "disabled temp activation must not allow activation");
  assert(disabledFlagActivationGate.blockers.some((blocker) => blocker.id === "feature-flag"), "disabled temp activation should name the feature flag blocker");
  const activationQuestionQueue = guard.buildAgentQuestionQueue({
    scanned: true,
    scanning: false,
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    runtimeCapabilities: { available: true, executeCleanupPlan: true, realRunEnabled: false, destructiveCommands: false },
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    approvals: { groupConfirm: true, reviewed: {}, reviewItems: {}, typed: {} },
    readiness: { ready: true, unresolved: [] },
    writeBoundaryProbe: rejectedWriteBoundaryProbe,
    tempExecutorActivationGate: disabledFlagActivationGate,
    intakePolicy: intakeAllowedPolicy
  });
  assert(activationQuestionQueue.questions.some((question) => question.id === "review-temp-activation" && question.targetPanel === "temp-executor-activation-gate-panel"), "question queue should focus the temp activation gate after preflight evidence exists");
  const tempActivationRehearsal = guard.buildTempExecutorActivationRehearsal({
    runtimeCapabilities: {
      available: false,
      realRunEnabled: false,
      destructiveCommands: false,
      safeExecutorsEnabled: false,
      executorFlags: { tempCleanupExecutor: false }
    },
    firstSafeExecutorContract: firstSafeContract,
    firstSafeValidationGate: blockedFirstSafeValidationGate,
    firstSafeImplementationWorkOrder: blockedFirstSafeWorkOrder,
    releaseGate: enabledGate,
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule
  });
  assert.strictEqual(tempActivationRehearsal.schemaVersion, "spaceguard-temp-activation-rehearsal/v1", "temp activation rehearsal should expose a schema version");
  assert.strictEqual(tempActivationRehearsal.status, "rehearsal-ready", "demo rehearsal should synthesize rejected temp activation evidence");
  assert.strictEqual(tempActivationRehearsal.demoOnly, true, "temp activation rehearsal must be demo-only");
  assert.strictEqual(tempActivationRehearsal.activationGate.status, "feature-flag-disabled", "temp activation rehearsal should stop at disabled feature flag");
  assert.strictEqual(tempActivationRehearsal.syntheticWriteBoundaryProbe.rejectionEvidence, true, "temp activation rehearsal should build rejected write-boundary evidence");
  assert.strictEqual(tempActivationRehearsal.syntheticWriteBoundaryProbe.counts.bytes, 0, "temp activation rehearsal must report zero bytes");
  assert.strictEqual(tempActivationRehearsal.mutationAttempted, false, "temp activation rehearsal must not attempt mutation");
  assert.strictEqual(tempActivationRehearsal.mutationEnabled, false, "temp activation rehearsal must keep mutation disabled");
  assert(tempActivationRehearsal.syntheticWriteBoundaryProbe.counts.preflightChecks > 0, "temp activation rehearsal should include preflight checks");
  const demoLaunchRoadmap = guard.buildRealDataLaunchRoadmap({
    scanMode: "demo",
    scanSession: { status: "demo-current", readyForPlanning: true },
    demoRehearsalRunbook: {
      status: "demo-evidence-ready",
      evidenceComplete: true,
      safeForPublicDemo: true,
      primary: "Demo evidence is complete."
    },
    windowsSetupAssistant: { status: "browser-demo", nativeAvailable: false, privacyReady: true },
    validationPack: { schemaVersion: "spaceguard-validation-pack/v1", readyForRealRun: false, blockedReason: "Validation evidence missing." },
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeValidationGate: blockedFirstSafeValidationGate,
    firstSafeImplementationWorkOrder: blockedFirstSafeWorkOrder,
    tempExecutorActivationGate: missingPreflightActivationGate,
    tempExecutorActivationRehearsal: tempActivationRehearsal,
    writeBoundaryProbe: defaultWriteBoundaryProbe,
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false, safeExecutorsEnabled: false }
  });
  assert.strictEqual(demoLaunchRoadmap.schemaVersion, "spaceguard-real-data-launch-roadmap/v1", "real data launch roadmap should expose a schema version");
  assert.strictEqual(demoLaunchRoadmap.status, "demo-ready", "demo roadmap should stop at the no-real-data milestone");
  assert.strictEqual(demoLaunchRoadmap.realCleanupLocked, true, "demo roadmap must keep real cleanup locked");
  assert.strictEqual(demoLaunchRoadmap.counts.realRun, 0, "demo roadmap must not expose real-run rows");
  assert(demoLaunchRoadmap.rows.some((row) => row.id === "native-readonly-scan" && row.nextStep.includes("native read-only scan")), "demo roadmap should point toward native read-only evidence next");
  const nativeLaunchRoadmap = guard.buildRealDataLaunchRoadmap({
    scanMode: "native-readonly",
    scanSession: { status: "native-current", readyForPlanning: true, nativeEvidence: true },
    scanCoverage: { confidenceScore: 82 },
    nativeEvidenceQuality: {
      schemaVersion: "spaceguard-native-evidence-quality/v1",
      status: "planning-grade-partial",
      planningReady: true,
      primary: "Native evidence is planning-grade with partial coverage.",
      steps: ["Use measured native rows only for planning."],
      counts: { realRun: 0 }
    },
    windowsSetupAssistant: { status: "native-scan-ready", nativeAvailable: true, privacyReady: true },
    validationPack: { schemaVersion: "spaceguard-validation-pack/v1", readyForRealRun: false, blockedReason: "Validation evidence missing." },
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeValidationGate: blockedFirstSafeValidationGate,
    firstSafeImplementationWorkOrder: blockedFirstSafeWorkOrder,
    tempExecutorActivationGate: missingPreflightActivationGate,
    tempExecutorActivationRehearsal: tempActivationRehearsal,
    writeBoundaryProbe: defaultWriteBoundaryProbe,
    runtimeCapabilities: { available: true, scanKnownRoots: true, realRunEnabled: false, destructiveCommands: false, safeExecutorsEnabled: false }
  });
  assert.strictEqual(nativeLaunchRoadmap.status, "native-readonly-ready", "native roadmap should recognize current read-only scan evidence");
  assert.strictEqual(nativeLaunchRoadmap.nativeScanCurrent, true, "native roadmap should surface current native scan evidence");
  assert.strictEqual(nativeLaunchRoadmap.nativePlanningReady, true, "native roadmap should consume the native evidence quality gate");
  assert.strictEqual(nativeLaunchRoadmap.nativeQualityStatus, "planning-grade-partial", "native roadmap should expose quality status");
  assert.strictEqual(nativeLaunchRoadmap.realCleanupLocked, true, "native roadmap must keep real cleanup locked");
  const scopedLaunchRoadmap = guard.buildRealDataLaunchRoadmap({
    scanMode: "native-readonly",
    scanSession: { status: "native-current", readyForPlanning: true, nativeEvidence: true },
    runtimeCapabilities: {
      available: true,
      scanKnownRoots: true,
      realRunEnabled: true,
      destructiveCommands: true,
      safeExecutorsEnabled: true,
      executorFlags: { downloadsCleanupExecutor: true, browserCacheExecutor: true }
    }
  });
  assert.strictEqual(scopedLaunchRoadmap.status, "scoped-real-cleanup-ready", "roadmap should recognize scoped real executor flags");
  assert.strictEqual(scopedLaunchRoadmap.realCleanupLocked, false, "roadmap should not call scoped real executors locked");
  assert.strictEqual(scopedLaunchRoadmap.broadCleanupLocked, true, "roadmap should keep broad cleanup locked");
  assert.deepStrictEqual(
    scopedLaunchRoadmap.scopedRealExecutorRoutes,
    ["item-review-recycle-bin", "browser-cache-only"],
    "roadmap should list enabled scoped executor routes"
  );
  assert.strictEqual(scopedLaunchRoadmap.counts.realRun, 1, "roadmap should count scoped real-run availability");
  const incompleteQualityRoadmap = guard.buildRealDataLaunchRoadmap({
    scanMode: "native-readonly",
    scanSession: { status: "native-current", readyForPlanning: true, nativeEvidence: true },
    nativeEvidenceQuality: {
      schemaVersion: "spaceguard-native-evidence-quality/v1",
      status: "native-evidence-incomplete",
      planningReady: false,
      primary: "Native evidence is incomplete.",
      steps: ["Capture top-level drive inventory."],
      counts: { realRun: 0 }
    },
    windowsSetupAssistant: { status: "native-scan-ready", nativeAvailable: true, privacyReady: true },
    runtimeCapabilities: { available: true, scanKnownRoots: true, realRunEnabled: false, destructiveCommands: false, safeExecutorsEnabled: false }
  });
  assert.notStrictEqual(incompleteQualityRoadmap.status, "native-readonly-ready", "roadmap must not call native read-only ready when quality gate is incomplete");
  assert.strictEqual(incompleteQualityRoadmap.rows.find((row) => row.id === "native-readonly-scan").status, "partial", "current scan with incomplete quality should stay partial");
  const unsafeLaunchRoadmap = guard.buildRealDataLaunchRoadmap({
    scanMode: "native-readonly",
    scanSession: { status: "native-current", readyForPlanning: true, nativeEvidence: true },
    tempExecutorActivationRehearsal: tempActivationRehearsal,
    runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true, safeExecutorsEnabled: true }
  });
  assert.strictEqual(unsafeLaunchRoadmap.status, "unsafe-stop", "roadmap should stop on runtime write signals");
  assert(unsafeLaunchRoadmap.unsafeRows.length > 0, "unsafe roadmap should expose an unsafe row");
  const unsafeTempActivationRehearsal = guard.buildTempExecutorActivationRehearsal({
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true },
    firstSafeExecutorContract: firstSafeContract,
    firstSafeValidationGate: readyFirstSafeValidationGate,
    firstSafeImplementationWorkOrder: readyFirstSafeWorkOrder,
    releaseGate: enabledGate,
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule
  });
  assert.strictEqual(unsafeTempActivationRehearsal.status, "unsafe-runtime", "temp activation rehearsal should stop on unsafe runtime signals");
  assert.strictEqual(unsafeTempActivationRehearsal.realRunAllowed, false, "unsafe temp activation rehearsal must not allow real execution");
  const targetRejectedWriteBoundaryProbe = guard.buildWriteBoundaryProbe({
    nativeWriteBoundary: {
      status: "complete",
      result: {
        available: true,
        accepted: false,
        realRunEnabled: false,
        destructiveCommands: false,
        reason: "target rejected",
        contractEcho: rejectedWriteBoundaryProbe.contractEcho,
        entries: [
          {
            id: "windows-temp",
            title: "Windows temporary files",
            route: "known-temp-delete",
            result: "rejected",
            rejectCode: "target-forbidden",
            bytes: 0,
            note: "Downloads is not a temp target"
          }
        ],
        warnings: ["target scope rejected"]
      }
    },
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    runtimeCapabilities: { available: true, executeCleanupPlan: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(targetRejectedWriteBoundaryProbe.status, "target-scope-rejected", "target-scope rejection should not count as passing probe evidence");
  assert.strictEqual(targetRejectedWriteBoundaryProbe.rejectionEvidence, false, "target-scope rejection is diagnostic only");
  const mismatchedContractProbe = guard.buildWriteBoundaryProbe({
    nativeWriteBoundary: {
      status: "complete",
      result: {
        available: true,
        accepted: false,
        realRunEnabled: false,
        destructiveCommands: false,
        reason: "disabled",
        contractEcho: {
          schemaVersion: firstSafeContract.schemaVersion,
          requestMode: firstSafeContract.requestPreview.mode,
          planId: "older-plan",
          route: firstSafeContract.requestPreview.route,
          scanFingerprint: firstSafeContract.requestPreview.scanFingerprint,
          consentPlanId: firstSafeContract.requestPreview.consentPlanId,
          expectedBytes: firstSafeContract.requestPreview.expectedBytes,
          dryRunOnly: true,
          mutationAttempted: false,
          actionCount: firstSafeContract.requestPreview.actionCount
        },
        entries: [{ id: "windows-temp", title: "Windows temporary files", route: "known-temp-delete", result: "rejected", bytes: 0 }]
      }
    },
    realExecutorCapsule: currentBuildExecutorCapsule,
    firstSafeExecutorContract: firstSafeContract,
    runtimeCapabilities: { available: true, executeCleanupPlan: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(mismatchedContractProbe.status, "contract-mismatch", "write-boundary rejection must not count when contract echo differs");
  assert.strictEqual(mismatchedContractProbe.rejectionEvidence, false, "contract mismatch should not count as rejection evidence");
  const acceptedWriteBoundaryProbe = guard.buildWriteBoundaryProbe({
    nativeWriteBoundary: {
      status: "complete",
      result: {
        available: true,
        accepted: true,
        realRunEnabled: false,
        destructiveCommands: false,
        entries: [{ id: "windows-temp", title: "Windows temporary files", result: "rejected", bytes: 0 }]
      }
    },
    realExecutorCapsule: currentBuildExecutorCapsule,
    runtimeCapabilities: { available: true, executeCleanupPlan: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(acceptedWriteBoundaryProbe.status, "unsafe-signal", "accepted write probe result must be unsafe");
  const nonZeroWriteBoundaryProbe = guard.buildWriteBoundaryProbe({
    nativeWriteBoundary: {
      status: "complete",
      result: {
        available: true,
        accepted: false,
        realRunEnabled: false,
        destructiveCommands: false,
        entries: [{ id: "windows-temp", title: "Windows temporary files", result: "rejected", bytes: 1 }]
      }
    },
    realExecutorCapsule: currentBuildExecutorCapsule,
    runtimeCapabilities: { available: true, executeCleanupPlan: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(nonZeroWriteBoundaryProbe.status, "unsafe-signal", "non-zero write probe bytes must be unsafe");
  const destructiveWriteBoundaryProbe = guard.buildWriteBoundaryProbe({
    nativeWriteBoundary: {
      status: "complete",
      result: {
        available: true,
        accepted: false,
        realRunEnabled: false,
        destructiveCommands: true,
        entries: [{ id: "windows-temp", title: "Windows temporary files", result: "rejected", bytes: 0 }]
      }
    },
    realExecutorCapsule: currentBuildExecutorCapsule,
    runtimeCapabilities: { available: true, executeCleanupPlan: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(destructiveWriteBoundaryProbe.status, "unsafe-signal", "destructive command signal must be unsafe");
  const unsafeActivationGate = guard.buildTempExecutorActivationGate({
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true, executorFlags: { tempCleanupExecutor: false } },
    firstSafeValidationGate: readyFirstSafeValidationGate,
    firstSafeImplementationWorkOrder: readyFirstSafeWorkOrder,
    writeBoundaryProbe: destructiveWriteBoundaryProbe,
    releaseGate: enabledGate,
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule
  });
  assert.strictEqual(unsafeActivationGate.status, "unsafe-runtime", "unsafe write signals should stop temp activation");
  assert.strictEqual(unsafeActivationGate.realRunAllowed, false, "unsafe activation gate must not grant real execution");
  assert(unsafeActivationGate.blockers.some((blocker) => blocker.id === "unsafe-runtime"), "unsafe activation gate should identify runtime write capability");
  const releasePacketRuntime = { available: true, realRunEnabled: false, destructiveCommands: false, executeCleanupPlan: true };
  const releasePacketGate = guard.buildReleaseGate({
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan: cleanRunExecutorPlan
  });
  const releasePacketPrivilege = guard.buildPrivilegeBoundary({
    runtimeCapabilities: { available: true, elevated: true, realRunEnabled: false },
    executorPlan: cleanRunExecutorPlan
  });
  const releasePacketPrivacy = guard.buildPrivacyBoundary({
    scanMode: "native-readonly",
    runtimeCapabilities: releasePacketRuntime
  });
  const releasePacketWriteReadiness = guard.buildWriteReadiness({
    releaseGate: releasePacketGate,
    runtimeCapabilities: releasePacketRuntime,
    executorPlan: cleanRunExecutorPlan,
    rollbackPlan: tempRollbackPlan,
    rescanComparison: matchedComparison,
    privilegeBoundary: releasePacketPrivilege,
    privacyBoundary: releasePacketPrivacy,
    consentReceipt: armedConsent,
    runReadiness: runReady
  });
  const releasePacketPowerCatalog = guard.buildTaskPowerCatalog({
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    approvals: { groupConfirm: true, reviewed: {}, reviewItems: {}, typed: {} },
    scanMode: "native-readonly",
    runtimeCapabilities: releasePacketRuntime
  });
  const releasePacketTaskGrants = guard.buildTaskCapabilityGrants({
    executorPlan: cleanRunExecutorPlan,
    taskPowerCatalog: releasePacketPowerCatalog,
    planSnapshot: cleanRunSnapshot,
    scanSession: currentScanSession,
    consentReceipt: armedConsent,
    firstSafeExecutorContract: firstSafeContract,
    writeBoundaryProbe: rejectedWriteBoundaryProbe,
    runtimeCapabilities: releasePacketRuntime
  });
  const releasePacketPublicReadiness = guard.buildPublicBetaReadiness({
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    runtimeCapabilities: releasePacketRuntime,
    releaseGate: releasePacketGate,
    privacyBoundary: releasePacketPrivacy,
    validationEvidence: {},
    documentationEvidence: { publicReleaseResearch: true, windowsRealDataSetup: true }
  });
  const releasePacketValidationPack = guard.buildValidationEvidencePack({
    releaseGate: releasePacketGate,
    executorPlan: cleanRunExecutorPlan,
    executorManifest,
    scanMode: "native-readonly",
    runtimeCapabilities: releasePacketRuntime
  });
  const releasePacketSupportBundle = guard.buildSupportBundle({
    profile: guard.getScenario("developer").profile,
    scanMode: "native-readonly",
    scanSession: currentScanSession,
    nativeScan: capturedNativeScan,
    privacyBoundary: releasePacketPrivacy,
    publicBetaReadiness: releasePacketPublicReadiness,
    releaseGate: releasePacketGate,
    runtimeCapabilities: releasePacketRuntime,
    executorPlan: cleanRunExecutorPlan,
    rollbackPlan: tempRollbackPlan,
    ledgerHistorySummary: guard.buildLedgerHistorySummary([], cleanRunSnapshot)
  });
  const releaseReviewPacket = guard.buildReleaseReviewPacket({
    planSnapshot: cleanRunSnapshot,
    scanSession: currentScanSession,
    taskCapabilityGrants: releasePacketTaskGrants,
    firstSafeExecutorContract: firstSafeContract,
    writeBoundaryProbe: rejectedWriteBoundaryProbe,
    validationPack: releasePacketValidationPack,
    rollbackPlan: tempRollbackPlan,
    rescanComparison: matchedComparison,
    privilegeBoundary: releasePacketPrivilege,
    privacyBoundary: releasePacketPrivacy,
    publicBetaReadiness: releasePacketPublicReadiness,
    supportBundle: releasePacketSupportBundle,
    releaseGate: releasePacketGate,
    writeReadiness: releasePacketWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule,
    executorPlan: cleanRunExecutorPlan,
    runtimeCapabilities: releasePacketRuntime,
    consentReceipt: armedConsent
  });
  assert.strictEqual(releaseReviewPacket.schemaVersion, "spaceguard-release-review-packet/v1", "release review packet should expose a schema version");
  assert.strictEqual(releaseReviewPacket.status, "review-waiting", "release packet should wait on validation evidence rather than opening real execution");
  assert.strictEqual(releaseReviewPacket.readyForRealExecution, false, "release packet must not make real execution ready");
  assert.strictEqual(releaseReviewPacket.rows.find((row) => row.id === "write-boundary-rejection").status, "passed", "release packet should include write-boundary rejection proof");
  assert.strictEqual(releaseReviewPacket.rows.find((row) => row.id === "real-cleanup-locked").status, "passed", "release packet should prove real cleanup remains locked");
  assert.strictEqual(releaseReviewPacket.rows.find((row) => row.id === "validation-pack").status, "waiting", "release packet should keep incomplete validation visible");
  const activationAwareAudit = guard.buildProductCompletionAudit({
    scanned: true,
    scanMode: "native-readonly",
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    releaseReviewPacket,
    validationPack: releasePacketValidationPack,
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule,
    tempExecutorActivationGate: disabledFlagActivationGate,
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false }
  });
  const activationAuditRow = activationAwareAudit.rows.find((row) => row.id === "temp-executor-activation");
  assert.strictEqual(activationAuditRow.status, "future-locked", "product audit should keep temp activation future-locked");
  assert.strictEqual(activationAuditRow.evidence, "feature-flag-disabled", "product audit should expose temp activation status");
  const activationHandoff = guard.buildWorkflowHandoffPacket({
    agentQuestionQueue: activationQuestionQueue,
    productCompletionAudit: activationAwareAudit,
    tempExecutorActivationGate: disabledFlagActivationGate,
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(activationHandoff.workflow.tempActivationStatus, "feature-flag-disabled", "workflow handoff should carry temp activation status");
  assert.strictEqual(activationHandoff.workflow.tempActivationAllowed, false, "workflow handoff should keep activation locked");
  assert(activationHandoff.nextActions.some((step) => step.includes("Review temp executor activation")), "workflow handoff should include temp activation as a next action");
  const betaHandoffManifest = guard.buildBetaHandoffManifest({
    workflowHandoff: activationHandoff,
    supportBundle: releasePacketSupportBundle,
    releaseReviewPacket,
    validationPack: releasePacketValidationPack,
    nativeBetaEvidenceLedger: {
      schemaVersion: "spaceguard-native-beta-evidence/v1",
      status: "evidence-waiting",
      counts: { total: 7, complete: 2, needsDetail: 5 },
      rows: []
    },
    productCompletionAudit: activationAwareAudit,
    nativeBetaDistributionReadiness: { readyForWebDemo: true, readyForNativeBeta: false },
    publicBetaReadiness: { readyForWebDemo: true, readyForNativeBeta: false },
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(betaHandoffManifest.schemaVersion, "spaceguard-beta-handoff-manifest/v1", "beta handoff manifest should expose a schema version");
  assert.strictEqual(betaHandoffManifest.readyForPublicHandoff, true, "beta handoff manifest should allow redacted public handoff when public artifacts are ready");
  assert.strictEqual(betaHandoffManifest.readyForNativeBetaHandoff, false, "beta handoff manifest should not mark native beta ready with incomplete internal evidence");
  assert.strictEqual(betaHandoffManifest.redactedPublicArtifacts, true, "beta handoff manifest should keep public-shareable artifacts redacted");
  assert(betaHandoffManifest.publicRows.every((row) => row.publicShareable && row.redactedPaths), "public manifest rows should be redacted and public-shareable");
  assert(betaHandoffManifest.internalRows.some((row) => row.publicShareable === false), "manifest should separate internal-only artifacts");
  assert(betaHandoffManifest.pathLevelRows.some((row) => row.id === "validation-pack"), "manifest should identify path-level validation artifacts");
  assert.strictEqual(betaHandoffManifest.rows.find((row) => row.id === "native-beta-evidence").status, "waiting", "manifest should keep incomplete beta evidence waiting");
  const betaHandoffMarkdown = guard.buildBetaHandoffManifestMarkdown(betaHandoffManifest);
  assert(betaHandoffMarkdown.includes("SpaceGuard Beta Handoff Manifest"), "beta handoff markdown should have a title");
  assert(betaHandoffMarkdown.includes("Public handoff ready: yes"), "beta handoff markdown should report public readiness");
  const unsafeBetaHandoffManifest = guard.buildBetaHandoffManifest({
    ...betaHandoffManifest,
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true }
  });
  assert.strictEqual(unsafeBetaHandoffManifest.status, "unsafe-stop", "beta handoff manifest should stop on runtime write signals");
  assert.strictEqual(unsafeBetaHandoffManifest.readyForPublicHandoff, false, "unsafe beta handoff should not be public-ready");
  assert.strictEqual(unsafeBetaHandoffManifest.counts.blocked, unsafeBetaHandoffManifest.counts.total, "unsafe beta handoff should block every artifact row");
  const releasePacketMarkdown = guard.buildReleaseReviewPacketMarkdown(releaseReviewPacket);
  assert(releasePacketMarkdown.includes("SpaceGuard Release Review Packet"), "release packet markdown should have a title");
  assert(releasePacketMarkdown.includes("Ready for real execution: no"), "release packet markdown should keep real execution blocked");
  const unsafeReleaseReviewPacket = guard.buildReleaseReviewPacket({
    ...releaseReviewPacket,
    writeBoundaryProbe: destructiveWriteBoundaryProbe,
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true },
    writeReadiness: { readyForRealExecution: true, status: "ready-for-real-execution" }
  });
  assert.strictEqual(unsafeReleaseReviewPacket.status, "unsafe-stop", "release packet should stop review when destructive capability appears");
  assert.strictEqual(unsafeReleaseReviewPacket.writeSignalVisible, true, "unsafe release packet should expose visible write signals");
  assert(unsafeReleaseReviewPacket.unsafeRows.some((row) => row.id === "real-cleanup-locked"), "unsafe packet should identify the real-cleanup lock violation");
  const writeReadinessReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, []),
    ledger: [],
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    writeReadiness: currentBuildWriteReadiness,
    realExecutorCapsule: currentBuildExecutorCapsule,
    realDataLaunchRoadmap: nativeLaunchRoadmap,
    firstSafeExecutorContract: firstSafeContract,
    firstSafeValidationGate: readyFirstSafeValidationGate,
    firstSafeImplementationWorkOrder: readyFirstSafeWorkOrder,
    tempExecutorActivationGate: disabledFlagActivationGate,
    tempExecutorActivationRehearsal: tempActivationRehearsal,
    writeBoundaryProbe: rejectedWriteBoundaryProbe
  });
  assert(writeReadinessReport.includes("## Write Readiness"), "dry-run report should include write readiness");
  assert(writeReadinessReport.includes("Ready for real execution: no"), "write readiness report should keep real execution blocked");
  assert(writeReadinessReport.includes("## Real Executor Capsule"), "dry-run report should include real executor capsule");
  assert(writeReadinessReport.includes("Destructive action available: no"), "executor capsule report should keep destructive action hidden");
  assert(writeReadinessReport.includes("## Real Data Launch Roadmap"), "dry-run report should include the real-data launch roadmap");
  assert(writeReadinessReport.includes("Current milestone: Native read-only beta evidence"), "roadmap report should expose the current product milestone");
  assert(writeReadinessReport.includes("Real cleanup locked: yes"), "roadmap report should keep real cleanup locked");
  assert(writeReadinessReport.includes("## Write Boundary Probe"), "dry-run report should include write boundary probe");
  assert(writeReadinessReport.includes("Rejection evidence: yes"), "write boundary probe report should record rejection evidence");
  assert(writeReadinessReport.includes("Executor scaffold: Known temp roots | feature-flag-disabled | flag=tempCleanupExecutor | mutation=disabled"), "write boundary report should include the disabled temp scaffold");
  assert(writeReadinessReport.includes("preflight=executor-disabled-after-preflight"), "write boundary report should include native preflight status");
  assert(writeReadinessReport.includes("Bytes reclaimed: 0 GB"), "write boundary probe report should not count recovered bytes");
  assert(writeReadinessReport.includes("## First-Safe Implementation Work Order"), "dry-run report should include the first-safe implementation work order");
  assert(writeReadinessReport.includes("Real run allowed: no"), "implementation work order report should keep real execution blocked");
  assert(writeReadinessReport.includes("## Temp Executor Activation Gate"), "dry-run report should include temp executor activation gate");
  assert(writeReadinessReport.includes("Activation allowed: no"), "activation gate report should keep activation locked");
  assert(writeReadinessReport.includes("Feature flag: tempCleanupExecutor | disabled"), "activation gate report should expose the disabled temp flag");
  assert(writeReadinessReport.includes("## Temp Activation Rehearsal"), "dry-run report should include temp activation rehearsal");
  assert(writeReadinessReport.includes("Demo only: yes"), "activation rehearsal report should mark synthetic evidence");
  assert(writeReadinessReport.includes("Activation gate: feature-flag-disabled"), "activation rehearsal report should show the disabled flag outcome");
  const hypotheticalRealExecutorPlan = {
    ...tempExecutorPlan,
    realRunEnabled: true,
    rows: tempExecutorPlan.rows.map((row) => ({ ...row, canRealRun: true, status: "real-ready" }))
  };
  const hypotheticalReleaseGate = {
    ...enabledGate,
    readyForRealRun: true,
    blockedReason: "",
    candidateRoutes: hypotheticalRealExecutorPlan.rows
  };
  const mismatchWriteReadiness = guard.buildWriteReadiness({
    releaseGate: hypotheticalReleaseGate,
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true },
    executorPlan: hypotheticalRealExecutorPlan,
    rollbackPlan: tempRollbackPlan,
    rescanComparison: mismatchComparison,
    privilegeBoundary: guard.buildPrivilegeBoundary({
      runtimeCapabilities: { available: true, elevated: true, realRunEnabled: true },
      executorPlan: hypotheticalRealExecutorPlan
    }),
    privacyBoundary: guard.buildPrivacyBoundary({
      scanMode: "native-readonly",
      runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
    }),
    consentReceipt: { ready: true, planId: tempPlanSnapshot.id },
    runReadiness: { ready: true }
  });
  assert.strictEqual(mismatchWriteReadiness.readyForRealExecution, false, "matched rescan parity should be required even after hypothetical real executors exist");
  assert(mismatchWriteReadiness.items.some((item) => item.id === "rescan-parity" && !item.passed), "write readiness should block on rescan mismatch");
  const hypotheticalReadyWriteReadiness = guard.buildWriteReadiness({
    releaseGate: hypotheticalReleaseGate,
    runtimeCapabilities: { available: true, realRunEnabled: true, destructiveCommands: true },
    executorPlan: hypotheticalRealExecutorPlan,
    rollbackPlan: tempRollbackPlan,
    rescanComparison: matchedComparison,
    privilegeBoundary: guard.buildPrivilegeBoundary({
      runtimeCapabilities: { available: true, elevated: true, realRunEnabled: true },
      executorPlan: hypotheticalRealExecutorPlan
    }),
    privacyBoundary: guard.buildPrivacyBoundary({
      scanMode: "native-readonly",
      runtimeCapabilities: { realRunEnabled: true, destructiveCommands: true }
    }),
    consentReceipt: { ready: true, planId: tempPlanSnapshot.id },
    runReadiness: { ready: true }
  });
  assert.strictEqual(hypotheticalReadyWriteReadiness.readyForRealExecution, true, "write readiness should pass only when every final real-execution gate is satisfied");

  const readySelection = new Set(["windows-temp"]);
  const readyReadiness = guard.getExecutionReadinessForActions(
    readySelection,
    { groupConfirm: true, reviewed: {}, typed: {} },
    developerActions,
    []
  );
  const readyPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: readySelection,
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  assert.strictEqual(
    guard.buildExecutionPreflight({
      scanned: false,
      scanning: false,
      selectedIds: readySelection,
      actionList: developerActions,
      readiness: readyReadiness,
      protectedPaths: [],
      ledger: [],
      planSnapshot: readyPlanSnapshot
    }).ready,
    false,
    "preflight must block execution before scan"
  );
  assert.strictEqual(
    guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: readySelection,
      actionList: developerActions,
      readiness: readyReadiness,
      protectedPaths: [],
      ledger: [],
      planSnapshot: readyPlanSnapshot
    }).ready,
    true,
    "preflight should pass when scan, selection, and gates are ready"
  );
  assert.strictEqual(
    guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: readySelection,
      actionList: developerActions,
      readiness: readyReadiness,
      protectedPaths: [],
      ledger: [{ id: "windows-temp", planId: readyPlanSnapshot.id }],
      planSnapshot: readyPlanSnapshot
    }).ready,
    false,
    "preflight must block duplicate execution after current plan ledger exists"
  );
  assert.strictEqual(
    guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: readySelection,
      actionList: developerActions,
      readiness: readyReadiness,
      protectedPaths: [],
      ledger: [{ id: "windows-temp", planId: "plan-old" }],
      planSnapshot: readyPlanSnapshot
    }).ready,
    true,
    "preflight should allow simulation when only stale ledger entries exist"
  );

  const appFootprintAction = guard.actions.find((action) => action.id === "installed-app-footprints");
  assert(appFootprintAction, "installed app footprint action should exist");
  const appReviewSeed = guard.buildReviewItemsByAction(guard.actions, null, [], {
    groupConfirm: true,
    permanentConfirm: true,
    reviewed: {},
    reviewItems: {},
    typed: {}
  })["installed-app-footprints"];
  const appReviewApprovals = {
    groupConfirm: true,
    permanentConfirm: true,
    reviewed: {},
    typed: {},
    reviewItems: {
      "installed-app-footprints": Object.fromEntries(
        appReviewSeed.items.map((item) => [item.id, item.recommendation === "review" ? "remove" : "keep"])
      )
    }
  };
  const appReviews = guard.buildReviewItemsByAction(guard.actions, null, [], appReviewApprovals);
  assert(appReviews["installed-app-footprints"].removeBytes > 0, "app footprint review should show manual uninstall candidate bytes");
  assert.strictEqual(appReviews["installed-app-footprints"].selectedBytes, 0, "manual app uninstall candidates must not become executor bytes");
  const appDossier = guard.buildInstalledAppReviewDossier({ itemReviewsByAction: appReviews });
  assert.strictEqual(appDossier.manualOnly, true, "installed app review dossier should stay manual-only");
  assert.strictEqual(appDossier.canCreateExecutor, false, "installed app review dossier must not create executor authority");
  assert.strictEqual(appDossier.status, "manual-uninstall-follow-up", "selected app reviews should become manual uninstall follow-up");
  assert(appDossier.manualSelectedBytes > 0, "installed app review dossier should show manual follow-up bytes");
  assert(appDossier.rows.every((row) => row.usageProof === "not proven" || row.usageProof), "installed app review rows should expose usage-proof state");
  const appWorkOrder = guard.buildInstalledAppUninstallWorkOrder({
    dossier: appDossier,
    planSnapshot: { id: "plan-app-uninstall" },
    scanSession: { currentFingerprint: "scan-app-before" },
    rescanComparison: { status: "not-run" }
  });
  assert.strictEqual(appWorkOrder.schemaVersion, "spaceguard-app-uninstall-work-order/v1", "app uninstall work order should expose a stable schema");
  assert.strictEqual(appWorkOrder.status, "ready-for-manual-uninstall", "selected app reviews should produce a manual uninstall work order");
  assert.strictEqual(appWorkOrder.manualOnly, true, "app uninstall work order should stay manual-only");
  assert.strictEqual(appWorkOrder.canCreateExecutor, false, "app uninstall work order must not create executor authority");
  assert.strictEqual(appWorkOrder.canRunUninstaller, false, "app uninstall work order must not run uninstallers");
  assert(appWorkOrder.selectedBytes > 0, "app uninstall work order should show manually selected footprint bytes");
  assert(appWorkOrder.guardrails.includes("No uninstall-string execution."), "app uninstall work order should forbid uninstall-string execution");
  assert(appWorkOrder.steps.some((step) => step.id === "post-uninstall-rescan" && step.status === "ready"), "app uninstall work order should require post-uninstall rescan evidence");
  const appWorkOrderMarkdown = guard.buildInstalledAppUninstallWorkOrderMarkdown(appWorkOrder);
  assert(appWorkOrderMarkdown.includes("SpaceGuard App Uninstall Work Order"), "app uninstall work order should export markdown");
  assert(appWorkOrderMarkdown.includes("No direct Program Files deletion."), "app uninstall work order export should preserve guardrails");
  assert.strictEqual(
    guard.computeTotals(new Set(["installed-app-footprints"]), guard.actions, {
      approvals: appReviewApprovals,
      itemReviewsByAction: appReviews
    }).selectedBytes,
    0,
    "manual app uninstall candidates must not count toward selected cleanup recovery"
  );
  const appExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["installed-app-footprints"]),
    actionList: guard.actions,
    approvals: appReviewApprovals,
    itemReviewsByAction: appReviews
  });
  const appExecutorRow = appExecutorPlan.rows.find((row) => row.id === "installed-app-footprints");
  assert.strictEqual(appExecutorRow.route, "manual-app-uninstall", "app footprint route should stay manual uninstall");
  assert.strictEqual(appExecutorRow.canSimulate, false, "app footprint review must not create a dry-run executor route");
  assert.strictEqual(appExecutorRow.bytes, 0, "app footprint executor row must not claim automated recovery bytes");

  const scopedProjectAi = guard.buildAIAgentIntegration({
    providerConfig: { connected: true, provider: "openai" },
    runtimeCapabilities: {
      realRunEnabled: true,
      destructiveCommands: true,
      safeExecutorsEnabled: true,
      executorFlags: {
        projectDependencyExecutor: true,
        tempCleanupExecutor: false,
        recycleBinExecutor: false,
        browserCacheExecutor: false,
        toolNativePruneExecutors: false
      }
    }
  });
  assert.strictEqual(scopedProjectAi.status, "advisory-connector-ready", "AI advisor should remain available for scoped project dependency execution");
  assert.strictEqual(scopedProjectAi.directToolAccess, false, "AI advisor must not receive direct tool access");
  assert.strictEqual(
    scopedProjectAi.rows.find((row) => row.id === "mutation-boundary").status,
    "scoped-executor-visible",
    "AI advisor should label scoped executor visibility without granting authority"
  );
  const scopedBrowserAi = guard.buildAIAgentIntegration({
    providerConfig: { connected: true, provider: "openai" },
    runtimeCapabilities: {
      realRunEnabled: true,
      destructiveCommands: true,
      safeExecutorsEnabled: true,
      executorFlags: {
        projectDependencyExecutor: false,
        tempCleanupExecutor: false,
        recycleBinExecutor: false,
        browserCacheExecutor: true,
        toolNativePruneExecutors: false
      }
    }
  });
  assert.strictEqual(scopedBrowserAi.status, "advisory-connector-ready", "AI advisor should remain available for scoped browser cache execution");
  assert.strictEqual(scopedBrowserAi.directToolAccess, false, "AI advisor must not receive direct tool access for browser cache cleanup");
  assert.strictEqual(
    scopedBrowserAi.rows.find((row) => row.id === "mutation-boundary").status,
    "scoped-executor-visible",
    "AI advisor should label browser cache executor visibility without granting authority"
  );
  const scopedGradleAi = guard.buildAIAgentIntegration({
    providerConfig: { connected: true, provider: "openai" },
    runtimeCapabilities: {
      realRunEnabled: true,
      destructiveCommands: true,
      safeExecutorsEnabled: true,
      executorFlags: {
        projectDependencyExecutor: false,
        tempCleanupExecutor: false,
        gradleCacheExecutor: true,
        recycleBinExecutor: false,
        browserCacheExecutor: false,
        toolNativePruneExecutors: false
      }
    }
  });
  assert.strictEqual(scopedGradleAi.status, "advisory-connector-ready", "AI advisor should remain available for scoped Gradle cache execution");
  assert.strictEqual(scopedGradleAi.directToolAccess, false, "AI advisor must not receive direct tool access for Gradle cache cleanup");
  assert.strictEqual(
    scopedGradleAi.rows.find((row) => row.id === "mutation-boundary").status,
    "scoped-executor-visible",
    "AI advisor should label Gradle cache executor visibility without granting authority"
  );
  const scopedNpmAi = guard.buildAIAgentIntegration({
    providerConfig: { connected: true, provider: "openai" },
    runtimeCapabilities: {
      realRunEnabled: true,
      destructiveCommands: true,
      safeExecutorsEnabled: true,
      executorFlags: {
        projectDependencyExecutor: false,
        tempCleanupExecutor: false,
        gradleCacheExecutor: false,
        npmCacheExecutor: true,
        recycleBinExecutor: false,
        browserCacheExecutor: false,
        toolNativePruneExecutors: false
      }
    }
  });
  assert.strictEqual(scopedNpmAi.status, "advisory-connector-ready", "AI advisor should remain available for scoped npm cache execution");
  assert.strictEqual(scopedNpmAi.directToolAccess, false, "AI advisor must not receive direct tool access for npm cache cleanup");
  assert.strictEqual(
    scopedNpmAi.rows.find((row) => row.id === "mutation-boundary").status,
    "scoped-executor-visible",
    "AI advisor should label npm cache executor visibility without granting authority"
  );
  const scopedRecycleAi = guard.buildAIAgentIntegration({
    providerConfig: { connected: true, provider: "openai" },
    runtimeCapabilities: {
      realRunEnabled: true,
      destructiveCommands: true,
      safeExecutorsEnabled: true,
      executorFlags: {
        projectDependencyExecutor: false,
        tempCleanupExecutor: false,
        gradleCacheExecutor: false,
        npmCacheExecutor: false,
        recycleBinExecutor: true,
        browserCacheExecutor: false,
        toolNativePruneExecutors: false
      }
    }
  });
  assert.strictEqual(scopedRecycleAi.status, "advisory-connector-ready", "AI advisor should remain available for scoped Recycle Bin execution");
  assert.strictEqual(scopedRecycleAi.directToolAccess, false, "AI advisor must not receive direct tool access for Recycle Bin cleanup");
  assert.strictEqual(
    scopedRecycleAi.rows.find((row) => row.id === "mutation-boundary").status,
    "scoped-executor-visible",
    "AI advisor should label Recycle Bin executor visibility without granting authority"
  );

  console.log("guardrails ok");
})();
