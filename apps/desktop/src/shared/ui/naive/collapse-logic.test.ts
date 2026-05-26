import assert from "node:assert/strict";
import test from "node:test";
import {
  createCollapseTransitionSnapshot,
  normalizeNaiveCollapseNames,
  resolveNaiveCollapseHeaderClick
} from "./collapse-logic";

test("collapse names normalize string, number, null, and duplicates", () => {
  assert.deepEqual(normalizeNaiveCollapseNames(null), []);
  assert.deepEqual(normalizeNaiveCollapseNames("about"), ["about"]);
  assert.deepEqual(normalizeNaiveCollapseNames(3), ["3"]);
  assert.deepEqual(normalizeNaiveCollapseNames(["a", 2, "a", 2]), ["a", "2"]);
});

test("collapse header click metadata is derived from value diffs", () => {
  assert.deepEqual(resolveNaiveCollapseHeaderClick(["a"], ["a", "b"]), {
    name: "b",
    expanded: true
  });
  assert.deepEqual(resolveNaiveCollapseHeaderClick(["a", "b"], ["b"]), {
    name: "a",
    expanded: false
  });
  assert.equal(resolveNaiveCollapseHeaderClick(["a"], ["a"]), null);
});

test("collapse transition snapshots keep entered height unclamped", () => {
  assert.deepEqual(createCollapseTransitionSnapshot("entered", 120), {
    phase: "entered",
    visible: true,
    maxHeight: ""
  });
  assert.deepEqual(createCollapseTransitionSnapshot("entering", 120), {
    phase: "entering",
    visible: true,
    maxHeight: "120px"
  });
  assert.deepEqual(createCollapseTransitionSnapshot("exited", 120), {
    phase: "exited",
    visible: false,
    maxHeight: "0px"
  });
});
