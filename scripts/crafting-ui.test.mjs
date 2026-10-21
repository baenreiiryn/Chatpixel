import assert from "node:assert/strict";
import test from "node:test";

const {
  canStartCraftUiAttempt,
  countOccupiedCraftSlots,
  isCraftUiLocked,
  submitCraftUiAttempt,
} = await import("../lib/craftingUi.ts");

const slot = (slotIndex, quantity = 1) => ({ slot: slotIndex, quantity });

test("craft UI requires two distinct occupied slots, regardless of quantity in one slot", () => {
  assert.equal(countOccupiedCraftSlots([slot(0, 2)]), 1);
  assert.equal(canStartCraftUiAttempt({ slots: [slot(0, 2)] }), false);

  assert.equal(countOccupiedCraftSlots([slot(0), slot(1)]), 2);
  assert.equal(canStartCraftUiAttempt({ slots: [slot(0), slot(1)] }), true);
});

test("craft UI keeps all pending attempts locked", () => {
  const slots = [slot(0), slot(1)];

  assert.equal(isCraftUiLocked({ pendingAttempt: { stage: "review" } }), true);
  assert.equal(isCraftUiLocked({ pendingAttempt: { stage: "awaiting-roll" } }), true);
  assert.equal(canStartCraftUiAttempt({ slots, pendingAttempt: { stage: "review" } }), false);
  assert.equal(canStartCraftUiAttempt({ slots, pendingAttempt: { stage: "awaiting-roll" } }), false);
  assert.equal(canStartCraftUiAttempt({ slots, busy: true }), false);
  assert.equal(canStartCraftUiAttempt({ slots, disabled: true }), false);
});

test("successful craft start invokes the post-start handler so the caller can navigate to Session", async () => {
  const calls = [];
  const started = await submitCraftUiAttempt({
    slots: [slot(0), slot(4)],
    onCraft: async () => {
      calls.push("craft");
      return true;
    },
    onStarted: () => calls.push("session"),
  });

  assert.equal(started, true);
  assert.deepEqual(calls, ["craft", "session"]);
});

test("blocked or rejected craft start never invokes the post-start handler", async () => {
  let craftCalls = 0;
  let navigationCalls = 0;

  const blocked = await submitCraftUiAttempt({
    slots: [slot(0, 2)],
    onCraft: () => {
      craftCalls += 1;
      return true;
    },
    onStarted: () => {
      navigationCalls += 1;
    },
  });
  assert.equal(blocked, false);
  assert.equal(craftCalls, 0);
  assert.equal(navigationCalls, 0);

  const rejected = await submitCraftUiAttempt({
    slots: [slot(0), slot(1)],
    onCraft: () => {
      craftCalls += 1;
      return false;
    },
    onStarted: () => {
      navigationCalls += 1;
    },
  });
  assert.equal(rejected, false);
  assert.equal(craftCalls, 1);
  assert.equal(navigationCalls, 0);
});
