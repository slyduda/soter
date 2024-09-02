import { expect, test } from "vitest";
import { soter } from "../src";
import {
  useMatter,
  matterMachineDict,
  MatterState,
} from "../examples/composable";
import { instructions } from "../src/instructions";

test("machine instantiation", () => {
  const matter = useMatter("solid");
  const inst = instructions(matterMachineDict);
  const m = soter(matter, inst);
  expect(m).toBeDefined();
});
