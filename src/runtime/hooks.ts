import { commandKey } from "@schema/index";

export function ancestry(path: readonly string[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i <= path.length; i++) keys.push(commandKey(path.slice(0, i)));
  return keys;
}

export class OverrideHooks<H> {
  private readonly handlers = new Map<string, H>();

  set(key: string, handler: H): void {
    this.handlers.set(key, handler);
  }

  exact(path: readonly string[]): H | undefined {
    return this.handlers.get(commandKey(path));
  }

  nearest(path: readonly string[]): H | undefined {
    for (const key of ancestry(path).reverse()) {
      const handler = this.handlers.get(key);
      if (handler) return handler;
    }

    return undefined;
  }
}

export class ChainHooks<H> {
  private readonly handlers = new Map<string, H[]>();

  add(key: string, handler: H): void {
    const list = this.handlers.get(key) ?? [];
    list.push(handler);
    this.handlers.set(key, list);
  }

  chain(path: readonly string[]): H[] {
    return ancestry(path).flatMap(k => this.handlers.get(k) ?? []);
  }
}
