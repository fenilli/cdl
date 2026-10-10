# cdl

**Describe your CLI in a tiny language. Get a typed CLI out.**

cdl (command definition language) is a hobby project: a little language for defining command-line interfaces, a compiler for it, and a small runtime that runs whatever the compiler spits out.

> v0.1.0, not on npm yet, and still a bit rough around the edges.

## Why though

Writing a CLI usually means saying the same thing three times: once for the argument parser, once for the help text, once for the types. cdl lets you say it once:

```
command clone {
  argument repository: string
  option branch: string { short "b" }
}
```

and you get the parsing, the `--help` output, and TypeScript types for your handlers, all from that.

## Quickstart

**1. Write a definition** (`git.cdl`):

```
name "git"
description "the stupid content tracker"
version "0.1.0"

command clone {
  argument repository: string

  argument directory: string? {
    description "directory to clone into"
  }

  option branch: string {
    short "b"
    description "checkout a specific branch"
  }
}

command add {
  description "add file contents to the index"

  argument paths: string[] {
    description "files to stage"
  }

  option all: boolean {
    short "A"
    description "Stage all changes"
  }
}
```

**2. Compile it:**

```sh
cdlc build git.cdl -o src/generated
```

That writes two files: `schema.json` (what the runtime reads) and `schema.d.ts` (types for your handlers).

**3. Use it:**

```ts
import { CDL } from "cdl";
import type { CDLSchema } from "./generated/schema";
import schema from "./generated/schema.json" with { type: "json" };

const cli = new CDL<CDLSchema>(schema, {});

cli.on("clone", ({ args, options, print }) => {
  // args.repository is a string, args.directory is string | undefined,
  // options.branch is string | undefined. All typed, none of it typed by hand.
  print(`cloning ${args.repository} (${options.branch ?? "default branch"})`);
});

cli.on("add", ({ args, options }) => {
  console.log(args.paths, options.all); // string[] and boolean
});

process.exitCode = await cli.run();
```

**4. Run it:**

```
$ git clone https://example.com/repo.git -b dev
cloning https://example.com/repo.git (dev)

$ git clone --help
Usage: git clone [options] <repository> [directory]

Arguments:
  <repository>
  [directory]   directory to clone into

Options:
  -b, --branch <string>  checkout a specific branch
  -h, --help             show help

$ git clone
error: missing required argument <repository>

Try 'git clone --help' for more information.
```

## The language

It's small on purpose. There are three kinds of things (`command`, `option`, `argument`) and a few little properties.

| thing       | looks like                      | notes                                                                                         |
| ----------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| metadata    | `name "git"`                    | `name`, `description`, `version`. Top of the file only. They're just for help/version output. |
| command     | `command clone { ... }`         | Nest them as deep as you like. The file itself is the root command.                           |
| option      | `option branch: string { ... }` | Always optional. A `boolean` is a plain flag (`--all`).                                       |
| argument    | `argument repository: string`   | Positional. Required unless you add `?`.                                                      |
| description | `description "..."`             | Works on anything. Shows up in help.                                                          |
| short       | `short "b"`                     | Options only. One letter or digit.                                                            |

Types are `string` and `boolean`. Add `?` for optional and `[]` for a list: `string?`, `string[]`, `string[]?`. Comments start with `#` and run to the end of
the line.

A few rules worth knowing:

- Commands don't take a type. Options and arguments always do.
- A required argument can't come after an optional one, and a list argument has to be last. A required list means "one or more".
- If a command has both subcommands and arguments, a word that matches a subcommand is a subcommand.
- `--help` is free on every command, and `--version` is free on the root if you set a `version`. You can declare them yourself to change the short flag or description, but they're always plain boolean flags.
- Nothing is inherited. Options belong to the command they're declared on.

## cdlc, the compiler

```sh
cdlc check git.cdl            # find problems, write nothing
cdlc check git.cdl --ast      # ...and print the syntax tree as JSON
cdlc build git.cdl            # write schema.json + schema.d.ts here
cdlc build git.cdl -o dist    # ...or somewhere else
```

The compiler keeps going after it finds a problem, so you get everything wrong in one go instead of one error at a time:

```sh
broken.cdl:1:11 error[analysis/unknown-type]: unknown type 'path'; expected 'string' or 'boolean'
   1 | option a: path
     |           ^^^^
```

Exit codes: `0` fine, `1` something was wrong with the file, `2` you called `cdlc` wrong. Warnings (like a pointless `?` on an option) don't fail the build.

And yes, `cdlc` is itself defined in a `.cdl` file and built with cdl. It compiles its own definition.

## The runtime

`CDL` takes the schema and options and gives you something you hang handlers on.

```ts
cli.on(
  "remote add",
  ({ args, options, properties, context, print, printError }) => {
    // do the thing. return a number if you want a specific exit code.
  },
);
```

Hooks, if you want them:

```ts
cli.before(({ key }) => {
  /* runs before any command's handler, root first */
});

cli.after(({ key }) => {
  /* after the handler succeeds */
});

cli.before("remote", ({ key }) => {
  /* only "remote" and the commands under it */
});

cli.onHelp(({ text, print }) => print(text + "\nDocs: https://example.com"));

cli.onVersion(({ version, print }) => print(`v${version}`));

cli.onError(({ error, printError }) => {
  printError(String(error));
  return 3;
});
```

- `before`/`after` run for every match (`before` root-first, `after` leaf-first). `onHelp`/`onError` are different: the closest one to the command wins.
- A command with subcommands but no handler just shows its help.
- Handlers can be async.

Exit codes: `0` ok, `1` a handler (or hook) threw, `2` bad usage (unknown option, missing argument, ...). Option forms it understands: `--name value`, `--name=value`, `-n value`, `-nvalue`, `-abc` for boolean clusters, and `--` to stop parsing.

## How it's put together

```
.cdl text -> lexer -> parser -> analysis -> lowering -> schema.json + schema.d.ts -> your app -> runtime
```

```
src/
  compiler/   lexer, parser, analysis, lowering, emitters (the part that reads .cdl)
  schema/     the contract between compiler and runtime (plain JSON types)
  runtime/    argv parsing, help rendering, hooks, CDL class
  cdlc/       the cdlc command itself (defined in cdlc.cdl)
```

The compiler and the runtime never import each other. They only share `schema/`. That's why an app that just _runs_ a CLI doesn't ship a lexer and a parser.

## Not done yet

- default values
- `--no-flag` and `--flag=false`
- more types than `string` and `boolean`
- env var support, shell completions
- camelCase option names (`dry-run` stays `"dry-run"` in your handler)
- publish on npm

## Try it out

```sh
npm install
npm run typecheck
npm test              # vitest
npm run build         # tsdown
npm run gen:cli       # regenerate cdlc's own schema (needs no build)
npm run verify:cli    # build first; checks the generated files are up to date
```

## License

[MIT](LICENSE)
