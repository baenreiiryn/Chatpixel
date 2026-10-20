import assert from "node:assert/strict";
import test from "node:test";

const dice = await import("../lib/dice.ts");

test("duality render plan keeps normal, hope, and fear in independent lanes", () => {
  assert.equal(typeof dice.buildDiceBoxRenderPlan, "function", "buildDiceBoxRenderPlan must exist");

  const parsed = dice.parseDiceFormula("1d6+2d12");
  const values = [0.5, 0.1, 0.9];
  let index = 0;
  const result = dice.rollDice(parsed, {
    random: () => values[index++],
    appearanceByDie: ["normal", "hope", "fear"],
  });

  const plan = dice.buildDiceBoxRenderPlan(result);
  assert.deepEqual(
    plan.map((lane) => ({ role: lane.role, notation: lane.roll.notation, outcomes: lane.roll.outcomes })),
    [
      { role: "normal", notation: "1d6", outcomes: [4] },
      { role: "hope", notation: "1d12", outcomes: [2] },
      { role: "fear", notation: "1d12", outcomes: [11] },
    ],
  );
});

test("parallel lane runner starts every appearance before any lane resolves", async () => {
  assert.equal(typeof dice.runDiceBoxRenderPlan, "function", "runDiceBoxRenderPlan must exist");

  const started = [];
  const releases = new Map();
  const plan = [
    { role: "normal", dieIndexes: [0], roll: { notation: "1d6", outcomes: [4] } },
    { role: "hope", dieIndexes: [1], roll: { notation: "1d12", outcomes: [2] } },
    { role: "fear", dieIndexes: [2], roll: { notation: "1d12", outcomes: [11] } },
  ];

  const running = dice.runDiceBoxRenderPlan(plan, async (lane) => {
    started.push(lane.role);
    await new Promise((resolve) => releases.set(lane.role, resolve));
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["normal", "hope", "fear"]);

  for (const role of started) releases.get(role)();
  await running;
});

test("DualityDiceRoller-style /dr command maps to the Oracle duality formula", () => {
  assert.equal(typeof dice.dualityFormulaFromCommand, "function", "dualityFormulaFromCommand must exist");
  assert.equal(dice.dualityFormulaFromCommand("/dr"), "2d12");
  assert.equal(dice.dualityFormulaFromCommand("  /DR  "), "2d12");
  assert.equal(dice.dualityFormulaFromCommand("/r 2d12"), null);
  assert.equal(dice.dualityFormulaFromCommand("/dr 1d6"), null);
});

test("/r accepts the basic d20 and explicit 1d10 forms", () => {
  assert.equal(dice.parseDiceFormula("/r d20").normalized, "1d20");
  assert.equal(dice.parseDiceFormula("/r 1d10").normalized, "1d10");
});

test("d2 deterministic results stay in coin bounds and preserve forced display values", () => {
  const low = dice.rollDice("1d2", { random: () => 0, id: "d2-low" });
  const high = dice.rollDice("1d2", { random: () => 0.999999, id: "d2-high" });

  assert.equal(low.dice[0].value, 1);
  assert.equal(high.dice[0].value, 2);
  assert.deepEqual(dice.buildDiceBoxRoll(low), { notation: "1d2", outcomes: [1] });
  assert.deepEqual(dice.buildDiceBoxRoll(high), { notation: "1d2", outcomes: [2] });
});

test("d100 logical bounds map to percentile tens and units for forced 3D outcomes", () => {
  const cases = [
    { random: 0, value: 1, outcomes: [100, 1] },
    { random: 0.09, value: 10, outcomes: [10, 10] },
    { random: 0.98, value: 99, outcomes: [90, 9] },
    { random: 0.999999, value: 100, outcomes: [100, 10] },
  ];

  for (const entry of cases) {
    const result = dice.rollDice("1d100", { random: () => entry.random, id: `d100-${entry.value}` });
    assert.equal(result.dice[0].value, entry.value);
    assert.deepEqual(dice.buildDiceBoxRoll(result), {
      notation: "1d100+1d10",
      outcomes: entry.outcomes,
    });
  }
});

test("duality lanes keep auxiliary dice normal while Hope and Fear roll together", () => {
  const values = [0.5, 0.1, 0.9, 0.25];
  let index = 0;
  const result = dice.rollDice("1d6+2d12+1d8", {
    random: () => values[index++],
    appearanceByDie: ["normal", "hope", "fear", "normal"],
    id: "duality-with-auxiliary-dice",
  });

  const plan = dice.buildDiceBoxRenderPlan(result);
  assert.deepEqual(
    plan.map((lane) => ({
      role: lane.role,
      dieIndexes: lane.dieIndexes,
      notation: lane.roll.notation,
      outcomes: lane.roll.outcomes,
    })),
    [
      { role: "normal", dieIndexes: [0, 3], notation: "1d6+1d8", outcomes: [4, 3] },
      { role: "hope", dieIndexes: [1], notation: "1d12", outcomes: [2] },
      { role: "fear", dieIndexes: [2], notation: "1d12", outcomes: [11] },
    ],
  );
});
