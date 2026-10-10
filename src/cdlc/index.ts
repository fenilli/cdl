#!/usr/bin/env node
import { CLI } from "@runtime/cli";
import { build, check, nodeFS } from "./commands";
import type { CDLSchema } from "./generated/schema";
import schema from "./generated/schema.json" with { type: "json"};

const cli = new CLI<CDLSchema>(schema, {});

cli.on("check", ({ args, options, print, printError }) => {
  check(args.file, { ast: options.ast }, { print, printError, ...nodeFS });
});

cli.on("build", ({ args, options, print, printError }) => {
  build(args.file, options.out ?? ".", { print, printError, ...nodeFS });
});

process.exitCode = await cli.run();
