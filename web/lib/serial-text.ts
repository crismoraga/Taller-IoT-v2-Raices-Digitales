/** Presentation for streaming USB text; complete lines retain their original content. */
export class SerialTextBuffer {
  private line = "";
  private leading = "";
  private shown = false;
  private afterCR = false;

  reset() {
    this.line = "";
    this.leading = "";
    this.shown = false;
    this.afterCR = false;
  }

  push(chunk: string): { display: string; lines: string[] } {
    if (!chunk) return { display: "", lines: [] };
    const endedWithCR = chunk.endsWith("\r");
    // CRLF can be split across two independent USB reads.
    if (this.afterCR && chunk.startsWith("\n")) chunk = chunk.slice(1);
    this.afterCR = endedWithCR;
    const parts = chunk.replace(/\r\n?/g, "\n").split("\n");
    const lines: string[] = [];
    let display = "";
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      this.line += part;
      // Hide control-only and whitespace-only noise, without altering JSON
      // strings, indentation or partial prints/prompts that have actual text.
      const visible = part.replace(
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,
        "",
      );
      if (this.shown) display += visible;
      else if (visible.trim()) {
        display += this.leading + visible;
        this.leading = "";
        this.shown = true;
      } else this.leading = (this.leading + visible).slice(-15000);
      if (index < parts.length - 1) {
        if (this.line.trim()) lines.push(this.line);
        if (this.shown) display += "\n";
        this.line = "";
        this.leading = "";
        this.shown = false;
      } else this.line = this.line.slice(-15000);
    }
    return { display, lines };
  }
}
