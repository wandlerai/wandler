jest.mock("web-worker", () => ({
  WebWorker: jest.fn(),
}));

import { Wandler } from "../../src/wandler";

describe("Wandler", () => {
  test("initialization", async () => {
    const ai = new Wandler("model-id");
    await expect(ai.text([])).resolves.toBeDefined();
  });
});
