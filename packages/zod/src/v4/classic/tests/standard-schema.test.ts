import { expect, test } from "vitest";

import * as z from "zod/v4";

test("length checks", async () => {
  const schema = z.string();
  const result = await schema["~standard"].validate(12);
  expect(result).toMatchInlineSnapshot(`
    {
      "issues": [
        {
          "code": "invalid_type",
          "expected": "string",
          "message": "Invalid input: expected string, received number",
          "path": [],
        },
      ],
    }
  `);
});

test("length checks", async () => {
  const schema = z.string();
  const result = await schema["~standard"].validate("asdf");
  expect(result).toMatchInlineSnapshot(`
    {
      "value": "asdf",
    }
  `);
});

test("length checks", async () => {
  const schema = z.string().refine(async (val) => val.length > 5);
  const result = await schema["~standard"].validate(12);
  expect(result).toMatchInlineSnapshot(`
    {
      "issues": [
        {
          "code": "invalid_type",
          "expected": "string",
          "message": "Invalid input: expected string, received number",
          "path": [],
        },
      ],
    }
  `);
});

test("length checks", async () => {
  const schema = z.string().refine(async (val) => val.length > 5);
  const result = await schema["~standard"].validate("234134134");
  expect(result).toMatchInlineSnapshot(`
    {
      "value": "234134134",
    }
  `);
});

test("schemas conform to StandardJSONSchemaV1", async () => {
  const schema = z.codec(z.string(), z.number(), {
    decode: (str) => Number.parseFloat(str),
    encode: (num) => num.toString(),
  });
  expect(schema["~standard"].validate).toBeTypeOf("function");
  expect(await schema["~standard"].validate("42")).toMatchInlineSnapshot(`
		{
		  "value": 42,
		}
	`);
  expect(schema["~standard"].jsonSchema.input({ target: "draft-2020-12" })).toMatchInlineSnapshot(`
		{
		  "$schema": "https://json-schema.org/draft/2020-12/schema",
		  "type": "string",
		}
	`);
  expect(schema["~standard"].jsonSchema.output({ target: "draft-2020-12" })).toMatchInlineSnapshot(`
		{
		  "$schema": "https://json-schema.org/draft/2020-12/schema",
		  "type": "number",
		}
	`);
});

test(".toJSONSchema() returns StandardJSONSchemaV1", async () => {
  const codec = z.codec(z.string(), z.number(), {
    decode: (str) => Number.parseFloat(str),
    encode: (num) => num.toString(),
  });
  const result = codec.toJSONSchema();
  expect(result["~standard"].validate).toBeTypeOf("function");
  expect(await result["~standard"].validate("42")).toMatchInlineSnapshot(`
		{
		  "value": 42,
		}
	`);
  expect(result["~standard"].jsonSchema.input({ target: "draft-2020-12" })).toMatchInlineSnapshot(`
		{
		  "$schema": "https://json-schema.org/draft/2020-12/schema",
		  "type": "string",
		}
	`);
  expect(result["~standard"].jsonSchema.output({ target: "draft-2020-12" })).toMatchInlineSnapshot(`
		{
		  "$schema": "https://json-schema.org/draft/2020-12/schema",
		  "type": "number",
		}
	`);
});

test("z.toJSONSchema() returns StandardJSONSchemaV1", async () => {
  const codec = z.codec(z.string(), z.number(), {
    decode: (str) => Number.parseFloat(str),
    encode: (num) => num.toString(),
  });
  const result = z.toJSONSchema(codec);
  expect(result["~standard"].validate).toBeTypeOf("function");
  expect(await result["~standard"].validate("42")).toMatchInlineSnapshot(`
		{
		  "value": 42,
		}
	`);
  expect(result["~standard"].jsonSchema.input({ target: "draft-2020-12" })).toMatchInlineSnapshot(`
		{
		  "$schema": "https://json-schema.org/draft/2020-12/schema",
		  "type": "string",
		}
	`);
  expect(result["~standard"].jsonSchema.output({ target: "draft-2020-12" })).toMatchInlineSnapshot(`
		{
		  "$schema": "https://json-schema.org/draft/2020-12/schema",
		  "type": "number",
		}
	`);
});

test("a failing validate reports the same issues as safeParse, without a ZodError", async () => {
  const schema = z.object({ name: z.string().min(3), age: z.number().refine(async (n) => n > 0) });
  const input = { name: "ab", age: -1 };
  const result = (await schema["~standard"].validate(input)) as { issues: unknown[] };
  expect(result.issues).toEqual((await schema.safeParseAsync(input)).error!.issues);
  expect(result).not.toHaveProperty("error");
  const sync = z.string().min(3)["~standard"].validate("ab") as { issues: unknown[] };
  expect(sync.issues).toEqual(z.string().min(3).safeParse("ab").error!.issues);
});

test("a synchronously throwing check rejects through ~standard instead of throwing", async () => {
  const schema = z.string().refine(() => {
    throw new Error("boom");
  });
  const result = schema["~standard"].validate("abc");
  expect(result).toBeInstanceOf(Promise);
  await expect(result as Promise<unknown>).rejects.toThrow("boom");
});

test("~standard.validate applies libraryOptions like safeParse", async () => {
  const schema = z.object({ age: z.number().min(18), named: z.number().min(18, "Too young") });
  const input = { age: 3, named: 3 };
  const libraryOptions = { error: () => "Must be an adult", reportInput: true };

  const sync = schema["~standard"].validate(input, { libraryOptions }) as {
    issues: { message: string }[];
  };
  expect(sync.issues.map((issue) => issue.message)).toEqual(["Must be an adult", "Too young"]);
  expect(sync.issues).toEqual(schema.safeParse(input, libraryOptions).error!.issues);

  const previous = z.config().customError;
  z.config({ customError: () => "from config" });
  try {
    const overConfig = z
      .number()
      .min(18)
      ["~standard"].validate(3, {
        libraryOptions: { error: () => "Must be an adult" },
      }) as { issues: { message: string }[] };
    expect(overConfig.issues[0]?.message).toEqual("Must be an adult");
  } finally {
    z.config({ customError: previous });
  }

  const asyncSchema = schema.refine(async () => true);
  const asyncResult = (await asyncSchema["~standard"].validate(input, { libraryOptions })) as {
    issues: { message: string }[];
  };
  expect(asyncResult.issues.map((issue) => issue.message)).toEqual(["Must be an adult", "Too young"]);
  expect(asyncResult.issues).toEqual((await asyncSchema.safeParseAsync(input, libraryOptions)).error!.issues);

  expect(schema["~standard"].validate({ age: 21, named: 21 }, { libraryOptions })).toEqual({
    value: { age: 21, named: 21 },
  });
  expect(await asyncSchema["~standard"].validate({ age: 21, named: 21 }, { libraryOptions })).toEqual({
    value: { age: 21, named: 21 },
  });

  const skipped = z
    .string()
    .min(5)
    ["~standard"].validate("abc", {
      libraryOptions: { skipChecks: true },
    }) as { issues: unknown[] };
  expect(skipped.issues).toHaveLength(1);

  const codec = z.codec(z.string(), z.number(), {
    decode: (str) => Number(str),
    encode: (num) => num.toString(),
  });
  expect(codec["~standard"].validate("42", { libraryOptions: { direction: "backward" } })).toEqual({ value: 42 });
});
