import { expect, test } from "vitest";

import * as z from "zod/v4";

test("string format methods", () => {
  const a = z.email().min(10);
  const b = z.email().max(10);
  const c = z.email().length(10);
  const d = z.email().uppercase();
  const e = z.email().lowercase();

  // Positive and negative cases for `a`
  expect(a.safeParse("longemail@example.com").success).toBe(true); // Positive
  expect(a.safeParse("ort@e.co").success).toBe(false); // Negative

  // Positive and negative cases for `b`
  expect(b.safeParse("sho@e.co").success).toBe(true); // Positive
  expect(b.safeParse("longemail@example.com").success).toBe(false); // Negative

  // Positive and negative cases for `c`
  expect(c.safeParse("56780@e.co").success).toBe(true); // Positive
  expect(c.safeParse("shoasdfasdfrt@e.co").success).toBe(false); // Negative

  // Positive and negative cases for `d`
  expect(d.safeParse("EMAIL@EXAMPLE.COM").success).toBe(true); // Positive
  expect(d.safeParse("email@example.com").success).toBe(false); // Negative

  // Positive and negative cases for `e`
  expect(e.safeParse("email@example.com").success).toBe(true); // Positive
  expect(e.safeParse("EMAIL@EXAMPLE.COM").success).toBe(false); // Negative
});

test("z.stringFormat", () => {
  const ccRegex = /^(?:\d{14,19}|\d{4}(?: \d{3,6}){2,4}|\d{4}(?:-\d{3,6}){2,4})$/u;

  const a = z
    .stringFormat("creditCard", (val) => ccRegex.test(val), {
      error: `Invalid credit card number`,
    })
    .refine((_) => false, "Also bad");

  expect(a.safeParse("asdf")).toMatchInlineSnapshot(`
    {
      "error": [ZodError: [
      {
        "code": "invalid_format",
        "format": "creditCard",
        "path": [],
        "message": "Invalid credit card number"
      },
      {
        "code": "custom",
        "path": [],
        "message": "Also bad"
      }
    ]],
      "success": false,
    }
  `);
  expect(a.safeParse("1234-5678-9012-3456")).toMatchInlineSnapshot(`
    {
      "error": [ZodError: [
      {
        "code": "custom",
        "path": [],
        "message": "Also bad"
      }
    ]],
      "success": false,
    }
  `);
  expect(a.def.pattern).toMatchInlineSnapshot(`undefined`);

  const b = z
    .stringFormat("creditCard", ccRegex, {
      abort: true,
      error: `Invalid credit card number`,
    })
    .refine((_) => false, "Also bad");

  expect(b.safeParse("asdf")).toMatchInlineSnapshot(`
    {
      "error": [ZodError: [
      {
        "code": "invalid_format",
        "format": "creditCard",
        "path": [],
        "message": "Invalid credit card number"
      }
    ]],
      "success": false,
    }
  `);
  expect(b.safeParse("1234-5678-9012-3456")).toMatchInlineSnapshot(`
    {
      "error": [ZodError: [
      {
        "code": "custom",
        "path": [],
        "message": "Also bad"
      }
    ]],
      "success": false,
    }
  `);
  expect(b.def.pattern).toMatchInlineSnapshot(
    `/\\^\\(\\?:\\\\d\\{14,19\\}\\|\\\\d\\{4\\}\\(\\?: \\\\d\\{3,6\\}\\)\\{2,4\\}\\|\\\\d\\{4\\}\\(\\?:-\\\\d\\{3,6\\}\\)\\{2,4\\}\\)\\$/u`
  );
});

test("z.stringFormat async predicate", async () => {
  const failing = z.stringFormat("custom", async () => false);
  const passing = z.stringFormat("custom", async (value) => value === "ok");
  const promiseFail = z.stringFormat("custom", () => Promise.resolve(false));
  const promisePass = z.stringFormat("custom", () => Promise.resolve(true));

  expect(() => failing.safeParse("bad")).toThrow(z.core.$ZodAsyncError);
  expect(() => failing.parse("bad")).toThrow(z.core.$ZodAsyncError);
  expect(() => passing.safeParse("ok")).toThrow(z.core.$ZodAsyncError);
  expect(() => promiseFail.parse("bad")).toThrow(z.core.$ZodAsyncError);
  expect(() => promisePass.safeParse("ok")).toThrow(z.core.$ZodAsyncError);
  // a non-string fails the type check before the predicate runs
  expect(failing.safeParse(1).success).toBe(false);

  const bad = await failing.safeParseAsync("bad");
  expect(bad).toMatchObject({ success: false, error: { issues: [{ code: "invalid_format", format: "custom" }] } });
  await expect(failing.parseAsync("bad")).rejects.toThrow();
  expect(await passing.parseAsync("ok")).toBe("ok");
  expect((await passing.safeParseAsync("no")).success).toBe(false);
  expect((await promiseFail.safeParseAsync("bad")).success).toBe(false);
  expect(await promisePass.parseAsync("ok")).toBe("ok");

  // a later branch must not answer when the predicate returns a promise
  const union = z.union([failing, z.string()]);
  expect(() => union.safeParse("bad")).toThrow(z.core.$ZodAsyncError);
  expect(() => z.compile(union).safeParse("bad")).toThrow(z.core.$ZodAsyncError);
  const nested = z.union([z.object({ a: failing }), z.object({ a: z.string() })]);
  expect(() => nested.safeParse({ a: "x" })).toThrow(z.core.$ZodAsyncError);
  expect(() => z.compile(nested).safeParse({ a: "x" })).toThrow(z.core.$ZodAsyncError);
  const mixed = z.union([promisePass, z.number()]);
  expect(() => mixed.safeParse("ok")).toThrow(z.core.$ZodAsyncError);
  expect(() => z.compile(mixed).safeParse("ok")).toThrow(z.core.$ZodAsyncError);
  expect(mixed.parse(1)).toBe(1);
  expect(z.compile(mixed).parse(1)).toBe(1);

  expect(() => z.compile(failing, { strict: true })).toThrow(z.ZodCompileAsyncError);
  expect(() => z.compile(nested, { strict: true })).toThrow(z.ZodCompileAsyncError);
  expect(() => z.compile(failing).safeParse("bad")).toThrow(z.core.$ZodAsyncError);
  expect((await z.compile(failing).safeParseAsync("bad")).success).toBe(false);
  expect(await z.compile(passing).parseAsync("ok")).toBe("ok");
  expect(() => z.compile(promiseFail).safeParse("bad")).toThrow(z.core.$ZodAsyncError);
  expect(await z.compile(promisePass).parseAsync("ok")).toBe("ok");

  const sync = z.stringFormat("digits", (value) => /^\d+$/.test(value));
  expect(z.compile(sync, { strict: true }).parse("123")).toBe("123");
  expect(z.compile(sync).safeParse("ab").success).toBe(false);
});

test("z.hex", () => {
  const hexSchema = z.hex();

  // Valid hex strings
  expect(hexSchema.safeParse("").success).toBe(true); // Empty string is valid hex
  expect(hexSchema.safeParse("123abc").success).toBe(true);
  expect(hexSchema.safeParse("DEADBEEF").success).toBe(true);
  expect(hexSchema.safeParse("0123456789abcdefABCDEF").success).toBe(true);

  // Invalid hex strings
  expect(hexSchema.safeParse("xyz").success).toBe(false);
  expect(hexSchema.safeParse("123g").success).toBe(false);
  expect(hexSchema.safeParse("hello world").success).toBe(false);
  expect(hexSchema.safeParse("123-abc").success).toBe(false);
});
