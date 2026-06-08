const assert = require("assert");

(async () => {
  const workflow = await import("../src/real-workflow.mjs");

  const executedAt = "2026-06-08T15:00:00.000Z";
  const postRunGeneratedAt = "2026-06-08T15:01:00.000Z";
  const selectedInstaller = {
    id: "downloads-installers:setup-old",
    recipeId: "downloads-installers",
    title: "setup-old.exe",
    route: "item-review-recycle-bin",
    routeInput: "downloads",
    targetPath: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
    bytes: 128 * 1024 * 1024,
    sourceFinding: {
      recipeId: "downloads-installers",
      path: "C:\\Users\\LocalUser\\Downloads"
    },
    reviewTarget: {
      path: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
      bytes: 128 * 1024 * 1024
    }
  };

  const proof = workflow.buildPostRunProof({
    candidate: selectedInstaller,
    executionRecord: {
      executedAt,
      bytes: 128 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "downloads-installers",
          path: "C:\\Users\\LocalUser\\Downloads",
          bytes: 512 * 1024 * 1024,
          items: [
            {
              id: "setup-new",
              path: "C:\\Users\\LocalUser\\Downloads\\setup-new.exe",
              bytes: 512 * 1024 * 1024
            }
          ]
        }
      ]
    }
  });

  assert.strictEqual(proof.status, "matched", "selected item proof should match when that item is absent after rescan");
  assert.strictEqual(proof.actualBytes, 0, "selected item proof should compare the selected item, not parent finding bytes");
  assert.strictEqual(proof.targetEvidence.kind, "item", "selected item proof should record item-level evidence");

  const stillPresent = workflow.buildPostRunProof({
    candidate: selectedInstaller,
    executionRecord: {
      executedAt,
      bytes: 128 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "downloads-installers",
          path: "C:\\Users\\LocalUser\\Downloads",
          bytes: 640 * 1024 * 1024,
          items: [
            {
              id: "setup-old",
              path: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
              bytes: 128 * 1024 * 1024
            }
          ]
        }
      ]
    }
  });

  assert.strictEqual(stillPresent.status, "review-needed", "selected item proof should fail if the selected item is still present");
  assert.strictEqual(stillPresent.actualBytes, 128 * 1024 * 1024, "selected item proof should report remaining selected item bytes");

  const rootCandidate = {
    id: "npm-cache:C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    recipeId: "npm-cache",
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    targetPath: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    bytes: 300 * 1024 * 1024,
    sourceFinding: {
      recipeId: "npm-cache",
      path: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache"
    }
  };
  const rootProof = workflow.buildPostRunProof({
    candidate: rootCandidate,
    executionRecord: {
      executedAt,
      bytes: 250 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "npm-cache",
          path: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
          bytes: 40 * 1024 * 1024
        }
      ]
    }
  });

  assert.strictEqual(rootProof.status, "matched", "root proof should keep using root finding bytes");
  assert.strictEqual(rootProof.targetEvidence.kind, "finding", "root proof should record finding-level evidence");

  console.log("real workflow ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
