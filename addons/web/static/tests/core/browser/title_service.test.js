import { beforeEach, describe, expect, test } from "@mashora/hoot";
import { getService, makeMockEnv } from "@web/../tests/web_test_helpers";

describe.current.tags("headless");

let titleService;

beforeEach(async () => {
    await makeMockEnv();
    titleService = getService("title");
});

test("simple title", () => {
    titleService.setParts({ one: "MyMashora" });
    expect(titleService.current).toBe("MyMashora");
});

test("add title part", () => {
    titleService.setParts({ one: "MyMashora", two: null });
    expect(titleService.current).toBe("MyMashora");
    titleService.setParts({ three: "Import" });
    expect(titleService.current).toBe("MyMashora - Import");
});

test("modify title part", () => {
    titleService.setParts({ one: "MyMashora" });
    expect(titleService.current).toBe("MyMashora");
    titleService.setParts({ one: "Zopenerp" });
    expect(titleService.current).toBe("Zopenerp");
});

test("delete title part", () => {
    titleService.setParts({ one: "MyMashora" });
    expect(titleService.current).toBe("MyMashora");
    titleService.setParts({ one: null });
    expect(titleService.current).toBe("Mashora");
});

test("all at once", () => {
    titleService.setParts({ one: "MyMashora", two: "Import" });
    expect(titleService.current).toBe("MyMashora - Import");
    titleService.setParts({ one: "Zopenerp", two: null, three: "Sauron" });
    expect(titleService.current).toBe("Zopenerp - Sauron");
});

test("get title parts", () => {
    expect(titleService.current).toBe("");
    titleService.setParts({ one: "MyMashora", two: "Import" });
    expect(titleService.current).toBe("MyMashora - Import");
    const parts = titleService.getParts();
    expect(parts).toEqual({ one: "MyMashora", two: "Import" });
    parts.action = "Export";
    expect(titleService.current).toBe("MyMashora - Import"); // parts is a copy!
});
