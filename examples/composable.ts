import { InstructionMap } from "../src";

export type MatterState = "solid" | "liquid" | "gas" | "plasma";
export type MatterTrigger = "melt";

export const useMatter = (s: MatterState) => {
  const state = s;
  const temperature = 0;
  const effected = false;

  const canMelt = () => {
    return temperature > 40;
  };

  return {
    state,
    effected,
    temperature,
    canMelt,
  };
};

export const matterMachineDict = {
  melt: [{ origins: "solid", destination: "liquid", conditions: "canMelt" }],
};
