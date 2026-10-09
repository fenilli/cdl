export interface Span {
  readonly start: number;
  readonly end: number;
}

export interface Position {
  readonly line: number;
  readonly column: number;
}

export class SourceFile {
  readonly name: string;
  readonly text: string;
  private readonly lineStarts: readonly number[];

  constructor(name: string, text: string) {
    this.name = name;
    this.text = text;
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
    }
    this.lineStarts = starts;
  }

  slice(span: Span): string {
    return this.text.slice(span.start, span.end);
  }

  position(offset: number): Position {
    let lo = 0;
    let hi = this.lineStarts.length - 1;

    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }

    return { line: lo + 1, column: offset - this.lineStarts[lo] + 1 };
  }

  lineText(line: number): string {
    const start = this.lineStarts[line - 1] ?? this.text.length;
    const end = this.lineStarts[line] ?? this.text.length;

    return this.text.slice(start, end).replace(/\r?\n$/, "");
  }
}
